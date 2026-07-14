/**
 * Structural guard for the Gmail MCP package-install integration point (container image).
 *
 * `@gongrzhe/server-gmail-autoauth-mcp` is a CLI binary installed into the image via
 * container/cli-tools.json (install-cli-tools.sh reads this manifest and pnpm-installs
 * each entry, pinned) — it is not importable or typed from this tree, so the build leg
 * can't catch its removal and there's no runtime seam to behavior-test. This asserts the
 * manifest still carries the pinned entry. Drop it and this goes red, signalling the agent
 * would boot without the `gmail-mcp` binary on PATH.
 */
import fs from 'fs';
import path from 'path';

import { describe, it, expect } from 'bun:test';

interface CliTool {
  name: string;
  version: string;
  onlyBuilt?: boolean;
}

function cliTools(): CliTool[] {
  // container/agent-runner/src/providers/ -> ../../../cli-tools.json == container/cli-tools.json
  const p = path.join(import.meta.dir, '..', '..', '..', 'cli-tools.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('container/cli-tools.json installs the Gmail MCP server', () => {
  const tools = cliTools();

  it('pins @gongrzhe/server-gmail-autoauth-mcp', () => {
    const entry = tools.find((t) => t.name === '@gongrzhe/server-gmail-autoauth-mcp');
    expect(entry).toBeDefined();
    expect(entry?.version).toBe('1.1.11');
  });

  it('pins the zod-to-json-schema workaround version', () => {
    const entry = tools.find((t) => t.name === 'zod-to-json-schema');
    expect(entry).toBeDefined();
    expect(entry?.version).toBe('3.22.5');
  });
});
