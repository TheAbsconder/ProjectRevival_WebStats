# Phase 2: real completed-round statistics

## Deployment and validation status

1. **Compile repair validated:** silent Workbench compilation passed with exit code 0 after fixing the accounting check's record ownership and the explicit return path in `PR_WS_Player.Team`. No script errors remain; 14 vanilla deprecation warnings remain. Gameplay hooks still require dedicated-server testing.
2. Redeploy **both** `site/functions` and `site/public` from `site/` using the existing Pages deployment command. The API must be deployed before Phase 2 uploads because it now accepts `schemaVersion: 2`. No migration or database redesign is required; retain the existing `matchName` column, DB binding and secret.
3. Publish/update the addon from the actual Workbench project, then update the dedicated server. Existing `WebStats.json` endpoint/token/scenario mappings still work. Optional `"debugLogging": true` runs isolated accounting checks once on startup and enables concise PvP/supply diagnostics. Default is false. Do not replace your active config with the example.
4. Run the gameplay checklist below and complete a real test round. Check the saved recovery JSON, API detail and website. Nothing uploads or exposes statistics through this addon during an active round.

Nine local Node API/format regression tests passed, including legacy schema 1, schema 2, faction/relationship preservation, retries, authentication, large populated snapshots and D1 row capacity. The 390px headless Edge test passed for old/new snapshots, comparison selection, rival cards, dates, leaderboard cards and Discord link. These tests do **not** execute the Enforce event hooks. Optional engine accounting checks are implemented but have not run yet.

## Definitions

- Identity is exact display name, within this round only. Equal names merge. A changed name gets a separate record when next observed by an event or at completion. Connections use transient player IDs, cleared on disconnect; there are no persistent identity/GUID records. Same-name rivals are omitted because names cannot distinguish them.
- `overall` includes all supported factions; `US` and `USSR` get event-time faction credit. Counts sum; maxima such as streak/longest life are maxima, not additive. Kills use actual entity affiliation, not disguise appearance. Missing/unknown hostility gets no enemy kill award. No periodic stat polling.
- Player Kills = enemy human character kills. AI Kills = enemy AI character kills, including FIA, opposing US/USSR AI and other hostile AI factions. Friendly kills go only to Friendly Fire Kills (same US/USSR faction, no self-kills). Unknown/neutral kills do not inflate enemy counts.
- `fiaAiKills` is the FIA subset; `otherTeamAiKills` is the opposing playable US/USSR AI subset. These do not necessarily sum to `aiKills` when a mod adds other hostile AI factions. AI labels stay neutral for old snapshots; Phase 2 rows expose these new breakdowns. Player-side buckets are not victim-side buckets.
- KD = enemy player kills / all player deaths. With zero deaths, KD equals player kills (0 if both zero); never Infinity/NaN.
- Kill Streak = highest consecutive enemy player kills in one observed life. AI/friendly kills do not increase or reset it; death, respawn or disconnect resets it. US/USSR streaks count that faction's contribution within the same life. Active life/streak history does not survive reconnects/server restarts.
- Longest Kill = a **direct kinetic bullet character kill** linked to the observed rifle/sniper/MG/handgun projectile and firing position. Mounted MG bullets qualify when that operator's projectile event is exposed. Explosions, fragments, mines, grenade/rocket launchers, autocannon shells, melee, vehicle collision and later bleed-out do not qualify. No generic owner-to-victim distance estimate. Shell/cannon rounds are deliberately excluded from the bullet definition.
- Headshots = lethal kinetic hit to the HEAD hit-zone group; not every head hit. Requires the lethal callback to observe that exact current damage context. Later bleed-out is not a headshot. Hit provenance is invalidated on each subsequent damage context and on hijacked/cancelled damage.
- Death categories are **exclusive**, with precedence: observed direct vehicle collision → explosive/fragmentation → non-self human killer → AI killer → Other Deaths. Vehicle explosions are explosive, not road kills. `deathsToFiaAi` / `deathsToOtherTeamAi` are subsets of the primary AI-death category; an AI-fired rocket can instead be an explosive death. All deaths still increment Deaths, including suicide/unattributed gameplay deaths. Editor deletion/GM kill events are excluded.
- Weapon categories are exclusive: road → melee → RPG/LAW-type rocket launcher → thrown frag grenade → remaining explosives. Grenade-launcher rounds fall under remaining explosives. Launcher character kills are Anti-Tank Weapon Kills, not vehicles destroyed or Longest Kill. Missing weapon provenance can leave a kill in generic explosives; it never invents a specific weapon.
- LAV/BTR Kills = character kills from the player's observed weapon rooted in an APC-type vehicle (vanilla `EVehicleType.APC`), not any kill while riding in an APC. Includes enemy player and AI kills, with `lavBtrPlayerKills` and `lavBtrAiKills` subsets. Compatible custom APCs may also qualify. Gunner attribution comes from the firing event; no credit is assigned automatically to the driver or passenger. These vehicle-weapon counts may overlap the weapon cause category.
- Vehicle destruction uses the engine's credited player, independently of character kills. Helicopters use their simulation component; armour uses APC type; light vehicles use car/truck/support-truck flags. Unknown vehicle types are omitted. This counts credited vehicle destruction regardless of vehicle faction; no blanket fallback classifies every unknown object as a light vehicle.

## Supplies

Only authoritative vanilla vehicle Load/Unload actions are observed, around their original behavior. Both container queues are refreshed, then actual source removal and destination addition must match. Partial quantities count. The **unloader** receives delivery credit, even if another player loaded it. Loading from a vehicle source is supported; destination containers may also be vehicles. Intermediate transfers are individual deliveries, not a global cargo-ownership system.

Loaded lots retain source identity/base and position. Unloading back into the same loading base/source or within 25m of the loading position does not count. Construction consumption reduces oldest tracked cargo without erasing the remaining origin. Preloaded cargo, unexplained additions and pre-restart cargo have unknown origins and receive no delivery credit. A successful observed loading action creates new known-origin lots. Dropping crates, inventory transfers and mod-specific actions that bypass these vehicle actions are untracked. No attempt is made to infer them from movement or inventory polling. Ledgers are bounded at 512 containers/128 lots per container; overflow drops provenance rather than inventing credit.

## Medical, objectives and session timing

- Successful medical consumable effects on **other human players** count treatment actions: Morphine Given / Players Bandaged by consumable type; Players Healed counts all completed health-item treatments (including morphine/bandage/saline etc.), plus successful heal-station actions on another player. It is an action count, not unique patients or guaranteed restored hit points. AI/self treatments are excluded. Medical mods that bypass these vanilla paths are not inferred.
- Bases Captured uses vanilla's completed `SCR_XPHandlerComponent.OnBaseSeized` callback and same-faction living participants within the capture radius, not recurring BASE_SEIZED progress XP. It does not count defenders standing elsewhere. Vanilla distinguishes RELAY radio towers: these go into Radio Towers Captured with vanilla's 50m relay participation radius, and do not duplicate Bases Captured.
- Bases Defended follows successfully awarded vanilla BASE_DEFENDED XP; disabling/removing that award prevents this stat. Custom modes without the Conflict capture/defense callbacks report no such credit. No KOTH score/zone substitutes are invented.
- Time Connected accumulates registration/event-to-disconnection/completion intervals using world timestamps, split at observed faction/name changes. Paused simulation time does not increase it. Longest Life includes the current observed surviving life at completion/disconnection; full duration is credited to the faction at life end. Spawn/respawn starts a new life. No per-second counter/logging.

## Relationships, summaries, delivery

Per-player Killed and Killed By lists retain the internal `dominated` and `nemesis` fields and contain only enemy human-vs-human kills. Each list keeps the Top 5; ties sort by exact player name. Round-wide leaderboards remain Top 3. Older Top-3 relationships and absent relationship fields remain supported. AI/friendly/self kills never create relationships. Round summary totals derive from recorded buckets; seven supplied leaderboards rank player kills, AI kills, highest streak, longest bullet kill, supplies, treatments and all vehicle destructions. Zero-score entries are omitted; there are no fake players to fill empty cards.

Stats are memory-only until completion, when the existing pipeline saves a secret-free recovery JSON and uploads one snapshot with `sampleData: false`, `schemaVersion: 2`. Restart/crash loses the current uncompleted session's data; persisted gameplay rounds are not reconstructed. Existing Phase 1 limitations on completion reasons, multiple in-place rounds and shutdown delivery remain. Legacy sample source/fixture is retained for compatibility tests but is no longer used by upload code.

The API accepts up to 4 MiB request envelopes, 1,024 name records and 1,900,000 bytes of serialized snapshot. That leaves room for metadata below [D1's 2,000,000-byte row limit](https://developers.cloudflare.com/d1/platform/limits/). Oversize uploads fail clearly with HTTP 413 and retain the local recovery file; data is never silently truncated. Projectiles are capped at 8,192, expire after 120 seconds and are cleaned during firing events at most once every five seconds. Missing/expired provenance omits precise distance/category credit. No per-bullet logging or accuracy data is stored.

## Dedicated-server test checklist

Enable debugLogging for this test. On startup, accounting checks should report `failures=0`. Use two real players, FIA AI, US/USSR AI, a truck, APC, helicopter and normal medical items. Inspect the **completed** recovery snapshot; console diagnostics are intentionally limited.

| Test | Expected |
|---|---|
| Enemy PvP, then friendly kill and suicide | Enemy Player Kills only for first; friendly/self excluded from rivals/streak; all gameplay deaths counted |
| Several enemy player kills, AI kill, death, another kill | AI does not increase streak; death resets current streak; highest value persists |
| Kill FIA then opposing-team AI; die to each | Correct AI subsets when primary cause is AI; explosives follow death precedence |
| Direct bullet head kill at known distance | Longest Kill approximately firing-to-impact distance; Headshots increases once |
| Place mine, travel far away, trigger it; RPG/LAW blast | Neither increases Longest Kill; mine generic explosive, matched launcher Anti-Tank Weapon Kills |
| Frag grenade, melee and direct run-over | Distinct category; no duplicate generic explosive award for a matched grenade |
| BTR/LAV gunner kills while another player drives | Gunner only; correct player/AI subsets; portable rifle fired from a passenger seat is not an APC weapon |
| Destroy a car/truck, APC and helicopter | Correct independent vehicle totals; unsupported class not guessed |
| Unload preloaded truck, load 1,200 at A, deliver 400 at B, return remainder to A | Preloaded/return not credited; 400 credited to actual unloader |
| Another player loads; construction consumes some cargo; you deliver remaining known cargo | Unloader gets actual remaining delivered quantity; origins retained after consumption |
| Bandage/morphine/saline another player; repeat on self/AI; cancel a treatment | Completed other-player actions only; verify no client/server duplicate |
| Capture a base/relay and earn a defense award | Base and radio tower counters distinct; nearby same-faction capture participation; defense once per awarded vanilla event |
| Switch US→USSR, reconnect, die and finish alive | Counts credited at event faction; connected intervals accumulate; longest observed life retained |
| Repeated PvP across at least six opponents | Per-player Top 5 Killed/Killed By correct, deterministic ties; round leaderboards remain Top 3 |
| Complete legitimate round | No PlayerX/Y/Z placeholders; derived summary/leaderboards; one POST/row; retries idempotent |
| Browse old and new rounds; compare 1–3 players | Old missing rivals omitted; real rival cards match selected players; no live data visible |

If compile fails again, provide the **first errors**. If a category fails in gameplay, provide the completed recovery JSON plus relevant script log; neither should include the auth token.

## Phase 2.1 fixes and validation

- Production snapshot assembly emits the fixed JSON literal `"sampleData":false` instead of registering an Enforce bool (which serialized as numeric 0). The API also normalizes legacy schema-2 numeric 0 to boolean false before storage. Schema-2 numeric 1/true remain invalid because these are production snapshots. Schema-1 behavior and unrelated validation remain unchanged.
- Round duration subtracts the game-mode instance start world timestamp from its completion world timestamp. Nonzero world uptime is not counted before the captured start. Paused simulation time is excluded; elapsed time with no connected players is included. Unix time remains only for completion dates/identifiers. The prior Unix wall-clock calculation does not by itself establish the cause of the reported 65,282 seconds; that historical value cannot be fully diagnosed from the supplied information.
- The startup test previously used `Now()-20` as life start. During early startup this is negative and correctly denotes no active life. Checks now supply fixed positive timestamps to the same accounting methods, covering duration offsets, faction splits, highest-streak preservation, and current-streak reset.
- Actual installed addon compiled successfully on October 13, 2026: exit 0, no WebStats errors, 14 vanilla obsolete-API warnings. All 11 Node/API tests passed, including untouched legacy numeric-0 input, boolean storage, five-entry relationships and the three-entry round-board limit. The headless 390px browser check passed for legacy and schema-2 rounds, up to three selected players, five-entry player lists and no JavaScript errors.
- Startup accounting checks were compiled but not executed in a running scenario. Dedicated-server verification is still required: enable `debugLogging`, confirm `failures=0`, complete a known-duration round, inspect its newly generated recovery file for boolean false, and upload that file untouched. Test real enemy/friendly/self/AI attribution and reconnect/name/faction behavior; the existing eligibility logic was preserved.
- Deploy the updated addon and the `site` Pages project (both static assets and API functions). No D1 migration or configuration schema change is required.
