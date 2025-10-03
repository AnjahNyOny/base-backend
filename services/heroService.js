// services/heroService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

/** GET agrégé — inchangé */
export async function getHeroByPageId(pageId) {
  const [rowsTitle] = await db.query(
    `
      SELECT id, titre, description, date_publication, page_id, type
      FROM contenu
      WHERE page_id = ? AND type IN ('hero_title','hero')
      ORDER BY FIELD(type,'hero_title','hero') ASC
      LIMIT 1
    `,
    [pageId]
  );
  const title = rowsTitle?.[0] || null;

  if (!title) return { title: null, buttons: [], images: [] };

  const [rowsButtons] = await db.query(
    `
      SELECT id, contenu_id, label, action
      FROM ContenuBouton
      WHERE contenu_id = ?
      ORDER BY id ASC
    `,
    [title.id]
  );
  const buttons = rowsButtons || [];

  const [rowsImages] = await db.query(
    `
      SELECT id, contenu_id, image_url, alt
      FROM ContenuImage
      WHERE contenu_id = ?
    `,
    [title.id]
  );
  const images = rowsImages || [];

  return { title, buttons, images };
}

/** PUT bulk — durci */
export const updateHero = async (payloadRaw) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const heroTitle = payloadRaw?.heroTitle || payloadRaw?.heroContent || null;
    const heroButtons = Array.isArray(payloadRaw?.heroButtons) ? payloadRaw.heroButtons : [];
    if (!heroTitle || !Number(heroTitle.id)) {
      throw new Error("Payload invalide: 'heroTitle.id' est requis.");
    }

    const titre = typeof heroTitle.titre === "string" ? heroTitle.titre : "";
    const description = typeof heroTitle.description === "string" ? heroTitle.description : "";
    const formattedDate = heroTitle?.date_publication
      ? formatDateForMySQL(heroTitle.date_publication)
      : formatDateForMySQL(new Date());

    // 1) Update titre
    await conn.query(
      `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
      `,
      [titre, description || null, formattedDate, heroTitle.id]
    );

    // 2) Upsert boutons
    //    On sécurise aussi par contenu_id pour éviter tout update croisé
    for (const btn of heroButtons) {
      const id = Number(btn?.id) || null;
      const label = typeof btn?.label === "string" ? btn.label : "";
      const action = (typeof btn?.action === "string" ? btn.action : "").trim();

      if (id) {
        // UPDATE si existe et appartient au bon contenu
        await conn.query(
          `
            UPDATE \`ContenuBouton\`
            SET \`label\` = ?, \`action\` = ?
            WHERE \`id\` = ? AND \`contenu_id\` = ?;
          `,
          [label, action || null, id, heroTitle.id]
        );
      } else {
        // INSERT si pas d'id
        await conn.query(
          `
            INSERT INTO \`ContenuBouton\` (\`contenu_id\`, \`label\`, \`action\`)
            VALUES (?, ?, ?);
          `,
          [heroTitle.id, label, action || null]
        );
      }
    }

    // (Optionnel) Synchronisation stricte : supprimer les anciens non renvoyés
    // const idsInPayload = new Set(heroButtons.map(b => Number(b?.id)).filter(Boolean));
    // await conn.query(
    //   `DELETE FROM \`ContenuBouton\` WHERE \`contenu_id\` = ? AND \`id\` NOT IN (${[...idsInPayload].join(',') || 0})`,
    //   [heroTitle.id]
    // );

    // 3) Relecture des boutons “source de vérité”
    const [rowsButtons] = await conn.query(
      `
        SELECT id, contenu_id, label, action
        FROM \`ContenuBouton\`
        WHERE \`contenu_id\` = ?
        ORDER BY id ASC
      `,
      [heroTitle.id]
    );

    await conn.commit();

    return {
      message: "Section Hero mise à jour avec succès.",
      updatedTitle: { id: heroTitle.id, titre, description },
      buttons: rowsButtons || [],
    };
  } catch (error) {
    await conn.rollback();
    console.error("[ERROR] updateHero:", error);
    throw error;
  } finally {
    conn.release();
  }
};

export const deleteHero = async (id) => {
  try {
    await db.query(`DELETE FROM contenu WHERE id = ?`, [id]);
    return { message: "Élément supprimé avec succès." };
  } catch (error) {
    console.error("[ERROR] deleteHeroComponent:", error.message);
    throw error;
  }
};

export async function createHero({ titre, description, page_id }) {
  const formattedDate = formatDateForMySQL(new Date());
  const [result] = await db.query(
    `
      INSERT INTO contenu (type, titre, description, date_publication, page_id)
      VALUES (?, ?, ?, ?, ?)
    `,
    ["hero_title", titre, description ?? null, formattedDate, page_id]
  );

  return {
    id: result.insertId,
    titre,
    description: description ?? null,
    type: "hero_title",
    date_publication: formattedDate,
    page_id,
  };
}