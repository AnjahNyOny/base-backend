// services/buttonService.js
import db from "../config/db.js";

/** Sélection par contenu_id */
export async function getButtonsByContenuId(contenuId) {
  const [rows] = await db.query(
    `SELECT id, contenu_id, label, action
     FROM ContenuBouton
     WHERE contenu_id = ?
     ORDER BY id ASC`,
    [contenuId]
  );
  return rows || [];
}

/** Création */
export async function createButton({ contenu_id, label, action }) {
  const cid = Number(contenu_id);
  if (!Number.isFinite(cid) || cid <= 0) throw new Error("contenu_id invalide.");
  const lbl = (label || "").trim();
  if (!lbl) throw new Error("label requis.");

  const [res] = await db.query(
    `INSERT INTO ContenuBouton (contenu_id, label, action)
     VALUES (?, ?, ?)`,
    [cid, lbl, (action || "").trim() || null]
  );
  return { id: res.insertId, contenu_id: cid, label: lbl, action: (action || "").trim() || null };
}

/** Mise à jour */
export async function updateButton(id, { label, action }) {
  const bid = Number(id);
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("id invalide.");
  const lbl = (label || "").trim();
  if (!lbl) throw new Error("label requis.");

  await db.query(
    `UPDATE ContenuBouton SET label = ?, action = ? WHERE id = ?`,
    [lbl, (action || "").trim() || null, bid]
  );
  return { id: bid, label: lbl, action: (action || "").trim() || null };
}

/** Suppression */
export async function deleteButton(id) {
  const bid = Number(id);
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("id invalide.");
  await db.query(`DELETE FROM ContenuBouton WHERE id = ?`, [bid]);
  return { id: bid };
}

/** Bulk upsert par contenu_id (remplace/merge la liste) */
export async function upsertButtonsBulk(contenuId, buttons = []) {
  const cid = Number(contenuId);
  if (!Number.isFinite(cid) || cid <= 0) throw new Error("contenu_id invalide.");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // On récupère ceux existants pour savoir lesquels supprimer
    const [existing] = await conn.query(
      `SELECT id FROM ContenuBouton WHERE contenu_id = ?`,
      [cid]
    );
    const existingIds = new Set((existing || []).map(r => r.id));

    const seenIds = new Set();

    for (const b of buttons) {
      const id = Number(b?.id);
      const label = (b?.label || "").trim();
      const action = (b?.action || "").trim() || null;
      if (!label) continue;

      if (Number.isFinite(id) && id > 0) {
        // update
        await conn.query(
          `UPDATE ContenuBouton SET label = ?, action = ? WHERE id = ? AND contenu_id = ?`,
          [label, action, id, cid]
        );
        seenIds.add(id);
      } else {
        // insert
        const [res] = await conn.query(
          `INSERT INTO ContenuBouton (contenu_id, label, action) VALUES (?, ?, ?)`,
          [cid, label, action]
        );
        seenIds.add(res.insertId);
      }
    }

    // Supprimer les non vus (optionnel : “remplacement total”)
    const toDelete = [...existingIds].filter(x => !seenIds.has(x));
    if (toDelete.length) {
      await conn.query(
        `DELETE FROM ContenuBouton WHERE id IN (${toDelete.map(() => "?").join(",")})`,
        toDelete
      );
    }

    await conn.commit();
    return { contenu_id: cid, count: seenIds.size };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}