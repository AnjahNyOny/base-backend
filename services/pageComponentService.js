import db from "../config/db.js";

export async function fetchPageComponentsByPageId(page_id) {
  const [rows] = await db.query(
    `SELECT code, is_enabled, sort_order, config_json
       FROM page_component
      WHERE page_id = ?`,
    [page_id]
  );
  return rows || [];
}

export async function upsertComponentsForPage(page_id, items = []) {
  if (!items.length) return;

  for (const raw of items) {
    const code = String(raw?.code || "").trim();
    if (!code) continue;

    const is_enabled = raw?.is_enabled ? 1 : 0;
    const sort_order = raw?.sort_order ?? null;
    const cfg = raw?.config_json ?? null;
    const cfgStr = cfg ? JSON.stringify(cfg) : null;

    await db.query(
      `
      INSERT INTO page_component (page_id, code, is_enabled, sort_order, config_json)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        is_enabled = VALUES(is_enabled),
        sort_order = VALUES(sort_order),
        config_json = VALUES(config_json),
        updated_at  = CURRENT_TIMESTAMP
      `,
      [page_id, code, is_enabled, sort_order, cfgStr]
    );
  }
}

export async function upsertOneComponentForPage(
  page_id,
  { code, is_enabled = 1, sort_order = null, config_json = null }
) {
  const cfgStr = config_json ? JSON.stringify(config_json) : null;
  await db.query(
    `
    INSERT INTO page_component (page_id, code, is_enabled, sort_order, config_json)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      is_enabled = VALUES(is_enabled),
      sort_order = VALUES(sort_order),
      config_json = VALUES(config_json),
      updated_at  = CURRENT_TIMESTAMP
    `,
    [page_id, code, is_enabled ? 1 : 0, sort_order, cfgStr]
  );
}
