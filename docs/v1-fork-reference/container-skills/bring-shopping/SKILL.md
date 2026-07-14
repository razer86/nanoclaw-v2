---
name: bring-shopping
description: Manage the family shopping list on Bring! — list current items, add items, mark items as bought (remove). Use whenever the user asks about the shopping list or wants to add/remove groceries.
---

# Bring! Shopping List

Manage the family shopping list via the Family Planner dashboard's Bring! API. The dashboard handles credentials, German↔English translation, and session caching — this skill is a thin client.

The dashboard runs on the kitchen RPi at `http://192.168.100.156:3000`. It is the source of truth for what the family sees on the wall display and on their phones via the Bring! mobile app.

## Usage

```bash
# List current shopping items + recently used (tap-to-re-add chips)
node ~/.claude/skills/bring-shopping/bring-cli.mjs list

# Add an item — name should be the English-language item, plain
node ~/.claude/skills/bring-shopping/bring-cli.mjs add "Bread"
node ~/.claude/skills/bring-shopping/bring-cli.mjs add "Milk" --note "Full cream, 2L"

# Mark an item bought / remove from active list (moves to recently-used)
node ~/.claude/skills/bring-shopping/bring-cli.mjs remove "Bread"
```

## Workflow

1. When the user asks to add to the shopping list, just call `add` with the item name. No list ID needed — there is only one family list.
2. Item names are case-insensitive but use Title Case for readability ("Bread", "Tomatoes", not "bread", "TOMATOES").
3. The `--note` flag attaches a specification (brand, quantity, store) — visible on the wall display and the Bring! mobile app.
4. To "complete" an item (e.g. user says "I bought the bread"), use `remove`. Bring's model is: active list shows things to buy, removing moves them to "recently used" where they can be one-tapped back.
5. If `add` fails with HTTP 5xx, the dashboard service may be down — don't retry indefinitely, surface the failure.

## Notes

- Items added here appear instantly on phones via Bring's push and on the wall display within ~30s of polling.
- The dashboard handles German↔English translation under the hood. The Bring! app stores everything by German keys (Brot, Milch); the dashboard translates on read/write so icons/categories work correctly on phones. This skill speaks plain English — the dashboard does the translation.
- Replaces the previous `google-tasks` skill workflow. The "My Tasks" Google list is no longer the shopping list.
