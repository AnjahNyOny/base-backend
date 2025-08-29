// controllers/imagesController.js
import db from '../config/db.js';

// GET /api/images?contenu_id=123
export async function listImages(req, res) {
    try {
        const { contenu_id } = req.query;
        if (!contenu_id) {
            return res.status(400).json({ message: "Paramètre 'contenu_id' requis." });
        }
        const [rows] = await db.query(
            'SELECT id, contenu_id, image_url, alt FROM ContenuImage WHERE contenu_id = ?',
            [contenu_id]
        );
        res.json(rows);
    } catch (err) {
        console.error('[images] listImages error:', err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
}

// POST /api/images  { contenu_id, image_url, alt }
export async function createImage(req, res) {
    try {
        const { contenu_id, image_url, alt } = req.body || {};
        if (!contenu_id || !image_url) {
            return res.status(400).json({ message: "Champs requis: 'contenu_id', 'image_url'." });
        }
        const [result] = await db.query(
            'INSERT INTO ContenuImage (contenu_id, image_url, alt) VALUES (?, ?, ?)',
            [contenu_id, image_url, alt ?? null]
        );
        res.status(201).json({
            id: result.insertId,
            contenu_id,
            image_url,
            alt: alt ?? null,
        });
    } catch (err) {
        console.error('[images] createImage error:', err);
        res.status(500).json({ message: "Erreur serveur" });
    }
}

// PUT /api/images/:id  { image_url, alt }
export async function updateImage(req, res) {
    try {
        const { id } = req.params;
        const { image_url, alt } = req.body || {};
        if (!image_url) {
            return res.status(400).json({ message: "Champ requis: 'image_url'." });
        }
        await db.query(
            'UPDATE ContenuImage SET image_url = ?, alt = ? WHERE id = ?',
            [image_url, alt ?? null, id]
        );
        res.json({ id: Number(id), image_url, alt: alt ?? null });
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

/* ---------- Legacy aliases (optional, to not break old code) ---------- */

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
// UPSERT 
// PUT /api/images/by-contenu/:contenuId
export async function upsertImageByContenu(req, res) {
    try {
        const { contenuId } = req.params;
        const { image_url, alt } = req.body || {};

        // Y a-t-il déjà une image liée ?
        const [rows] = await db.query(
            'SELECT id FROM ContenuImage WHERE contenu_id = ? LIMIT 1',
            [contenuId]
        );

        if (rows && rows.length) {
            // Mise à jour
            const existingId = rows[0].id;
            if (!image_url) {
                return res.status(400).json({ message: "Champ requis: 'image_url'." });
            }
            await db.query(
                'UPDATE ContenuImage SET image_url = ?, alt = ? WHERE id = ?',
                [image_url, alt ?? null, existingId]
            );
            return res.json({ id: existingId, contenu_id: Number(contenuId), image_url, alt: alt ?? null });
        }

        // Création si aucune image n’existe encore
        if (!image_url) {
            return res.status(400).json({ message: "Champs requis pour création: 'image_url'." });
        }
        const [insertRes] = await db.query(
            'INSERT INTO ContenuImage (contenu_id, image_url, alt) VALUES (?, ?, ?)',
            [contenuId, image_url, alt ?? null]
        );
        return res.status(201).json({ id: insertRes.insertId, contenu_id: Number(contenuId), image_url, alt: alt ?? null });
    } catch (err) {
        console.error('[images] upsertImageByContenu error:', err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
}