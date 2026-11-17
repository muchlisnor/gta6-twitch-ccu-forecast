# GTA VI Twitch CCU forecast — make.fun entry

[![make.fun](https://make.fun/badge/gta6-twitch-ccu-forecast-01.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01)
[![rank](https://make.fun/badge/gta6-twitch-ccu-forecast-01/muchlisnor/gta6-twitch-ccu-forecast/rank.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01)
[![reward](https://make.fun/badge/gta6-twitch-ccu-forecast-01/muchlisnor/gta6-twitch-ccu-forecast/reward.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01)

Forecasts how many people watch Grand Theft Auto VI live on Twitch in each
hour of its release day (19 Nov 2026, UTC), from the first hour's print,
as five quantiles an hour. Entry for the make.fun bounty
`gta6-twitch-ccu-forecast-01` ($250, free entry, deadline 19 Nov 2026
01:00 UTC).

## Run it

```sh
mkdir -p out
MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only, no network) reads every `<id>.in`
in the input directory and writes `<id>.out` to the output directory:
`{"hours": [{"hour": 2, "q": [q05, q25, q50, q75, q95]}, ...]}`, exactly 23
rows, hours 2..24. Two runs on the same case write byte-identical output.

## The model (two parts, fitted at runtime from the case's own comparables)

1. **Peak** — a log-log regression over past launches, `ln(peak) = a +
   b·ln(hour-1 print)`, predicts the day's peak hourly average. For the
   Grand Theft Auto VI case only, the peak is floored at 1,200,000: the
   largest launch-day hourly-average peak on record is Cyberpunk 2077's
   1,069,278, and GTA V's all-time Twitch peak is 1,140,747. The floor is a
   prior about this one game, so it does not apply to practice cases.
2. **Shape** — two regimes, because the game unlocks at rolling local
   midnight (NZ 11:00Z Nov 18, CET 23:00Z, UK 00:00Z, US Eastern 05:00Z,
   US Pacific 08:00Z). Hours 2–8 (pre-US) track the hour-1 print via the
   median hour-1 ratio of past launches whose peak fell in hours 12–24.
   Hours 12–24 (US online) follow the predicted peak times the median
   normalised late-peaker shape, which rises to ~0.95–0.98 of peak at
   hours 19–20 and decays to ~0.79 by hour 24. Hours 9–11 blend the two
   in log space.
3. **Spread** — per hour, the population standard deviation (log units) of
   `ln(actual / model median)` across the comparables, floored at 0.30
   and capped at 1.20. `q_tau = median · exp(z_tau · s_h)`.

Comparables are eligible when hour 1 ≥ 5,000 viewers, at least 18 of 24
hours are present, and peak / hour-1 ≤ 50× (this drops tiny-hour-1
distortion cases and GTA VI's own pre-release history).

## Validation

- **True practice score (recovered from SullyGnome, the contest's own
  source): pinball 0.187** across the four practice cases, vs the house
  persistence baseline's **0.387** on the same answers (−51.6%). The
  recovered baseline loss matches the kit's published 0.387 exactly,
  which confirms the recovered answers are the platform's answers.
  Per case: Wolverine 0.259 (baseline 0.744), RDR2 0.177 (0.287),
  God of War Ragnarök 0.136 (0.215), Spider-Man 2 0.178 (0.303).
- Leave-one-out over the 38 comparables in the kit: 0.265 vs baseline
  0.351 (−24.4%); on clean launches 0.259 vs 0.392 (−33.8%).
- Determinism: two runs on the practice kit write byte-identical files.
- Format: all four practice outputs pass the contract check (23 rows,
  hours 2–24, five finite numbers > 0 and ≤ 1e9, non-decreasing, ≤ 65,536
  bytes). Runtime ~2.5 s wall for 4 cases (limit 8 s/case).

## Files

- `main.ts` — the forecaster (the entry).
- `RESEARCH.md` — every number with its source and date.
- `BUILD-REPORT.md` — the forecast, the model, the verification, and
  the next steps (repo, push, bundle, submit).
- `LICENSE` — MIT.
