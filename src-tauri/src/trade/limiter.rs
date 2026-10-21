//! Multi-limit rate limiter.
//!
//! PoE sends `x-rate-limit-ip` (4 limits) on every response and additionally
//! `x-rate-limit-account` (1 limit) when logged in. Format of the rule headers is
//! `max:window_secs:penalty_secs[,..]`; the state headers are
//! `hits:window_secs:active_penalty_secs[,..]`.
//!
//! Every request has to satisfy ALL limits. Reservations are configured per
//! limit "slot": [account, ip1, ip2, ip3, ip4, ...].

use reqwest::header::HeaderMap;
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, Notify};

/// Default reservation for the "outside" key: (account, ip1, ip2, ip3, ip4, ip5).
/// Slots without a matching server limit are ignored.
pub const DEFAULT_RESERVATION: [usize; 6] = [1, 1, 2, 4, 8, 12];

const DEFAULT_ACCOUNT_RULE: (usize, u64) = (8, 5);
const DEFAULT_IP_RULES: [(usize, u64); 4] = [(12, 4), (16, 12), (50, 300), (1000, 21_600)];
const PENALTY_SAFETY: Duration = Duration::from_millis(500);
const MAX_SLEEP: Duration = Duration::from_secs(1);

fn ms(d: Duration) -> u64 {
    d.as_millis() as u64
}

// ===========================================================================
// Telemetry models
// ===========================================================================

#[derive(Clone, Serialize, PartialEq, Eq, Debug)]
pub struct RuleTelemetry {
    /// "account", "ip1", "ip2", ...
    pub id: String,
    /// "account" | "ip"
    pub kind: String,
    pub max: usize,
    pub window_secs: u64,
    /// hits inside the window (local + server reported)
    pub used: usize,
    /// reserved slots nobody has consumed yet (not usable by general requests)
    pub reserved_free: usize,
    /// slots a general (non reserved) request can still use right now
    pub available: usize,
    /// remaining server penalty for this rule
    pub penalty_ms: u64,
    /// time until a general request may pass this rule (0 = now)
    pub next_slot_ms: u64,
}

#[derive(Clone, Serialize, PartialEq, Eq, Debug)]
pub struct OperationTelemetry {
    pub rules: Vec<RuleTelemetry>,
    pub reserved_requests: HashMap<String, Vec<usize>>,
    pub is_rate_limited: bool,
    /// longest active penalty (server or 429 based)
    pub retry_after_ms: u64,
    /// time until the next general request can be dispatched (0 = now)
    pub next_available_ms: u64,
}

// ===========================================================================
// Core
// ===========================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RuleKind {
    Account,
    Ip,
}

impl RuleKind {
    fn as_str(&self) -> &'static str {
        match self {
            RuleKind::Account => "account",
            RuleKind::Ip => "ip",
        }
    }
}

#[derive(Debug, Clone)]
struct ServerRule {
    kind: RuleKind,
    /// reservation slot: 0 = account, 1.. = ip limits in ascending window order
    slot: usize,
    max: usize,
    window: Duration,
    penalty_until: Option<Instant>,
    /// hits the server reported that we did not make ourselves
    phantoms: VecDeque<Instant>,
}

struct HistoryEntry {
    at: Instant,
    reservation: Option<String>,
}

struct RuleUsage {
    hits: usize,
    total_reserved: usize,
    consumed: usize,
    general_cap: usize,
    general_used: usize,
    used_key: usize,
}

struct RateLimiterCore {
    rules: Vec<ServerRule>,
    history: VecDeque<HistoryEntry>,
    global_penalty_until: Option<Instant>,
    reservations: HashMap<String, Vec<usize>>,
}

fn parse_triplets(raw: &str) -> Vec<(usize, u64, u64)> {
    raw.split(',')
        .filter_map(|seg| {
            let p: Vec<&str> = seg.split(':').collect();
            if p.len() < 2 {
                return None;
            }
            let a = p[0].trim().parse::<usize>().ok()?;
            let b = p[1].trim().parse::<u64>().ok()?;
            let c = p
                .get(2)
                .and_then(|s| s.trim().parse::<u64>().ok())
                .unwrap_or(0);
            Some((a, b, c))
        })
        .collect()
}

impl RateLimiterCore {
    fn new(with_account: bool) -> Self {
        let mut core = Self {
            rules: Vec::new(),
            history: VecDeque::new(),
            global_penalty_until: None,
            reservations: HashMap::new(),
        };
        core.reservations
            .insert("outside".to_string(), DEFAULT_RESERVATION.to_vec());
        core.set_rules(RuleKind::Ip, &DEFAULT_IP_RULES);
        if with_account {
            core.set_rules(RuleKind::Account, &[DEFAULT_ACCOUNT_RULE]);
        }
        core
    }

    fn has_account(&self) -> bool {
        self.rules.iter().any(|r| r.kind == RuleKind::Account)
    }

    fn reserved_for(&self, key: &str, slot: usize) -> usize {
        self.reservations
            .get(key)
            .and_then(|v| v.get(slot))
            .copied()
            .unwrap_or(0)
    }

    /// Replace all rules of `kind`, keeping phantoms / penalties of rules whose window is unchanged.
    fn set_rules(&mut self, kind: RuleKind, parsed: &[(usize, u64)]) {
        let old = std::mem::take(&mut self.rules);
        let (mut old_same, others): (Vec<ServerRule>, Vec<ServerRule>) =
            old.into_iter().partition(|r| r.kind == kind);

        let mut all = others;
        for &(max, win) in parsed {
            let window = Duration::from_secs(win);
            let mut rule = ServerRule {
                kind,
                slot: 0,
                max,
                window,
                penalty_until: None,
                phantoms: VecDeque::new(),
            };
            if let Some(pos) = old_same.iter().position(|r| r.window == window) {
                let prev = old_same.remove(pos);
                rule.penalty_until = prev.penalty_until;
                rule.phantoms = prev.phantoms;
            }
            all.push(rule);
        }

        let mut account: Vec<ServerRule> = all
            .iter()
            .filter(|r| r.kind == RuleKind::Account)
            .cloned()
            .collect();
        let mut ip: Vec<ServerRule> = all.into_iter().filter(|r| r.kind == RuleKind::Ip).collect();
        ip.sort_by_key(|r| r.window);

        for r in account.iter_mut() {
            r.slot = 0;
        }
        for (i, r) in ip.iter_mut().enumerate() {
            r.slot = i + 1;
        }
        account.truncate(1);
        self.rules = account;
        self.rules.extend(ip);
    }

    fn purge_expired(&mut self, now: Instant) {
        let max_window = self
            .rules
            .iter()
            .map(|r| r.window)
            .max()
            .unwrap_or(Duration::from_secs(21_600));

        while let Some(front) = self.history.front() {
            if now.saturating_duration_since(front.at) >= max_window {
                self.history.pop_front();
            } else {
                break;
            }
        }
        for r in self.rules.iter_mut() {
            let w = r.window;
            while let Some(&t) = r.phantoms.front() {
                if now.saturating_duration_since(t) >= w {
                    r.phantoms.pop_front();
                } else {
                    break;
                }
            }
            if r.penalty_until.map_or(false, |u| u <= now) {
                r.penalty_until = None;
            }
        }
        if self.global_penalty_until.map_or(false, |u| u <= now) {
            self.global_penalty_until = None;
        }
    }

    fn rule_hits(&self, r: &ServerRule, now: Instant) -> usize {
        let local = self
            .history
            .iter()
            .rev()
            .take_while(|e| now.saturating_duration_since(e.at) < r.window)
            .count();
        let phantom = r
            .phantoms
            .iter()
            .filter(|&&t| now.saturating_duration_since(t) < r.window)
            .count();
        local + phantom
    }

    fn usage(&self, r: &ServerRule, now: Instant, key: Option<&str>) -> RuleUsage {
        let mut per_key: HashMap<&str, usize> = HashMap::new();
        let mut local = 0usize;
        let mut used_key = 0usize;
        for e in self.history.iter().rev() {
            if now.saturating_duration_since(e.at) >= r.window {
                break;
            }
            local += 1;
            if let Some(k) = e.reservation.as_deref() {
                *per_key.entry(k).or_insert(0) += 1;
                if Some(k) == key {
                    used_key += 1;
                }
            }
        }
        let phantom = r
            .phantoms
            .iter()
            .filter(|&&t| now.saturating_duration_since(t) < r.window)
            .count();
        let hits = local + phantom;

        let total_reserved: usize = self
            .reservations
            .values()
            .map(|v| v.get(r.slot).copied().unwrap_or(0))
            .sum();
        let consumed: usize = per_key
            .iter()
            .map(|(k, &n)| n.min(self.reserved_for(k, r.slot)))
            .sum();
        let general_cap = r.max.saturating_sub(total_reserved).max(1);
        let general_used = hits.saturating_sub(consumed);

        RuleUsage {
            hits,
            total_reserved,
            consumed,
            general_cap,
            general_used,
            used_key,
        }
    }

    /// Time until a hit that matters for this request expires.
    /// `any` = every hit counts (rule completely full), otherwise only hits
    /// that occupy general-pool slots (or the requester's own reservation).
    fn next_expiry(&self, r: &ServerRule, now: Instant, key: Option<&str>, any: bool) -> Duration {
        let mut best: Option<Instant> = None;
        let mut fallback: Option<Instant> = None;

        for e in self.history.iter() {
            if now.saturating_duration_since(e.at) >= r.window {
                continue;
            }
            let exp = e.at + r.window;
            fallback = Some(fallback.map_or(exp, |c| c.min(exp)));
            let counts = match e.reservation.as_deref() {
                None => true,
                Some(k) => Some(k) == key || self.reserved_for(k, r.slot) == 0,
            };
            if counts {
                best = Some(best.map_or(exp, |c| c.min(exp)));
            }
        }
        for &t in r.phantoms.iter() {
            if now.saturating_duration_since(t) >= r.window {
                continue;
            }
            let exp = t + r.window;
            fallback = Some(fallback.map_or(exp, |c| c.min(exp)));
            best = Some(best.map_or(exp, |c| c.min(exp)));
        }

        let target = if any { fallback } else { best.or(fallback) };
        target
            .map(|t| t.saturating_duration_since(now))
            .unwrap_or(Duration::ZERO)
            .max(Duration::from_millis(10))
    }

    fn rule_delay(&self, r: &ServerRule, now: Instant, key: Option<&str>) -> Option<Duration> {
        if let Some(until) = r.penalty_until {
            if until > now {
                return Some(until - now);
            }
        }
        let u = self.usage(r, now, key);
        if u.hits >= r.max {
            return Some(self.next_expiry(r, now, key, true));
        }
        if let Some(k) = key {
            if u.used_key < self.reserved_for(k, r.slot) {
                return None; // own reserved slot is free
            }
        }
        if u.general_used < u.general_cap {
            return None;
        }
        Some(self.next_expiry(r, now, key, false))
    }

    /// None = may dispatch now, Some(d) = wait at least d (then re-check).
    fn check_delay(&mut self, now: Instant, key: Option<&str>) -> Option<Duration> {
        self.purge_expired(now);

        let mut worst: Option<Duration> = self
            .global_penalty_until
            .filter(|&u| u > now)
            .map(|u| u - now);

        for r in &self.rules {
            if let Some(d) = self.rule_delay(r, now, key) {
                worst = Some(worst.map_or(d, |w| w.max(d)));
            }
        }
        worst
    }

    fn record_dispatch(&mut self, now: Instant, key: Option<&str>) {
        self.history.push_back(HistoryEntry {
            at: now,
            reservation: key.map(|k| k.to_string()),
        });
    }

    fn reconcile_headers(&mut self, headers: &HeaderMap) {
        let hv = |name: &str| -> Option<String> {
            headers
                .get(name)
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        };

        // No IP header = not a real PoE API response (e.g. a Cloudflare page): ignore
        let Some(ip_rules_raw) = hv("x-rate-limit-ip") else {
            return;
        };
        let ip_rules = parse_triplets(&ip_rules_raw);
        if !ip_rules.is_empty() {
            let pairs: Vec<(usize, u64)> = ip_rules.iter().map(|&(m, w, _)| (m, w)).collect();
            self.set_rules(RuleKind::Ip, &pairs);
        }

        // Account header present = authenticated request. Missing = public endpoint.
        match hv("x-rate-limit-account").map(|s| parse_triplets(&s)) {
            Some(acc) if !acc.is_empty() => {
                let pairs: Vec<(usize, u64)> = acc.iter().map(|&(m, w, _)| (m, w)).collect();
                self.set_rules(RuleKind::Account, &pairs);
            }
            _ => self.set_rules(RuleKind::Account, &[]),
        }

        if let Some(s) = hv("x-rate-limit-ip-state") {
            self.apply_state(RuleKind::Ip, &parse_triplets(&s));
        }
        if let Some(s) = hv("x-rate-limit-account-state") {
            self.apply_state(RuleKind::Account, &parse_triplets(&s));
        }
    }

    fn apply_state(&mut self, kind: RuleKind, states: &[(usize, u64, u64)]) {
        let now = Instant::now();
        for &(srv_hits, win, penalty_secs) in states {
            let window = Duration::from_secs(win);
            let Some(idx) = self
                .rules
                .iter()
                .position(|r| r.kind == kind && r.window == window)
            else {
                continue;
            };

            if penalty_secs > 0 {
                let until = now + Duration::from_secs(penalty_secs) + PENALTY_SAFETY;
                let r = &mut self.rules[idx];
                r.penalty_until = Some(r.penalty_until.map_or(until, |c| c.max(until)));
            }

            let local = {
                let r = &self.rules[idx];
                self.rule_hits(r, now)
            };
            let r = &mut self.rules[idx];
            if srv_hits > local {
                for _ in 0..(srv_hits - local) {
                    r.phantoms.push_back(now);
                }
            } else if srv_hits < local {
                // Server counts fewer hits: drop phantoms first. Hits we made ourselves
                // are kept (requests may still be in flight and not counted yet).
                let mut diff = local - srv_hits;
                while diff > 0 && r.phantoms.pop_front().is_some() {
                    diff -= 1;
                }
            }
        }
    }

    fn telemetry(&mut self, now: Instant) -> OperationTelemetry {
        self.purge_expired(now);

        let global_remaining = self
            .global_penalty_until
            .and_then(|u| u.checked_duration_since(now))
            .map(ms)
            .unwrap_or(0);

        let mut rules_t = Vec::with_capacity(self.rules.len());
        let mut retry_after = global_remaining;
        let mut next_available = global_remaining;
        let mut ip_n = 0usize;

        for r in &self.rules {
            let u = self.usage(r, now, None);
            let used = u.hits.min(r.max);
            let reserved_free = u
                .total_reserved
                .saturating_sub(u.consumed)
                .min(r.max - used);
            let available = u
                .general_cap
                .saturating_sub(u.general_used)
                .min(r.max - used - reserved_free);
            let penalty_ms = r
                .penalty_until
                .and_then(|t| t.checked_duration_since(now))
                .map(ms)
                .unwrap_or(0);
            let next_slot_ms = self.rule_delay(r, now, None).map(ms).unwrap_or(0);

            retry_after = retry_after.max(penalty_ms);
            next_available = next_available.max(next_slot_ms);

            let id = match r.kind {
                RuleKind::Account => "account".to_string(),
                RuleKind::Ip => {
                    ip_n += 1;
                    format!("ip{}", ip_n)
                }
            };

            rules_t.push(RuleTelemetry {
                id,
                kind: r.kind.as_str().to_string(),
                max: r.max,
                window_secs: r.window.as_secs(),
                used,
                reserved_free,
                available,
                penalty_ms,
                next_slot_ms,
            });
        }

        OperationTelemetry {
            rules: rules_t,
            reserved_requests: self.reservations.clone(),
            is_rate_limited: next_available > 0,
            retry_after_ms: retry_after,
            next_available_ms: next_available,
        }
    }
}

// ===========================================================================
// Shared wrapper
// ===========================================================================

pub struct SharedRateLimiter {
    core: Mutex<RateLimiterCore>,
    update_notify: Arc<Notify>,
}

impl SharedRateLimiter {
    pub fn new(update_notify: Arc<Notify>, with_account: bool) -> Self {
        Self {
            core: Mutex::new(RateLimiterCore::new(with_account)),
            update_notify,
        }
    }

    /// Earliest moment at which any counter / penalty changes (used by the telemetry emitter).
    pub async fn time_until_next_change(&self) -> Option<Duration> {
        let mut core = self.core.lock().await;
        let now = Instant::now();
        core.purge_expired(now);

        let mut cands: Vec<Instant> = Vec::new();
        if let Some(u) = core.global_penalty_until {
            cands.push(u);
        }
        for r in &core.rules {
            if let Some(u) = r.penalty_until {
                cands.push(u);
            }
            if let Some(e) = core
                .history
                .iter()
                .find(|e| now.saturating_duration_since(e.at) < r.window)
            {
                cands.push(e.at + r.window);
            }
            if let Some(&t) = r
                .phantoms
                .iter()
                .find(|&&t| now.saturating_duration_since(t) < r.window)
            {
                cands.push(t + r.window);
            }
        }
        cands
            .into_iter()
            .filter(|&t| t > now)
            .min()
            .map(|t| t - now)
    }

    pub async fn wait_for_slot(&self, reservation: Option<&str>) {
        loop {
            let delay = {
                let mut core = self.core.lock().await;
                core.check_delay(Instant::now(), reservation)
            };
            match delay {
                // Cap the sleep so rule changes (login / logout, new headers) are picked up
                Some(d) => tokio::time::sleep(d.min(MAX_SLEEP)).await,
                None => break,
            }
        }
    }

    pub async fn record(&self, reservation: Option<&str>) {
        {
            let mut core = self.core.lock().await;
            core.record_dispatch(Instant::now(), reservation);
        }
        self.update_notify.notify_one();
    }

    pub async fn reconcile(&self, headers: &HeaderMap) {
        {
            let mut core = self.core.lock().await;
            core.reconcile_headers(headers);
        }
        self.update_notify.notify_one();
    }

    pub async fn set_penalty(&self, duration: Duration) {
        {
            let mut core = self.core.lock().await;
            let until = Instant::now() + duration;
            core.global_penalty_until =
                Some(core.global_penalty_until.map_or(until, |c| c.max(until)));
        }
        self.update_notify.notify_one();
    }

    /// Enable / disable the account limit (login state changed).
    /// Enabling uses the default 8:5 rule until the first response corrects it.
    pub async fn set_account_rule_enabled(&self, enabled: bool) {
        {
            let mut core = self.core.lock().await;
            if enabled {
                if !core.has_account() {
                    core.set_rules(RuleKind::Account, &[DEFAULT_ACCOUNT_RULE]);
                }
            } else {
                core.set_rules(RuleKind::Account, &[]);
            }
        }
        self.update_notify.notify_one();
    }

    /// slots = [account, ip1, ip2, ip3, ip4, ...]
    pub async fn set_reservation(&self, name: String, slots: Vec<usize>) {
        {
            let mut core = self.core.lock().await;
            core.reservations.insert(name, slots);
        }
        self.update_notify.notify_one();
    }

    pub async fn get_telemetry(&self) -> OperationTelemetry {
        let mut core = self.core.lock().await;
        core.telemetry(Instant::now())
    }
}
