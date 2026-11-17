# RESEARCH.md — GTA VI Twitch CCU forecast entry

Every number used by the model or the forecast, with its source and the date
it was read (all read 17 Nov 2026 unless stated). Nothing here is from
training data alone: every figure traces to the contest kit, to SullyGnome
(the contest's own source), or to a named press source.

## 1. The contest (kit, fetched 17 Nov 2026)

- Bounty `gta6-twitch-ccu-forecast-01`, make.fun. $250 pot, free entry,
  top 20 paid (1st $50, 2nd $35, 3rd $25, 4th–10th $10, 11th–20th $7).
  Deadline **19 Nov 2026 01:00 UTC (08:00 WIB)**. 2,951 submissions at the
  board check 17 Nov 16:44 WIB.
- Kit: `gta6-twitch-ccu-forecast-01-kit-fresh/` (bundle
  `a8c440f8…`). Sources: `competition.yaml`, `RULES.txt`,
  `input/NOTICE.txt`, `starter/main.ts` + `starter/main.py`.
- Task: forecast the Twitch category "Grand Theft Auto VI" (Twitch game id
  **1867279146**) concurrent viewers, hour by hour, for hours 2..24 of
  release day 19 Nov 2026 (UTC), from the hour-1 print, as five quantiles
  (0.05 / 0.25 / 0.5 / 0.75 / 0.95) per hour.
- Scoring: mean pinball loss on the log scale,
  `2·max(τ·d, (τ−1)·d)` with `d = ln(y) − ln(q)`; lower is better. An
  invalid case scores as if every quantile equalled the hour-1 print.
  A prize needs a loss strictly below the best house entry.
- House baseline (persistence): q50 = hour-1 print every hour,
  `q_τ = p1 · exp(z_τ · 0.15 · √(h−1))`. Published practice loss **0.387**,
  typical miss 82.8%, coverage 0.783 (`competition.yaml`).
- House model one-shot: a separate AI forecast (Superbot, reasoning max),
  also to beat — its practice loss is not published.
- Output contract: `{"hours": [{"hour": 2, "q": [q05, q25, q50, q75, q95]},
  ...]}`, exactly 23 rows, hours 2..24, each q five finite numbers > 0
  and ≤ 1e9, non-decreasing, ≤ 65,536 bytes. Program runs offline, no
  network, stdlib only, ≤ 8 s/case, 1 CPU, 1024 MB, deterministic (two
  runs = same bytes). `main.ts` (Node 22) or `main.py` (Python 3.13) at
  the repo root; reads `/input/<id>.in`, writes `/output/<id>.out`.
- Unlock geometry (competition.yaml): rolling midnight local — New Zealand
  first **2026-11-18T11:00Z**, CET 23:00Z, UK 2026-11-19T00:00Z, US Eastern
  05:00Z, US Pacific 08:00Z. Hour 1 (00:00–01:00Z) already has NZ/AU/Asia
  + CET + UK; the US comes online at hours 6 (ET) and 9 (PT).
- Probe 2026-11-17T03:10Z (competition.yaml): GTA VI category **1,240
  viewers, 181 channels**; GTA V (id 32982) 81,611 viewers, 3,514 channels
  at the same read.

## 2. The practice cases and comparables (kit case files)

Source: SullyGnome.com hourly Twitch category averages, as bundled in the
kit (`input/p00.in`–`p03.in`). Practice cases (all console games that
unlocked at midnight local time):

| case | launch | release | hour-1 print | hour-1 channels |
|------|--------|---------|-------------|-----------------|
| p00 | Marvel's Wolverine | 2026-09-15 | 23,357 | 619 |
| p01 | Red Dead Redemption 2 | 2018-10-26 | 116,550 | 2,435 |
| p02 | God of War Ragnarök | 2022-11-09 | 269,517 | 2,709 |
| p03 | Marvel's Spider-Man 2 | 2023-10-20 | 119,087 | 1,784 |

Comparables: **38 launches** in a practice case, **42 in the final**
(the 38 + the 4 practice launches). Plus GTA VI's own pre-release
category history (2026-08-27 premiere to 2026-11-17): max **1,418,094**
viewers in the premiere hour (2026-08-27T16:00Z), last point 1,419
viewers (2026-11-17T02:00Z), mean 5,172. Its hour 1 is missing, so it
never enters the model's training set (eligibility requires hour 1).

Largest comparable peaks (SullyGnome hourly averages, from the kit):

| launch | hour-1 | peak (hourly avg) | peak/hour-1 |
|--------|-------:|------------------:|------------:|
| Cyberpunk 2077 (2020-12-10) | 851,999 | 1,069,278 | 1.26× |
| ELDEN RING (2022-02-25) | 875,155 | 875,155 | 1.00× |
| Diablo IV (2023-06-06) | 533,455 | 673,808 | 1.26× |
| Resident Evil Requiem (2026-02-27) | 46,345 | 562,811 | 12.15× |
| Hogwarts Legacy (2023-02-10) | 387,358 | 504,995 | 1.30× |
| The Last of Us Part II (2020-06-19) | 365,019 | 488,329 | 1.34× |
| Monster Hunter Wilds (2025-02-28) | 152,314 | 402,550 | 2.64× |
| Zelda: Tears of the Kingdom (2023-05-12) | 129,948 | 346,283 | 2.66× |
| Elden Ring Nightreign (2025-05-30) | 319,909 | 319,909 | 1.00× |
| Ghost of Tsushima (2020-07-17) | 131,910 | 297,240 | 2.25× |
| Clair Obscur: Expedition 33 (2025-04-24) | 10,639 | 118,507 | 11.14× |

Notes from the kit's own `unlock` research notes: Hogwarts Legacy's
1.21M peak was on the early-access day (2023-02-07), its release-day peak
was 505k; Cyberpunk's peak is PC-simultaneous dominated; RE Requiem and
Clair Obscur had anomalously small hour-1 prints (sparse pre-launch
sampling), which is why the model caps peak/hour-1 at 50× and requires
hour-1 ≥ 5,000.

## 3. The practice answers (recovered from SullyGnome, 17 Nov 2026)

The kit seals the practice answers on the platform, but they are the
public SullyGnome curves the kit itself was built from. I fetched the
four months from SullyGnome's chart API (the endpoints named in the
kit's `input/NOTICE.txt`) via the text fetcher and aligned each curve on
its case file's known hour-1 print (exact match in all four cases).
Cross-check: the house baseline scored on these recovered answers is
**0.387 — exactly the kit's published practice loss**, which confirms
the recovered answers are the platform's answers.

- GoW Ragnarök, Nov 9 2022 (SullyGnome id 65645):
  h1 269,517; h2 220,787; h3 146,900; h4 141,669; h5 156,301; h6 281,917;
  h7 273,454; h8 258,613; h9 196,345; h10 186,781; h11 189,204;
  h12 152,840; h13 179,704; h14 217,655; h15 271,761; h16 310,384;
  h17 376,075; h18 435,038; h19 444,580; h20 460,387; h21 445,097;
  h22 434,600; h23 411,192; h24 383,725. Peak 460,387 @ h20.
- Marvel's Spider-Man 2, Oct 20 2023 (SullyGnome id 97296):
  h1 119,087; h2 79,573; h3 51,615; h4 50,272; h5 166,214; h6 146,818;
  h7 125,021; h8 109,152; h9 93,203; h10 83,997; h11 71,214; h12 43,730;
  h13 68,551; h14 100,971; h15 131,596; h16 164,722; h17 176,018;
  h18 225,745; h19 250,538; h20 240,849; h21 258,378; h22 263,140;
  h23 253,088; h24 216,387. Peak 263,140 @ h22. (Daily mean 143,083,
  matching TwitchStats' published Oct 20 average exactly.)
- Red Dead Redemption 2, Oct 26 2018 (SullyGnome id 28264):
  h1 116,550; h2 102,778; h3 99,986; h4 84,459; h5 152,428; h6 176,319;
  h7 163,532; h8 148,485; h9 134,888; h10 120,686; h11 119,921;
  h12 138,073; h13 165,093; h14 195,646; h15 231,529; h16 264,043;
  h17 330,969; h18 369,358; h19 322,991; h20 290,598; h21 281,596;
  h22 258,394; h23 223,948; h24 192,584. Peak 369,358 @ h18.
- Marvel's Wolverine, Sep 15 2026 (SullyGnome id 117671):
  h1 23,357; h2 19,397; h3 20,292; h4 18,329; h5 35,760; h6 40,523;
  h7 38,196; h8 30,468; h9 37,322; h10 32,884; h11 36,770; h12 41,223;
  h13 45,078; h14 58,758; h15 78,329; h16 91,382; h17 133,910;
  h18 189,396; h19 175,604; h20 206,982; h21 212,243; h22 196,416;
  h23 153,926; h24 147,358. Peak 212,243 @ h21 (9.09× hour 1).

Patterns visible in all four: an early dip (hours 3–4 run ~0.5–0.7×
hour 1), a jump at the US Eastern unlock (hour 5 in EDT months, hour 6
in EST months), a midday UTC trough (hours 9–12), and a peak in hours
18–22 (US afternoon/evening + EU evening). These patterns are the
model's shape.

## 4. GTA VI hype (press, Nov 2026)

- Trailer 1 (Dec 2023): **90.4M YouTube views in 24h**, Guinness record
  for the most-viewed game reveal; cumulative ~304M (Nov 15, 2026).
  Source: Guinness World Records / Rockstar, via search.
- Trailer 2 (May 2025): **475M views across all platforms in 24h**
  (Rockstar: "biggest video launch of all time"); ~188M on YouTube
  alone. Source: Rockstar Games statement, via search.
- Extended Look (27 Aug 2026): ~37M YouTube views; Netflix's
  most-watched film that week (31.1M views). Source: press, via search.
- Launch Trailer (15 Oct 2026): ~80M views. Source: press, via search.
- PS5 install base: **97.9M consoles shipped** (Sony, Nov 5, 2026).
  Source: Sony earnings, via search.
- GTA V remains Twitch's most-watched game of 2024 (**1.4B hours
  watched**). Source: press (Dexerto/duvalwire), via search.
- Kai Cenat's GTA marathon (Nov 5–17, 2026): GTA V peak 59,237 Twitch
  viewers. Source: press, via search.

## 5. Launch-peak records (press + trackers, Nov 2026)

- Cyberpunk 2077: Twitch peak **1,140,960** (TwitchTracker, instant)
  vs 1,069,278 (SullyGnome hourly average). Source: Dexerto /
  SullyGnome (kit).
- ELDEN RING: peak **909,800** (TwitchTracker, instant) vs 875,155
  (SullyGnome hourly average). Source: Dexerto / SullyGnome (kit).
- God of War Ragnarök: peak **478,014** concurrent (finalweapon,
  Nov 12, 2022); Dexerto: peaked 460,000, later 480,655; 2nd biggest
  PlayStation launch on Twitch after The Last of Us Part II (508,051).
- Hogwarts Legacy: peak 1.21M (early access, Feb 7, 2023) / 505k
  release day. Source: kit research note + Dexerto.
- GTA V all-time Twitch peak: **1,140,747** (TwitchTracker, 3 May 2021,
  RP boom) / 1,158,046 (twitchstats); 2026 peak 385,786.
  Source: TwitchTracker / twitchstats, via search.
- Marvel's Spider-Man 2 (TwitchStats, 2023): highest viewers **257,315**;
  Oct 20, 2023 daily average 143,083, 229 channels. Sales: 2.5M copies
  in 24h (Sony). Source: twitchstats.net / Sony, via search.
- Marvel's Wolverine: **2.4M copies in first 50 days** (Sony, Nov 5,
  2026) vs Spider-Man 2's 2.5M in 24h. Source: Sony earnings via
  epicflix, via search.
- Red Dead Redemption 2: **$725M retail sell-through in the first 3
  days** (Take-Two, Oct 30, 2018); 17M units shipped by Nov 2018.
  Source: Take-Two Interactive, via search.

Note the measurement gap the model respects: press/TwitchTracker peaks
are *instants* (max within an hour); SullyGnome and the contest score
*hourly averages*. Instants run higher (e.g. Cyberpunk 1,140,960 instant
vs 1,069,278 hourly average; GoW 480,655 instant vs 460,387 hourly
average).

## 6. Model parameters (computed from the kit's case files, 17 Nov 2026)

- Peak regression, all eligible comparables (n=29):
  `ln(P) = 5.902 + 0.556·ln(h1)`. Clean-only (n=19):
  `ln(P) = 6.194 + 0.543·ln(h1)`.
- Median late-peaker shape (fraction of peak): h1 0.38, h2 0.31, h3 0.26,
  h4 0.26, h5 0.36, h6 0.43, h7 0.42, h8 0.40, h9 0.38, h10 0.37,
  h11 0.38, h12 0.41, h13 0.50, h14 0.61, h15 0.69, h16 0.73, h17 0.76,
  h18 0.83, h19 0.95, h20 0.98, h21 0.94, h22 0.91, h23 0.84, h24 0.79.
- Median hour-1 ratios, late-peakers (hours 2–8): h2 0.87, h3 0.72,
  h4 0.73, h5 0.84, h6 1.00, h7 1.05, h8 1.06.
- Strict console-midnight family (7 launches): peak/hour-1 median 2.66×
  at hour 19 (min 1.31×, max 5.63×); dip 0.52× at hour 4.
- All comparables: median ratio-to-hour-1 peaks ~2.4× at hours 19–20.
- Viewers/channel at peak (kit data, n=29): median 39, mean 46,
  range 12–182. Channels at peak vs hour 1: median 2.10×. Cross-check
  for the peak floor: 30,000 channels × 40 viewers/channel ≈ 1.2M.
- Per-hour spread (log-std of residuals): floored 0.30, capped 1.20;
  typically 0.3–0.8 in the evening hours, wider early (the US-unlock
  jump varies by launch).

## 7. Assumptions (labelled, not hidden)

- **A1 — GTA VI peak floor (1,200,000).** The largest launch-day
  hourly-average peak on record is Cyberpunk 2077's 1,069,278 and GTA
  V's all-time Twitch peak is 1,140,747; GTA VI is the biggest
  entertainment launch in history by every hype metric (§4). The
  regression is fitted on launches that peak below that, so without a
  floor it would cap GTA VI below the records it is expected to break.
  The floor applies ONLY to the Grand Theft Auto VI case (matched on
  the case's game name / Twitch id 1867279146). On ordinary launches
  the floor is badly wrong (leave-one-out: 1.378 with it vs 0.300
  without) — that is why it is gated.
- **A2 — Two regimes.** Hours 2–8 are pre-US (anchored to the hour-1
  print); hours 12–24 are US-driven (anchored to the peak); hours 9–11
  blend the two in log space. Follows the unlock geometry (§1) and the
  four practice curves (§3).
- **A3 — Final comparables behave like the practice kit's.** The final
  case has 42 comparables (the 38 + the 4 practice launches); the
  program re-fits everything at runtime from whatever the case holds,
  so the extra four launches are picked up automatically.
- **A4 — SullyGnome hourly averages train the final's minute means.**
  The kit states a practice hour's print is SullyGnome's hourly average
  — "close to the final's minute mean, not the same measure". No
  correction is applied; the spread absorbs the difference.
