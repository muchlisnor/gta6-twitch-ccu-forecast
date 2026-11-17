// gta6-twitch-ccu-forecast-01 entry: a two-part launch-day forecaster.
//
// Model (fitted at runtime from the case file's own comparables — no network,
// no hard-coded launch data, fully deterministic):
//
//   1. PEAK. A log-log regression over past launches, ln(peak) = a + b*ln(hour-1
//      print), predicts the release day's peak hourly average from the hour-1
//      print. A GTA VI prior floors the peak at 1,200,000: the largest
//      launch-day hourly-average peak on record is Cyberpunk 2077's 1,069,278
//      (SullyGnome), GTA V's all-time Twitch peak is 1,140,747 (TwitchTracker),
//      and GTA VI is the biggest entertainment launch in history (Trailer 2:
//      475M views in 24h, Rockstar). The regression is fitted on launches that
//      peak below that, so without the floor it would cap GTA VI below the
//      records it is expected to break. The floor applies ONLY to the Grand
//      Theft Auto VI case itself (matched on the case's game name / Twitch
//      id): it is a prior about this one game, not about launches in general,
//      so practice cases of other games use the pure regression peak. On
//      ordinary launches the floor would be badly wrong (leave-one-out:
//      1.378 with it vs 0.300 without), which is exactly why it is gated.
//   2. SHAPE. The day's curve has two regimes, because the game unlocks at
//      rolling local midnight (NZ 11:00Z Nov 18, CET 23:00Z, UK 00:00Z, US
//      Eastern 05:00Z, US Pacific 08:00Z):
//        hours 2-8  (pre-US): hour-1 print x the median hour-1 ratio of
//                     past launches whose peak fell in hours 12-24
//                     (late-peakers). These hours run at ~0.7-1.1x hour 1.
//        hours 12-24 (US online): predicted peak x the median normalised
//                     late-peaker shape, which rises to ~0.95-0.98 of peak
//                     at hours 19-20 (US afternoon + EU evening) and decays
//                     to ~0.79 by hour 24.
//        hours 9-11: log-space blend between the two regimes.
//   3. SPREAD. Per hour, the population standard deviation (log units) of the
//      residuals ln(actual / model median) across the comparables, floored at
//      0.30 and capped at 1.20. q_tau = median * exp(z_tau * s_h) with
//      z = (-1.645, -0.674, 0, 0.674, 1.645).
//
// Comparables are eligible when hour 1 >= 5,000 viewers, at least 18 of the
// 24 hours are present, and peak / hour-1 <= 50x (this drops tiny-hour-1
// distortion cases like Silksong 2120x, and GTA VI's own pre-release history,
// whose hour 1 is missing). Validation (leave-one-out over the 38
// comparables in the practice kit, scored with the contest's pinball loss):
// mean loss 0.265 vs the house persistence baseline's 0.351 (-24.4%); on
// clean (non-early-access, non-F2P) launches 0.259 vs 0.392 (-33.8%). The
// house baseline's published practice loss is 0.387.
//
// Interface (same as the kit starter): reads every <id>.in in the input
// directory (MAKEFUN_INPUT_DIR or /input), writes <id>.out to the output
// directory (MAKEFUN_OUTPUT_DIR or /output):
// {"hours":[{"hour":2,"q":[q05,q25,q50,q75,q95]}, ...]}, exactly 23 rows,
// hours 2..24, five finite numbers > 0 and <= 1e9, non-decreasing.
// Node 22, standard library only.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

/** The quantile levels the contest scores, in the order each row lists them. */
const LEVELS = [0.05, 0.25, 0.5, 0.75, 0.95];
/** The standard normal's quantile at each level. */
const Z = [-1.645, -0.674, 0, 0.674, 1.645];

/** Hours before the US unlock: anchored to the hour-1 print. */
const EARLY_END = 8;
/** Hours where the early anchor blends into the peak-based shape. */
const BLEND_START = 9;
const BLEND_END = 11;

/** Minimum hour-1 viewers for a comparable to be a reliable anchor. */
const MIN_HOUR1 = 5000;
/** Minimum hours present (of 24) for a comparable's curve to be usable. */
const MIN_HOURS_PRESENT = 18;
/** Maximum peak / hour-1 ratio; above this the hour-1 print was too small
 *  (sparse pre-launch sampling) to anchor anything. */
const MAX_PEAK_RATIO = 50;
/** A launch is a "late-peaker" when its peak hour is 12 or later. */
const LATE_PEAK_HOUR = 12;
/** GTA VI peak prior: just above the largest launch-day hourly-average peak
 *  on record (Cyberpunk 2077, 1,069,278) and GTA V's all-time Twitch peak
 *  (1,140,747). See the header comment. */
const PEAK_FLOOR = 1_200_000;
/** Spread (log units) floor and cap. */
const SPREAD_FLOOR = 0.3;
const SPREAD_CAP = 1.2;

interface Case {
  levels: number[];
  game?: { name?: string; twitch_id?: string };
  known: Array<{ hour: number; viewers: number }>;
  forecast: Array<{ hour: number }>;
  comparables?: Array<{
    name: string;
    day_start: string;
    hourly: Array<{ from: string; viewers: number | null; channels?: number | null }>;
  }>;
}

/** True only for the Grand Theft Auto VI case (the final). The peak floor is
 *  a prior about this one game, so it must not leak into practice cases. */
const isGtaViCase = (c: Case): boolean =>
  (c.game?.name ?? "").includes("Grand Theft Auto VI") || c.game?.twitch_id === "1867279146";

/** x rounded to 2 decimals (half up), as the kit starter rounds it. */
const round2 = (x: number): number => Math.round(x * 100) / 100;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/** Population standard deviation. */
const pstdev = (xs: number[]): number => {
  if (xs.length === 0) return NaN;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
};

/** A comparable's release-day curve: viewers per UTC hour 1..24, or null. */
const dayCurve = (c: NonNullable<Case["comparables"]>[number]): Array<number | null> => {
  const start = Date.parse(c.day_start);
  const sums: number[] = new Array(25).fill(0);
  const counts: number[] = new Array(25).fill(0);
  for (const p of c.hourly ?? []) {
    if (p.viewers === null || p.viewers === undefined) continue;
    const h = Math.floor((Date.parse(p.from) - start) / 3_600_000) + 1;
    if (h < 1 || h > 24) continue;
    sums[h] += p.viewers;
    counts[h] += 1;
  }
  return Array.from({ length: 24 }, (_, i) => {
    const h = i + 1;
    return counts[h] > 0 ? sums[h] / counts[h] : null;
  });
};

const isEligible = (curve: Array<number | null>): boolean => {
  const h1 = curve[0];
  if (h1 === null || h1 < MIN_HOUR1) return false;
  const present = curve.filter((v) => v !== null).length;
  if (present < MIN_HOURS_PRESENT) return false;
  const peak = Math.max(...(curve.filter((v) => v !== null) as number[]));
  return peak / h1 <= MAX_PEAK_RATIO;
};

const peakOf = (curve: Array<number | null>): number =>
  Math.max(...(curve.filter((v) => v !== null) as number[]));

const peakHourOf = (curve: Array<number | null>): number => {
  let best = 1;
  let bestV = -1;
  curve.forEach((v, i) => {
    if (v !== null && v > bestV) {
      bestV = v;
      best = i + 1;
    }
  });
  return best;
};

/** Ordinary least squares on (ln h1, ln peak); returns [intercept, slope]. */
const fitPeakRegression = (curves: Array<Array<number | null>>): [number, number] => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of curves) {
    xs.push(Math.log(c[0] as number));
    ys.push(Math.log(peakOf(c)));
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const b = den > 0 ? num / den : 0;
  return [my - b * mx, b];
};

/** The model's median for hour h, given hour-1 print p1, fitted peak,
 *  shape and ratios. Shared by the spread fit and the forecast so the two
 *  agree exactly. */
const medianFor = (
  p1: number,
  h: number,
  peakPred: number,
  shape: number[],
  ratio: number[],
): number => {
  if (h <= EARLY_END) return p1 * ratio[h];
  if (h <= BLEND_END) {
    const w = (h - BLEND_START + 1) / (BLEND_END - BLEND_START + 2);
    return Math.exp((1 - w) * Math.log(p1 * ratio[h]) + w * Math.log(peakPred * shape[h]));
  }
  return peakPred * shape[h];
};

/** The persistence fallback (the kit starter's numbers), used only when no
 *  comparable is eligible at all. */
const fallbackQuantiles = (p1: number, h: number): number[] =>
  Z.map((z) => round2(p1 * Math.exp(z * 0.15 * Math.sqrt(h - 1))));

const forecastCase = (c: Case, name: string): { hours: Array<{ hour: number; q: number[] }> } => {
  if (c.levels.length !== LEVELS.length || c.levels.some((t, j) => t !== LEVELS[j])) {
    throw new Error(`${name} asks for levels ${JSON.stringify(c.levels)}, not ${JSON.stringify(LEVELS)}`);
  }
  const first = c.known.find((k) => k.hour === 1);
  if (first === undefined) throw new Error(`${name} has no hour-1 print`);
  const p1 = Math.max(1, first.viewers);

  const curves = (c.comparables ?? []).map(dayCurve).filter(isEligible);
  if (curves.length === 0) {
    return { hours: c.forecast.map(({ hour }) => ({ hour, q: fallbackQuantiles(p1, hour) })) };
  }

  // Peak regression over all eligible comparables.
  const [a, b] = fitPeakRegression(curves);
  let peakPred = Math.exp(a + b * Math.log(p1));
  if (!Number.isFinite(peakPred) || peakPred <= 0) {
    // Degenerate fit (e.g. a single comparable): fall back to the median
    // peak ratio.
    const ratios = curves.map((cc) => peakOf(cc) / (cc[0] as number));
    peakPred = p1 * median(ratios);
  }
  peakPred = Math.max(peakPred, isGtaViCase(c) ? PEAK_FLOOR : 0);

  // Late-peakers: the shape and the early-hour ratios.
  const late = curves.filter((cc) => peakHourOf(cc) >= LATE_PEAK_HOUR);
  const shapeSrc = late.length > 0 ? late : curves;
  const shape: number[] = new Array(25).fill(1);
  const ratio: number[] = new Array(25).fill(1);
  for (let h = 1; h <= 24; h++) {
    const fracs = shapeSrc
      .map((cc) => (cc[h - 1] === null ? null : (cc[h - 1] as number) / peakOf(cc)))
      .filter((v): v is number => v !== null);
    if (fracs.length > 0) shape[h] = median(fracs);
  }
  for (let h = 2; h <= 24; h++) {
    const logs = shapeSrc
      .map((cc) => (cc[h - 1] === null ? null : Math.log((cc[h - 1] as number) / (cc[0] as number))))
      .filter((v): v is number => v !== null);
    if (logs.length > 0) ratio[h] = Math.exp(median(logs));
  }

  // Per-hour spread: population std of ln(actual / model median) over the
  // eligible comparables, floored and capped.
  const spreads: number[] = new Array(25).fill(0.5);
  for (let h = 2; h <= 24; h++) {
    const res: number[] = [];
    for (const cc of curves) {
      if (cc[h - 1] === null) continue;
      const pred = medianFor(cc[0] as number, h, Math.exp(a + b * Math.log(cc[0] as number)), shape, ratio);
      res.push(Math.log((cc[h - 1] as number) / pred));
    }
    const s = pstdev(res);
    spreads[h] = Number.isFinite(s) ? Math.max(SPREAD_FLOOR, Math.min(SPREAD_CAP, s)) : 0.5;
  }

  const hours = c.forecast.map(({ hour: h }) => {
    const med = medianFor(p1, h, peakPred, shape, ratio);
    const q = Z.map((z) => {
      const v = round2(med * Math.exp(z * spreads[h]));
      return Math.min(1e9, Math.max(0.01, v));
    });
    // Rounding can only equalise neighbours, never invert them, but guard
    // the contract anyway.
    for (let i = 1; i < q.length; i++) q[i] = Math.max(q[i], q[i - 1]);
    return { hour: h, q };
  });
  return { hours };
};

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR)
  .filter((f) => f.endsWith(".in"))
  .sort();
for (const file of inputs) {
  const id = file.slice(0, -".in".length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), "utf8")) as Case;
  const out = forecastCase(c, file);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ hours: out.hours })}\n`);
}
