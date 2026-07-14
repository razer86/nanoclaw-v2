#!/usr/bin/env node
/**
 * Bring! Shopping List CLI for NanoClaw container agents.
 *
 * Thin client over the Family Planner dashboard's Bring! API. The dashboard
 * (running on the kitchen RPi) handles Bring credentials, session management,
 * and German↔English translation.
 *
 * Usage:
 *   node bring-cli.mjs list
 *   node bring-cli.mjs add "Bread" [--note "Sourdough"]
 *   node bring-cli.mjs remove "Bread"
 *
 * Dashboard URL is configurable via FAMILY_PLANNER_URL env var
 * (defaults to http://192.168.100.156:3000).
 */

const BASE = (process.env.FAMILY_PLANNER_URL || 'http://192.168.100.156:3000').replace(/\/$/, '');
const TIMEOUT_MS = 8000;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ': ' + text : ''}`);
    }
    if (res.status === 204) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      flags[a.slice(2)] = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function cmdList() {
  const data = await fetchJson(`${BASE}/api/bring`);
  const purchase = data.purchase || [];
  const recently = data.recently || [];

  if (purchase.length === 0) {
    console.log('(shopping list is empty)');
  } else {
    console.log(`Shopping list (${purchase.length} item${purchase.length === 1 ? '' : 's'}):`);
    for (const item of purchase) {
      const note = item.specification ? `  — ${item.specification}` : '';
      console.log(`  ☐ ${item.name}${note}`);
    }
  }

  if (recently.length > 0) {
    console.log(`\nRecently used (${recently.length}):`);
    for (const item of recently.slice(0, 10)) {
      console.log(`  · ${item.name}`);
    }
    if (recently.length > 10) console.log(`  · …and ${recently.length - 10} more`);
  }
}

async function cmdAdd(name, specification) {
  if (!name) throw new Error('Usage: add <name> [--note "..."]');
  await fetchJson(`${BASE}/api/bring`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, specification: specification || '' }),
  });
  console.log(`Added "${name}"${specification ? ` (${specification})` : ''} to shopping list.`);
}

async function cmdRemove(name) {
  if (!name) throw new Error('Usage: remove <name>');
  await fetchJson(`${BASE}/api/bring/${encodeURIComponent(name)}`, { method: 'DELETE' });
  console.log(`Removed "${name}" (moved to recently used).`);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [cmd, ...rest] = positional;

  try {
    switch (cmd) {
      case 'list':
        await cmdList();
        break;
      case 'add':
        await cmdAdd(rest[0], flags.note);
        break;
      case 'remove':
      case 'complete':
      case 'bought':
        await cmdRemove(rest[0]);
        break;
      default:
        console.error('Usage:');
        console.error('  bring-cli.mjs list');
        console.error('  bring-cli.mjs add <name> [--note "..."]');
        console.error('  bring-cli.mjs remove <name>');
        process.exit(2);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
