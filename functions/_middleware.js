let migrationsDone = false;

async function ensureMigrations(env) {
  if (migrationsDone) return;
  if (!env || !env.DB) return;
  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('projects') WHERE name = 'image_r2_key'"
    ).first();
    if (row && row.cnt === 0) {
      await env.DB.prepare(
        "ALTER TABLE projects ADD COLUMN image_r2_key TEXT"
      ).run();
    }
    migrationsDone = true;
  } catch (e) {
    // ignore — retry on next request
  }
}

export async function onRequest(context) {
  await ensureMigrations(context.env);
  return context.next();
}
