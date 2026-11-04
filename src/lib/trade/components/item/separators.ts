import { CDN_BASE } from "./stats/statsUtils";

const P = (f: string) => `${CDN_BASE}/protected/image/item/popup/${f}`;

const NORMAL = P(
  "separator-normal.png?v=1709582916256&key=cmAWWUaOWJPiapkRFEyzoQ",
);
const MAGIC = P(
  "separator-magic.png?v=1709582916256&key=WHdxxKesPGQwo-o2yd6V8Q",
);
const RARE = P("separator-rare.png?v=1709582916256&key=CSxkkdAMEQ9oW5h6DEQewQ");
const UNIQUE = P(
  "separator-unique.png?v=1709582916256&key=KxJv36tBZx3tAvjfi8x4vQ",
);
const RELIC = P(
  "separator-relic.png?v=1709582916256&key=kvZ2ntgK4zSlu39PBUao6w",
);

interface Sep {
  url: string;
  height: number;
}

const SEPARATORS: Record<string, Sep> = {
  normal: { url: NORMAL, height: 8 },
  runicnormal: { url: NORMAL, height: 8 },
  magic: { url: MAGIC, height: 8 },
  runicmagic: { url: MAGIC, height: 8 },
  rare: { url: RARE, height: 8 },
  runicrare: { url: RARE, height: 8 },
  unique: { url: UNIQUE, height: 8 },
  runicunique: { url: UNIQUE, height: 8 },
  relic: { url: RELIC, height: 8 },
  foil: { url: RELIC, height: 8 },
  runicrelic: { url: RELIC, height: 8 },
  gem: {
    url: P("separator-gem.png?v=1709582916256&key=lhgN3lj7TU9gOV1l2czPrg"),
    height: 8,
  },
  currency: {
    url: P("separator-currency.png?v=1709582916256&key=feE6C76OtwqGxm7MkTSRxw"),
    height: 8,
  },
  quest: {
    url: P("separator-quest.png?v=1709582916256&key=x2qLefiLJ9Fxh84jMHJ84Q"),
    height: 8,
  },
  prophecy: {
    url: P("separator-prophecy.png?v=1709582916256&key=UySAYNU_c_aPafA5TkrosQ"),
    height: 8,
  },
  supporterfoil: {
    url: P(
      "separator-supporter-foil.png?v=1709582916256&key=dk5E7weprEcODAHJpgGPtQ",
    ),
    height: 8,
  },
  necropolis: {
    url: P(
      "necropolis/separator-necropolis.png?v=1710470813712&key=23kqHXck6SA6-OQgc2J0eg",
    ),
    height: 11,
  },
  breach: {
    url: P(
      "breach/separator-breach.png?v=1760503699088&key=pfpborKneeeF7xP9q2Rhfg",
    ),
    height: 13,
  },
  breachskill: {
    url: P(
      "breach/separator-breach.png?v=1760503699088&key=pfpborKneeeF7xP9q2Rhfg",
    ),
    height: 13,
  },
};

export function getSeparator(frameTypeId?: string | null): Sep {
  return (
    SEPARATORS[String(frameTypeId ?? "").toLowerCase()] ?? SEPARATORS.normal
  );
}

/** Inline CSS vars, set on the stats container; consumed by .section::before, .separator-line and PropertyLine */
export function separatorCssVars(frameTypeId?: string | null): string {
  const s = getSeparator(frameTypeId);
  return `--sep-img: url("${s.url}"); --sep-h: ${s.height}px`;
}
