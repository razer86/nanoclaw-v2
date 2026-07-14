# v1 fork reference

Stashed during the v1 → v2 migration (2026-07-14). This install's v1 checkout (`/home/localadmin/nanoclaw`) was a customized fork — see `git log --oneline upstream-nanocoai/main..HEAD` there for the full commit history (70 commits, mostly upstream-sync merges plus real additions: Gmail channel integration via a separate repo, a Bring! shopping-list skill, replacement of a Google Tasks skill).

Nothing here is wired into the live v2 install. Reinstall deliberately if you want any of it back — check for v1-only path/mechanism references first (`/workspace/group/`, `/workspace/project/`, `/workspace/ipc/`, `/workspace/extra/`, `registered_groups`/`is_main`, the v1 sender allowlist, `store/messages.db`) since none of those resolve in v2.

## container-skills/

Four container skills that were live in v1 and got carried into `container/skills/` by the deterministic migration step, then stashed here instead of left live:

- **bring-shopping/** — manages the family shopping list via the Bring! API. Was actively referenced in `groups/discord_main/preferences.md` ("Shopping List" section) as the live mechanism; that file was updated to note the skill is no longer installed. Reinstall by moving this folder back to `container/skills/bring-shopping/` and restarting the service.
- **capabilities/** — generic `/capabilities` command, channel-agnostic, no external dependencies.
- **status/** — generic `/status` health-check command, channel-agnostic, no external dependencies.
- **slack-formatting/** — Slack mrkdwn formatting skill. Not applicable to this install (no Slack channel wired); would come back automatically if `/add-slack` is ever run, since it's channel-installed in v2's standard model.

## Not ported

Source-level changes (`src/*`, `container/agent-runner/src/*`) from the v1 fork were **not** carried over — v2's architecture is fundamentally different (see `docs/v1-to-v2-changes.md`). If you need to recover what any of that code did, check the v1 checkout directly; it's untouched.
