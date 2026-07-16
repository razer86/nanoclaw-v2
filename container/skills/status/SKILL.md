---
name: status
description: Quick read-only health check — session context, workspace mounts, tool availability, configured MCP servers, and task snapshot. Use when the user asks for system status, "status check", or runs /status.
---

# /status — System Status Check

Generate a quick read-only status report of the current agent environment.

## How to gather the information

Run the checks below and compile results into the report format. This is a
snapshot of what's mounted and installed, not a live connectivity test —
don't claim a tool or MCP server is "down" just because it's listed here;
only report a problem if a check below actually fails.

### 1. Session context

Channel/destination name comes from the runtime system prompt at the top of
this turn, not the filesystem — read it from there.

```bash
echo "Timestamp: $(date)"
echo "Working dir: $(pwd)"
```

### 2. Workspace and mount visibility

```bash
echo "=== Session root (/workspace) ==="
ls /workspace/ 2>/dev/null
echo "=== Group workspace (/workspace/agent) ==="
ls /workspace/agent/ 2>/dev/null | head -20
echo "=== Memory tree ==="
find /workspace/agent/memory -maxdepth 2 2>/dev/null
echo "=== Extra mounts ==="
ls /workspace/extra/ 2>/dev/null || echo "none"
```

### 3. Tool availability

Confirm which tool families are available to you:

- **Core:** Bash, Read, Write, Edit, Glob, Grep
- **Web:** WebSearch, WebFetch
- **Messaging:** `mcp__nanoclaw__send_message`, `send_file`, `add_reaction`, `create_agent`
- **Interactive:** `mcp__nanoclaw__ask_user_question`, `send_card`
- **Admin CLI (`ncl`):**

```bash
which ncl >/dev/null 2>&1 && echo "ncl: available" || echo "ncl: missing"
```

- **OneCLI credential gateway** (see the `onecli-gateway` skill for how it's used):

```bash
[ -n "$HTTPS_PROXY" ] && echo "OneCLI proxy: configured" || echo "OneCLI proxy: not set"
```

### 4. Container utilities

```bash
which agent-browser >/dev/null 2>&1 && echo "agent-browser: available" || echo "agent-browser: not installed"
node --version 2>/dev/null
bun --version 2>/dev/null
claude --version 2>/dev/null
```

### 5. Configured MCP servers

Extra MCP servers (beyond the built-in `nanoclaw` tools) are listed in your
`container.json`:

```bash
cat /workspace/agent/container.json 2>/dev/null | grep -A5 '"mcpServers"'
```

Report each by name as "configured" — this reads static config, not live
connection state, so don't call one "connected" or "down" from this alone.

### 6. Task snapshot

```bash
ncl tasks list
```

If no tasks exist, report "No scheduled tasks."

## Report format

Present as a clean, readable message:

```
🔍 *NanoClaw Status*

*Session:*
• Channel: <from the runtime system prompt>
• Time: 2026-03-14 09:30 local
• Working dir: /workspace/...

*Workspace:*
• Group workspace: ✓ (N files)
• Memory tree: ✓ (N files/folders) / not yet scaffolded
• Extra mounts: none / N entries

*Tools:*
• Core: ✓  Web: ✓  Messaging: ✓  Interactive: ✓  ncl: ✓  OneCLI proxy: ✓

*Container:*
• agent-browser: ✓ / not installed
• Node: vXX.X.X   Bun: vX.X.X
• Claude Code: vX.X.X

*MCP Servers:*
• <name>: configured (× N) / none configured

*Scheduled Tasks:*
• N active tasks / No scheduled tasks
```

Adapt based on what you actually find. Keep it concise — this is a quick
health check, not a deep diagnostic.
