// controllers/imagesController.js
import db from '../config/db.js';

function isIconToken(v) {
  return typeof v === 'string' && v.trim().toLowerCase().startsWith('icon:');
}


// GET /api/images?contenu_id=123
export async function listImages(req, res) {
  try {
    const { contenu_id } = req.query;
    if (!contenu_id) return res.status(400).json({ message: "Paramètre 'contenu_id' requis." });

    const [rows] = await db.query(
      'SELECT id, contenu_id, image_url, alt, icon_alt FROM ContenuImage WHERE contenu_id = ?',
      [contenu_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[images] listImages error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}



// POST /api/images  { contenu_id, image_url, alt, icon_alt }
export async function createImage(req, res) {
  try {
    const { contenu_id, image_url, alt, icon_alt } = req.body || {};
    if (!contenu_id) return res.status(400).json({ message: "Champ requis: 'contenu_id'." });

    const url = (image_url ?? '').trim();
    const a   = (alt ?? '').trim();
    const ia  = (icon_alt ?? '').trim();

    // Accepter soit une image (url) soit une icône (icon_alt token)
    if (!url && !isIconToken(ia)) {
      return res.status(400).json({
        message: "Fournir 'image_url' (image) OU 'icon_alt' commençant par 'icon:'."
      });
    }

    const [result] = await db.query(
      'INSERT INTO ContenuImage (contenu_id, image_url, alt, icon_alt) VALUES (?, ?, ?, ?)',
      [contenu_id, url || null, a || null, ia || null]
    );

    res.status(201).json({
      id: result.insertId,
      contenu_id: Number(contenu_id),
      image_url: url || null,
      alt: a || null,
      icon_alt: ia || null,
    });
  } catch (err) {
    console.error('[images] createImage error:', err);
    res.status(500).json({ message: "Erreur serveur" });
  }
}


// PUT /api/images/:id  { image_url, alt, icon_alt }
export async function updateImage(req, res) {
  try {
    const { id } = req.params;
    const { image_url, alt, icon_alt } = req.body || {};
    if (!id) return res.status(400).json({ message: "Paramètre 'id' requis." });

    const url = (image_url ?? '').trim();
    const a   = (alt ?? '').trim();
    const ia  = (icon_alt ?? '').trim();

    if (!url && !isIconToken(ia)) {
      return res.status(400).json({
        message: "Fournir 'image_url' (image) OU 'icon_alt' commençant par 'icon:'."
      });
    }

    await db.query(
      'UPDATE ContenuImage SET image_url = ?, alt = ?, icon_alt = ? WHERE id = ?',
      [url || null, a || null, ia || null, id]
    );

    res.json({ id: Number(id), image_url: url || null, alt: a || null, icon_alt: ia || null });
  } catch (err) {
    console.error('[images] updateImage error:', err);
    res.status(500).json({ message: "Erreur serveur" });
  }
}


// DELETE /api/images/:id
export async function deleteImage(req, res) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM ContenuImage WHERE id = ?', [id]);
    res.json({ message: 'Image supprimée avec succès' });
  } catch (err) {
    console.error('[images] deleteImage error:', err);
    res.status(500).json({ message: "Erreur serveur" });
  }
}

/* ---------- Legacy aliases (inchangés) ---------- */

// GET /api/:contenuId/images
export async function legacyGetImagesByContenuId(req, res) {
  req.query.contenu_id = req.params.contenuId;
  return listImages(req, res);
}

// POST /api/:contenuId/images   body: { url, altText }
export async function legacyCreateImage(req, res) {
  const { contenuId } = req.params;
  const { url, altText } = req.body || {};
  req.body = { contenu_id: contenuId, image_url: url, alt: altText ?? null };
  return createImage(req, res);
}

// ✅ UPSERT souple (image OU icône) + delete si vide
// PUT /api/images/by-contenu/:contenuId
// export async function upsertImageByContenu(req, res) {
//   try {
//     const { contenuId } = req.params;
//     const { image_url, alt } = req.body || {};
//     if (!contenuId) {
//       return res.status(400).json({ message: "Paramètre 'contenuId' requis." });
//     }

//     const url = (image_url ?? '').trim();
//     const a   = (alt ?? '').trim();

//     // Existant ?
//     const [rows] = await db.query(
//       'SELECT id FROM ContenuImage WHERE contenu_id = ? LIMIT 1',
//       [contenuId]
//     );
//     const existingId = rows?.[0]?.id ?? null;

//     // 🧹 Rien fourni → suppression si ligne existante
//     if (!url && !a) {
//       if (existingId) {
//         await db.query('DELETE FROM ContenuImage WHERE id = ?', [existingId]);
//       }
//       return res.json({ message: 'Nettoyé (aucun média).' });
//     }

//     // ✅ Valider l’un ou l’autre
//     if (!url && !isIconToken(a)) {
//       return res.status(400).json({
//         message: "Champs requis: 'image_url' (image) ou 'alt' commençant par 'icon:' (icône)."
//       });
//     }

//     if (existingId) {
//       // UPDATE
//       await db.query(
//         'UPDATE ContenuImage SET image_url = ?, alt = ? WHERE id = ?',
//         [url || null, a || null, existingId]
//       );
//       return res.json({
//         id: existingId,
//         contenu_id: Number(contenuId),
//         image_url: url || null,
//         alt: a || null,
//       });
//     }

//     // INSERT
//     const [insertRes] = await db.query(
//       'INSERT INTO ContenuImage (contenu_id, image_url, alt) VALUES (?, ?, ?)',
//       [contenuId, url || null, a || null]
//     );
//     return res.status(201).json({
//       id: insertRes.insertId,
//       contenu_id: Number(contenuId),
//       image_url: url || null,
//       alt: a || null,
//     });
//   } catch (err) {
//     console.error('[images] upsertImageByContenu error:', err);
//     res.status(500).json({ message: 'Erreur serveur' });
//   }
// }

// PUT /api/images/by-contenu/:contenuId  { image_url, alt, icon_alt }
export async function upsertImageByContenu(req, res) {
  try {
    const { contenuId } = req.params;
    const { image_url, alt, icon_alt } = req.body || {};
    if (!contenuId) return res.status(400).json({ message: "Paramètre 'contenuId' requis." });

    const url = (image_url ?? '').trim();
    const a   = (alt ?? '').trim();
    const ia  = (icon_alt ?? '').trim();

    const [rows] = await db.query(
      'SELECT id FROM ContenuImage WHERE contenu_id = ? LIMIT 1',
      [contenuId]
    );
    const existingId = rows?.[0]?.id ?? null;

    // si rien du tout → delete
    if (!url && !a && !ia) {
      if (existingId) await db.query('DELETE FROM ContenuImage WHERE id = ?', [existingId]);
      return res.json({ message: 'Nettoyé (aucun média).' });
    }

    // au moins image_url ou icon_alt
    if (!url && !isIconToken(ia)) {
      return res.status(400).json({
        message: "Fournir 'image_url' (image) OU 'icon_alt' commençant par 'icon:'."
      });
    }

    if (existingId) {
      await db.query(
        'UPDATE ContenuImage SET image_url = ?, alt = ?, icon_alt = ? WHERE id = ?',
        [url || null, a || null, ia || null, existingId]
      );
      return res.json({ id: existingId, contenu_id: Number(contenuId), image_url: url || null, alt: a || null, icon_alt: ia || null });
    }

    const [insertRes] = await db.query(
      'INSERT INTO ContenuImage (contenu_id, image_url, alt, icon_alt) VALUES (?, ?, ?, ?)',
      [contenuId, url || null, a || null, ia || null]
    );
    return res.status(201).json({
      id: insertRes.insertId,
      contenu_id: Number(contenuId),
      image_url: url || null,
      alt: a || null,
      icon_alt: ia || null,
    });
  } catch (err) {
    console.error('[images] upsertImageByContenu error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}


