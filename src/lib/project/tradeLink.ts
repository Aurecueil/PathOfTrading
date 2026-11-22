import type { League, Realm } from "$lib/types/leagues";

export interface ParsedTradeLink {
  code: string;
  realm: Realm | null; // null = not present in the input
  league: string | null; // null = not present in the input
}

const REALM_TOKENS: Record<string, Realm> = {
  pc: "pc",
  xbox: "xbox",
  sony: "sony",
  poe2: "poe2",
};
const REALM_GUESS_ORDER: Realm[] = ["pc", "poe2", "xbox", "sony"];

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Accepts any of:
 *  https://www.pathofexile.com/trade/search/Covens/CODE
 *  pot://www.pathofexile.com/trade/search/xbox/Covens/CODE
 *  pot://trade2/search/League/CODE   (also pot://trade/search/...)
 *  Covens/CODE, xbox/Covens/CODE, CODE
 */
export function parseTradeInput(raw: string): ParsedTradeLink {
  let s = raw.trim();
  s = s.replace(/[?#].*$/, ""); // drop query / hash
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ""); // drop scheme (https://, pot://)

  let segs = s.split("/").filter(Boolean).map(safeDecode);
  if (segs[0]?.includes(".")) segs.shift(); // hostname

  let realm: Realm | null = null;
  const tradeIdx = segs.findIndex((x) => /^trade2?$/i.test(x));
  if (tradeIdx >= 0) {
    realm = segs[tradeIdx].toLowerCase() === "trade2" ? "poe2" : "pc";
    segs = segs.slice(tradeIdx + 1);
  }
  if (segs[0]?.toLowerCase() === "search") segs.shift();
  if (segs.length > 1 && segs[segs.length - 1].toLowerCase() === "live") {
    segs.pop();
  }

  const code = segs.pop();
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new Error("No valid search code found in the pasted text.");
  }

  // optional explicit realm segment (xbox / sony / poe2 / pc)
  if (segs.length > 0) {
    const tok = REALM_TOKENS[segs[0].toLowerCase()];
    if (tok) {
      realm = tok;
      segs.shift();
    }
  }

  const league = segs.length > 0 ? segs[segs.length - 1] : null;
  return { code, realm, league };
}

/** base64url -> gzip -> JSON (same as the python decode_query) */
export async function decodeTradeCode(code: string): Promise<any> {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

  let text: string;
  try {
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes).catch(() => {});
    writer.close().catch(() => {});
    text = await new Response(ds.readable).text();
  } catch {
    throw new Error("Could not decode the search code.");
  }

  let obj: any;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("Search code does not contain valid JSON.");
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("Search code does not contain a trade query.");
  }
  // Some codes may already be a full request ({ query, sort }); accept both
  if (obj.query && typeof obj.query === "object") {
    return {
      query: obj.query,
      sort:
        obj.sort && typeof obj.sort === "object" ? obj.sort : { price: "asc" },
    };
  }
  // The usual case: the code is the query itself
  return { query: obj, sort: { price: "asc" } };
}

export function resolveRealmLeague(
  parsed: ParsedTradeLink,
  leagues: League[],
): { realm: Realm; league: string } {
  const byRealm = (r: Realm) => leagues.filter((l) => l.realm === r);
  const find = (r: Realm, name: string) => {
    const n = name.toLowerCase();
    return byRealm(r).find(
      (l) =>
        String(l.id).toLowerCase() === n ||
        String(l.text ?? "").toLowerCase() === n,
    );
  };
  const defaultLeague = (r: Realm) =>
    byRealm(r).length > 0 ? String(byRealm(r)[0].id) : "Standard";

  if (parsed.realm) {
    const realm = parsed.realm;
    if (!parsed.league) return { realm, league: defaultLeague(realm) };
    const m = find(realm, parsed.league);
    if (m) return { realm, league: String(m.id) };
    // unknown league: keep as typed only if we have no league list to check against
    return {
      realm,
      league: byRealm(realm).length > 0 ? defaultLeague(realm) : parsed.league,
    };
  }

  if (parsed.league) {
    for (const r of REALM_GUESS_ORDER) {
      const m = find(r, parsed.league);
      if (m) return { realm: r, league: String(m.id) };
    }
  }
  return { realm: "pc", league: defaultLeague("pc") };
}
