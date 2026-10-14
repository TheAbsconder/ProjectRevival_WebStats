# ProjectRevival_WebStats — Phase 2

**Current implementation:** server-only, event-driven real round statistics, schema version 2, with per-player Top-5 Killed/Killed By cards (internal `dominated`/`nemesis` fields). The existing completion → Pages → D1 → website architecture remains intact. No database migration is needed.

**Start with [PHASE2.md](PHASE2.md)** for exact definitions, limitations, deployment order and the server test checklist. The Phase 2 compile repair passed actual silent Workbench compilation (exit code 0): no script errors, 14 vanilla deprecation warnings. Nine API tests and the mobile browser check previously passed. Gameplay event attribution is not yet server-tested.

Updated addon files: `PR_WS_GameMode.c`, `PR_WS_Upload.c`; new `PR_WS_Models.c`, `PR_WS_Tracker.c`, `PR_WS_Combat.c`, `PR_WS_Damage.c`, `PR_WS_Supplies.c`, `PR_WS_Actions.c`, `PR_WS_Checks.c`. Example config adds optional `debugLogging` (false by default). Phase 1 sample code/fixture remains available but is no longer called by the upload pipeline.

The API accepts schemas 1 and 2. Existing sample snapshots remain readable. Redeploy Functions and public assets before publishing the Phase 2 addon. The following notes preserve the original Phase 1/1.5 setup history; **Phase 2 behavior and limits are defined in PHASE2.md**.

---

## Phase 1/1.5 setup reference (historical)

Independent Arma Reforger addon + Cloudflare Pages Functions + D1 + plain HTML/CSS/JavaScript. **All player statistics are fictional.** No gameplay stat hooks, live uploads, player identities, Discord integration, or dependencies on other Project Revival addons.

## Files and source location

- `mod/`: addon source and example config; GUID `6A982C521A3E3E65` is your existing blank project's GUID.
- Actual Workbench addon: `C:\Users\Mitch\Documents\My Games\ArmaReforgerWorkbench\addons\ProjectRevival_WebStats`. Supplied scripts are copied there as part of this delivery. **Publish from this folder.** Do not open both same-GUID copies in Workbench at once.
- `site/`: independent Pages project; `public/` is the static output, `functions/` is the API, `migrations/` is D1 SQL.
- `sample-round.json`: complete fixture usable for testing the API without Arma.
- Existing workspace `public/` PHP pages and DiscordRelay are not modified.

## 1. Cloudflare setup

### Existing deployment: Phase 1.5 update

Your D1 `rounds.matchName` column already exists. **Do not run a migration or add that column again.** Redeploy the updated `site/` (Functions and public assets), keeping the existing DB binding and secret. No migration files were changed or added. The fresh-install steps below are historical Phase 1 setup; Phase 1.5 additionally expects the existing `matchName` TEXT column. Only in-memory tests add it to simulate your database.

Publish the updated addon from your Workbench folder. In the server's active `$profile:ProjectRevival/WebStats.json`, replace the old single `mapName` setting with optional mappings:

```json
"scenarioNames": [
  {"scenarioId": "{YOUR_KOTH_GUID}Missions/YourKOTH.conf", "displayName": "KOTH"},
  {"scenarioId": "{YOUR_CONFLICT_GUID}Missions/YourConflict.conf", "displayName": "Kolguyev"}
]
```

Use actual scenario resources from the server configuration, not addon GUIDs. Full resources, braced resource GUIDs, or exact resource paths are accepted case-insensitively. Retain endpoint/token/serverId and restart after editing. Existing configs without mappings still work; the old `mapName` is ignored. This update never overwrites your active config or secrets.

Detection uses `GetGame().GetMissionHeader().GetHeaderResourceName()`; the world resource is stored separately. These methods were verified in the installed vanilla source and the [MissionHeader API](https://community.bistudio.com/wikidata/external-data/arma-reforger/ArmaReforgerScriptAPIPublic/interfaceMissionHeader.html). `round.scenarioId` and `round.matchName` are preserved in each JSON snapshot; SQL `matchName` is used by the round list. Old rows/old upload clients fall back to `map`, without rewriting historical snapshots.

Unmapped scenarios use the mission title, or a readable resource filename when the title is missing/a localization key, and emit one warning at upload. Without a mission header (e.g. direct World Editor play), the world resource identifies the session instead; it cannot distinguish multiple headers referencing that identical world. `map` is the world-file label and `worldResource` preserves its exact resource. Custom world filenames are **not necessarily the underlying terrain name**; no terrain guess or manual global map setting is used.

The original fake data has `aiKills`, `deathsToAI` and `totalAIKills`, but no definition or breakdown of victim AI factions. US/USSR player buckets describe the player's side, not the AI victim's side. Labels therefore remain neutral **AI Kills / Deaths to AI / Total AI Kills**. Before real tracking, decide whether these aggregate all AI and whether separate FIA/opposing-team counts are needed. Sample values and property names remain unchanged.

Dates use the browser's local timezone, English abbreviated months, year and AM/PM without seconds. Technical scenario/world identifiers remain in stored JSON but are omitted from the overview. No real statistics collection was added.

These steps are manual; no cloud resources have been created or deployed by this task.

From `site/`, using Node and Cloudflare Wrangler:

1. `npx wrangler login`
2. `npx wrangler d1 create project-revival-webstats`
3. Put the returned database UUID into `wrangler.toml` as `database_id`. Keep binding **DB**. Do not use a real upload secret in this file.
4. `npx wrangler d1 migrations apply DB --remote`
5. `npx wrangler pages project create project-revival-webstats` (choose your production branch).
6. `npx wrangler pages secret put UPLOAD_TOKEN --project-name project-revival-webstats`
   Enter a randomly generated secret of at least 32 characters. It is an application upload secret, not a Cloudflare API token or Discord webhook.
7. `npx wrangler pages deploy public --project-name project-revival-webstats`

Run deploy from **site/** so Wrangler includes the sibling `functions` directory. Do not deploy only the HTML through a dashboard drag-and-drop upload. For an existing Pages project, use its name consistently instead of creating a second project. With Git integration set root to `ProjectRevival_WebStats/site`, output directory to `public`, and no build command; check the DB binding and secret in production and redeploy after changes. Preview deployments need their own appropriate bindings/secrets; a separate test database is recommended.

The binding is declared in `wrangler.toml` and used as `context.env.DB`. If configuring through the dashboard instead, choose Settings → Bindings → D1, variable name **DB**, and the database above. Avoid inconsistent dashboard and Wrangler configurations.

Official references: [Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/), [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [Pages deployment commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/).

## 2. API smoke test

Open `/api/rounds`: initially it should return `{"rounds":[],"nextOffset":null}`. Use PowerShell below to upload the fixture. The secret is prompted rather than saved in the script:

```powershell
$secret = Read-Host 'UPLOAD_TOKEN' -AsSecureString
$plain = [System.Net.NetworkCredential]::new('', $secret).Password
$body = @{ authToken = $plain; payloadJson = Get-Content -Raw '..\sample-round.json' } | ConvertTo-Json -Depth 30
Invoke-RestMethod -Method Post -Uri 'https://YOUR-PROJECT.pages.dev/api/rounds' -ContentType 'application/json' -Body $body
Remove-Variable plain, body
```

This creates one intentionally fake round. Repeating the identical fixture returns success with `duplicate: true`, not another row. Change `roundId` and completion timestamp for a second distinct fixture. Do not put secrets in URLs or browser-side code.

## 3. Arma setup

1. Open the **actual Workbench addon** listed above. Compile, then publish and add it to the dedicated server mod list.
2. Start the scenario once. It creates `$profile:ProjectRevival/WebStats.json`.
   On your host, where `$profile:` resolves to `Profile/profile/`, this is **`Profile/profile/ProjectRevival/WebStats.json`**.
3. Set `baseUrl` to the HTTPS Pages origin ending in `/`, `uploadPath` to `api/rounds`, and `authToken` to the same secret configured as `UPLOAD_TOKEN` in Pages. Set a unique `serverId` per dedicated server and optional `scenarioNames` mappings (see below). The example file is not the active config.
4. Restart to load the configuration. Look for `[PR WebStats] Phase 1 ready`.
5. Join and spawn a human player; finish the round through a faction score/time victory. An explicit GM faction victory with winner data is also accepted for testing. Merely stopping the world is not a completion.
6. Look for `[PR WebStats] Completed sample round stored in D1 (acknowledged).` Reload the website or select **Refresh rounds**; the newest stored round is automatically selected. No manual JSON copying into the website is needed.

## Completion and delivery semantics

- Uses `SCR_BaseGameMode.OnGameModeEnd(endData)` and explicit `GetWinnerFactionId()`, following DiscordRelay's event/winner approach. Vanilla Conflict emits `ENDREASON_SCORELIMIT`.
- Requires a recognized score/time faction completion or `EDITOR_FACTION_VICTORY`, a winner, elapsed session time, and an observed connected human spawn. There is no completion upload from `OnGameEnd`, restart, shutdown, undefined/neutral end, or an empty server without observed participation.
- Conservative Phase 1 limitation: draws, custom completion reasons, a resumed session with no observed human spawn, and in-place multiple rounds without a new game-mode instance are not handled. No winner is inferred from shutdown. Explicit GM victory is accepted; simply stopping the scenario is ignored.
- Winner/time are real completion metadata; scenario and world resource are detected automatically. Duration is elapsed time since this game-mode instance started, not a reconstructed persisted round duration. PlayerX/Y/Z, faction splits, summary and supplied leaderboard order are premade sample data.
- One snapshot per game-mode instance; at most three upload attempts, 3 seconds between retryable failures. HTTP 401/400/409 do not retry. No periodic live upload or gameplay-stat collection.
- REST uses the known DiscordRelay callback-registration pattern and a JSON body envelope `{authToken, payloadJson}`. The extra JSON string lets Enforce serialize the secret safely without constructing dozens of temporary stat classes. The API also accepts `{authToken, payload}` for normal JSON clients.
- Arma sends `round.mapName` because `map` is an Enforce type name, plus Unix completion time. The API normalizes these to public `round.map` and UTC `completedAt`. Other snapshot fields, including all faction buckets, are retained. Authentication is never stored in D1 or returned by GET.
- Unique `roundId` gives idempotent retries. Reusing an ID with different data yields HTTP 409. There is one D1 row per completed snapshot, not per statistic.
- A **secret-free** recovery JSON is saved under `$profile:ProjectRevival/logs/WebStats-*.json`. If teardown occurs before HTTP completes, upload that exact file through the smoke-test command instead of the fixture. No automatic restart replay/outbox is implemented in Phase 1. Keep a post-victory delay of at least 30 seconds for testing, since hard process shutdown can interrupt any HTTP request.

## Website/API behavior

- `POST /api/rounds`: auth, 256 KiB request bound, schemaVersion 1 validation, metadata extraction, parameterized insert, idempotent acknowledgement.
- `GET /api/rounds?offset=0`: newest completion first, 100 metadata rows per page and `nextOffset`. Website offers Load older rounds.
- `GET /api/rounds/:id`: entire stored payload; invalid IDs get 400, missing rounds 404.
- Public reads are intentionally unauthenticated and uncached. Same-origin browser requests need no CORS configuration.
- Start with one player, add up to three distinct players, remove columns. Overall buckets only; US/USSR remain in the stored JSON and round summary.
- Comparison rows are the union of available JSON category/property names. Missing fields display `—`, true zero stays `0`, unknown numeric stats appear automatically. Table colors identify columns only; they do not rate performance. Top 3 cards follow the supplied ordering.
- Narrow screens can scroll the comparison table horizontally. Join Discord is at the top.

## Validation and troubleshooting

Local Node tests use the production API handler with an in-memory SQLite adapter: insert/read, faction preservation, auth exclusion, duplicate/conflicting IDs, malformed/oversized bodies, missing IDs, configuration failure, Unix date normalization, ordering, and missing/future stats. Run `node --test tests/api.test.js` from `site/` (Node 24 or another release supporting `node:sqlite`). This is not a deployed Cloudflare/D1 test.

All six Phase 1.5 local API/format tests passed, including scenario metadata, legacy-row retries and same-world match names. A headless Edge check at a 390-pixel mobile width also passed: match/date labels, overview filtering, Refresh Rounds placement, header cleanup, stat labels, adding/removing comparison columns, three-player limit, leaderboard rendering and Discord link, with no browser JavaScript errors. No Workbench compile was run for Phase 1.5; scenario detection and mapping deserialization still need a real server/Workbench check.

One Workbench validation run found the Enforce reserved name `map`. The field was renamed to `mapName` with API normalization. **Corrected scripts have not been recompiled**; no second compile attempt was made. Dedicated-server completion, REST callbacks and deployed Pages/D1 remain untested until the manual steps above are performed.

Troubleshooting:

- No config: confirm this addon/version is loaded, a scenario started, and you are checking the server's actual profile path. Only the authority creates it.
- No upload: check ready/ignored-end messages, spawn a human, and use a recognized faction victory. Do not stop Workbench to simulate victory.
- HTTP 401: upload secrets differ. 400: invalid payload. 409: same round ID but changed snapshot. 413: over 256 KiB. 503: missing DB binding or missing/short UPLOAD_TOKEN. 500: apply migration/check D1 binding; Pages logs deliberately omit request/response bodies.
- HTML instead of API JSON: Functions were not deployed, the URL is wrong, or the static-only deployment omitted `functions/`.
- Existing fixture stays one row: expected idempotency. To inspect/delete test rows manually use D1 dashboard SQL, e.g. `SELECT id, round_key, completed_at FROM rounds ORDER BY id DESC;` and then `DELETE FROM rounds WHERE id = <the verified test id>;`. No automatic deletion or admin UI exists.

Future definitions preserved: longestKill is direct bullet character kills only (not launchers/explosives); lavBtrKills and antiTankWeaponKills are character kills, distinct from destroyed-vehicle counts. No future stat hooks or incapacitated-time tracking were implemented.
