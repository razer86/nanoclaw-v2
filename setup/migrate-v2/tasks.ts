/**
 * migrate-v2 step: tasks
 *
 * Port v1 scheduled_tasks into v2 task system sessions.
 *
 * v1: scheduled_tasks table (schedule_type, schedule_value, next_run)
 * v2: messages_in rows with kind='task' in the per-series task system session's
 *     inbound.db (thread `system:tasks:<seriesId>`, messaging_group_id NULL —
 *     tasks fire into an isolated session, not a chat session).
 *
 * Requires: db step must have run first (agent_groups seeded).
 *
 * Usage: pnpm exec tsx setup/migrate-v2/tasks.ts <v1-path>
 */
import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

import { DATA_DIR } from '../../src/config.js';
import { initDb, closeDb } from '../../src/db/connection.js';
import { getAgentGroupByFolder } from '../../src/db/agent-groups.js';
import { runMigrations } from '../../src/db/migrations/index.js';
import { insertTaskRow } from '../../src/modules/scheduling/db.js';
import { inboundDbPath, resolveTaskSession, withInboundDb } from '../../src/session-manager.js';

interface V1Task {
  id: string;
  group_folder: string;
  chat_jid: string;
  prompt: string;
  schedule_type: string;
  schedule_value: string;
  next_run: string | null;
  status: string;
  context_mode: string | null;
  script: string | null;
}

function toCron(t: V1Task): { processAfter: string; recurrence: string | null } | null {
  const now = new Date().toISOString();

  if (t.schedule_type === 'cron') {
    const fields = t.schedule_value.trim().split(/\s+/).length;
    if (fields < 5 || fields > 6) return null;
    return { processAfter: t.next_run || now, recurrence: t.schedule_value.trim() };
  }

  if (t.schedule_type === 'interval') {
    // v1 stores raw milliseconds for interval tasks (see task-scheduler.ts
    // computeNextRun: `parseInt(task.schedule_value, 10)`), not a suffixed
    // string — convert to the nearest cron-representable interval.
    const ms = parseInt(t.schedule_value.trim(), 10);
    if (!ms || ms < 1) return null;
    const minutes = Math.round(ms / 60_000);
    if (minutes < 1) return null;
    let cron: string | null = null;
    if (minutes < 60) cron = `*/${minutes} * * * *`;
    else if (minutes % 60 === 0 && minutes / 60 < 24) cron = `0 */${minutes / 60} * * *`;
    else if (minutes % 1440 === 0 && minutes / 1440 < 28) cron = `0 0 */${minutes / 1440} * *`;
    if (!cron) return null;
    return { processAfter: t.next_run || now, recurrence: cron };
  }

  if (t.schedule_type === 'once' || t.schedule_type === 'at') {
    return { processAfter: t.next_run || t.schedule_value || now, recurrence: null };
  }

  return null;
}

async function main(): Promise<void> {
  const v1Path = process.argv[2];
  if (!v1Path) {
    console.error('Usage: tsx setup/migrate-v2/tasks.ts <v1-path>');
    process.exit(1);
  }

  const v1DbPath = path.join(v1Path, 'store', 'messages.db');
  if (!fs.existsSync(v1DbPath)) {
    console.log('SKIPPED:no v1 DB');
    process.exit(0);
  }

  // Read v1 tasks
  const v1Db = new Database(v1DbPath, { readonly: true, fileMustExist: true });
  const allTasks = v1Db.prepare('SELECT * FROM scheduled_tasks').all() as V1Task[];
  v1Db.close();

  const activeTasks = allTasks.filter((t) => t.status === 'active');
  if (activeTasks.length === 0) {
    console.log('SKIPPED:no active tasks');
    process.exit(0);
  }

  // Init v2 central DB
  const v2DbPath = path.join(DATA_DIR, 'v2.db');
  if (!fs.existsSync(v2DbPath)) {
    console.error('v2.db not found — run db step first');
    process.exit(1);
  }
  const v2Db = initDb(v2DbPath);
  runMigrations(v2Db);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const t of activeTasks) {
    try {
      const ag = getAgentGroupByFolder(t.group_folder);
      if (!ag) { skipped++; continue; }

      const scheduling = toCron(t);
      if (!scheduling) { skipped++; continue; }

      // Tasks fire into an isolated per-series system session, not a chat
      // session — no messaging group or platform resolution needed.
      const { session } = resolveTaskSession(ag.id, t.id);
      if (!fs.existsSync(inboundDbPath(ag.id, session.id))) { skipped++; continue; }

      const alreadyMigrated = withInboundDb(ag.id, session.id, (db) => {
        const existing = db
          .prepare("SELECT id FROM messages_in WHERE id = ? AND kind = 'task'")
          .get(t.id) as { id: string } | undefined;
        if (existing) return true;

        insertTaskRow(db, {
          id: t.id,
          seriesId: t.id,
          processAfter: scheduling.processAfter,
          recurrence: scheduling.recurrence,
          content: JSON.stringify({
            prompt: t.prompt,
            script: t.script ?? null,
            migrated_from_v1: { original_id: t.id, context_mode: t.context_mode ?? null },
          }),
        });
        return false;
      });

      if (alreadyMigrated) { skipped++; continue; }
      migrated++;
    } catch (err) {
      failed++;
      console.error(`TASK_ERROR:${t.id}:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  closeDb();
  console.log(`OK:active=${activeTasks.length},migrated=${migrated},skipped=${skipped},failed=${failed}`);
}

main().catch((err) => {
  console.error(`FAIL:${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
