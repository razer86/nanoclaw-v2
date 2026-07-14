# v1 → v2 migration — 2026-07-14

v1 install: `/home/localadmin/nanoclaw` (v1.2.45, customized fork — Discord + Gmail channels, `bring-shopping` skill).

## What `migrate-v2.sh` did automatically

DB seeding, group folder copy (`main`/`discord_main`/`global` → v2's `CLAUDE.local.md` model), session data + conversation history, WhatsApp/Baileys not applicable, container skills copy, container image build attempt (failed — see below), OneCLI auth.

## Blockers found and fixed during this session

1. **Container image never built.** Docker's legacy builder doesn't support the Dockerfile's `--mount=type=cache` syntax; `docker-buildx` wasn't installed on this host. Fixed: `sudo apt-get install -y docker-buildx`, rebuilt.
2. **Host disk filled to 0 bytes** during the build retry (chromium/node layers), which also crashed the OneCLI Postgres container mid-write (auto-recovered). Fixed: freed space via `docker builder prune -af` + image cleanup after diagnosis, with the user's help since the Bash tool itself couldn't run while disk was full.
3. **No channel adapter installed** — `2a-channels-selected.txt` was empty even though the DB had a `discord` messaging group wired and `DISCORD_BOT_TOKEN` was already in `.env` from v1. Fixed: ran `/add-discord`, derived `DISCORD_APPLICATION_ID`/`DISCORD_PUBLIC_KEY` from the existing token via the Discord API, restarted.
4. **OneCLI server was 3 months stale** (`ghcr.io/onecli/onecli:latest` pulled in April) and only exposed `/api/agents`, while the bundled `@onecli-sh/sdk@2.2.1` calls `/v1/agents` — every container spawn 404'd. Fixed: `docker compose pull && up -d` in `~/.onecli`; both pre-existing agent records survived (state lives in Postgres, not the container).
5. **`setup/migrate-v2/tasks.ts` was broken in two independent ways**, both now fixed in the script itself (not just worked around):
   - Imported `insertTask` from `src/modules/scheduling/db.ts`, which now only exports `insertTaskRow` with a different shape (tasks fire into an isolated per-series system session — `resolveTaskSession`/`system:tasks:<seriesId>` — not a chat session resolved by messaging group/platform). Rewrote the script to match.
   - `toCron()`'s interval branch expected a suffixed string like `15m`, but v1 actually stores raw milliseconds for interval tasks (confirmed against v1's own `task-scheduler.ts`). Fixed the conversion.

## Owner and access

- Owner: `discord:208415996971712512` (Gabriellus) — granted global `owner` role.
- Also added as an `agent_group_members` row (belt-and-suspenders; owners bypass the sender-policy check anyway).
- `unknown_sender_policy` set to `request_approval` on the Discord messaging group. v1 message history showed other "senders" in the chat, but they were email addresses (`ray.slater86@gmail.com` etc.) from a notification-forwarding flow, not real Discord users — not seeded as members.

## CLAUDE.local.md cleanup

- `groups/main/` was an orphaned v1 template folder (v1's `registered_groups` only ever had `discord_main`, which was `is_main=1` and used `groups/main/CLAUDE.md` as its template) — deleted.
- `groups/discord_main/CLAUDE.local.md` stripped down to just the "Andy" identity paragraph and the "Email Notifications" Gmail-labeling section (all other sections were stock v1 boilerplate now covered by v2's own `.claude-fragments/module-*.md`).

## Fork skills (v1 was a customized fork)

`container/skills/bring-shopping`, `capabilities`, `slack-formatting`, `status` were copied into `container/skills/` by the deterministic migration step. Per the user's choice, all four were stashed to `docs/v1-fork-reference/container-skills/` (not reinstalled) — see that folder's README for details and reinstall notes. Stale physical copies already materialized in the running session's `.claude-shared/skills/` (including a leftover `google-tasks` skill v1 had already retired) were cleaned up to match.

`groups/discord_main/preferences.md` was updated to note the shopping-list workflow (`bring-shopping`) is not currently installed, since the agent's own memory referenced it as live.

## Container config

No `additionalMounts`, no `.v1-container-config.json` parse-failure sidecar, no `env`/`packages` fields to reconcile. Clean.

## Scheduled tasks

One active v1 task migrated (`task-1776671615840-z2ta8u`, 15-min interval → `*/15 * * * *`). **Paused after migration** — its pre-check script hardcodes v1-only paths (`/workspace/project/node_modules/googleapis`, `/home/node/.gmail-mcp/` raw OAuth files) that don't exist in v2's container layout or credential model. Resume once Gmail is wired up properly in v2 via `/add-gmail-tool` and the script is rewritten against OneCLI-managed credentials instead of a file-based token.

## Verified

- `pnpm exec tsx setup/index.ts --step verify` → `STATUS: success`, Discord configured, 1 registered group, mount allowlist configured.
- End-to-end: sent a real Discord DM, bot responded.
