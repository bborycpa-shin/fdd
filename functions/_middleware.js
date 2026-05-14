let migrationsDone = false;

async function ensureColumn(env, table, column, type) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM pragma_table_info('${table}') WHERE name = ?`
  )
    .bind(column)
    .first();
  if (row && row.cnt === 0) {
    await env.DB.prepare(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`
    ).run();
  }
}

async function ensureMigrations(env) {
  if (migrationsDone) return;
  if (!env || !env.DB) return;
  try {
    await ensureColumn(env, "projects", "image_r2_key", "TEXT");
    await ensureColumn(env, "projects", "color_index", "INTEGER");
    migrationsDone = true;
  } catch (e) {
    // ignore — retry on next request
  }
}

export async function onRequest(context) {
  await ensureMigrations(context.env);
  return context.next();
}
