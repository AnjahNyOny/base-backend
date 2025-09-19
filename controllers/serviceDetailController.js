// controllers/serviceDetailController.js
import db from "../config/db.js"; 
import { getServiceDetailBySlug, upsertServiceDetail, resolveServiceSlug, } from "../services/serviceDetailService.js";

export const fetchServiceDetailBySlug = async (req, res) => {
  try {
    const { slug, page_id } = req.query || {};
    const data = await getServiceDetailBySlug({ page_id, slug });
    if (!data) return res.status(404).json({ message: "Service introuvable." });
    res.json(data);
  } catch (e) {
    console.error("[serviceDetail] fetch by slug:", e);
    res.status(e.status || 500).json({ message: e.message || "Erreur serveur" });
  }
};

export const putServiceDetail = async (req, res) => {
  try {
    const { contenu_id } = req.params;
    const payload = req.body || {};
    const out = await upsertServiceDetail(contenu_id, payload);
    res.json({ message: "Détails sauvegardés.", ...out });
  } catch (e) {
    console.error("[serviceDetail] upsert:", e);
    res.status(e.status || 500).json({ message: e.message || "Erreur serveur" });
  }
};

export async function handleGetServiceDetailBySlug(req, res) {
  try {
    const slug = String(req.query.slug || "").trim();
    const page_id = Number(req.query.page_id);
    // preview facultatif: ?includeDraft=1 (ou ?preview=1)
    const includeDraft =
      String(req.query.includeDraft || req.query.preview || "") === "1";

    if (!slug || !Number.isFinite(page_id)) {
      return res.status(400).json({ message: "Paramètres 'slug' et 'page_id' requis." });
    }

    const detail = await getServiceDetailBySlug({
      slug,
      page_id,
      mustBePublished: !includeDraft,
    });

    if (!detail) {
      return res
        .status(404)
        .json({ message: includeDraft ? "Not found (even with preview)" : "Not found or not published" });
    }

    return res.json(detail);
  } catch (e) {
    console.error("[service-detail] by-slug error:", e);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}


export const translateSlugController = async (req, res) => {
  try {
    const { slug, from_page_id, to_page_id, from_lang, to_lang, code } = req.query || {};
    if (!slug) return res.status(400).json({ message: "slug requis" });

    const out = await translateSlug({
      slug,
      fromPageId: from_page_id ? Number(from_page_id) : null,
      toPageId: to_page_id ? Number(to_page_id) : null,
      fromLang: from_lang || null,
      toLang: to_lang || null,
      pageCode: code || 'home',
    });

    if (!out) return res.json({ slug: null, found: false });
    return res.json({ slug: out, found: true });
  } catch (e) {
    console.error("[serviceDetail] translateSlug:", e);
    res.status(e.status || 500).json({ message: e.message || "Erreur serveur" });
  }
};

/** GET /api/service-detail/resolve-slug?source_page_id=&target_page_id=&slug= */
export const resolveSlugAcrossLanguages = async (req, res) => {
  try {
    const source_page_id = Number(req.query.source_page_id);
    const target_page_id = Number(req.query.target_page_id);
    const slug = String(req.query.slug || "").trim();

    if (!Number.isFinite(source_page_id) || !Number.isFinite(target_page_id) || !slug) {
      return res.status(400).json({ message: "source_page_id, target_page_id et slug requis." });
    }

    const row = await resolveServiceSlug({ source_page_id, slug, target_page_id });
    if (!row) return res.status(404).json({ found: false });

    return res.json({ found: true, contenu_id: row.id, slug: row.slug });
  } catch (e) {
    console.error("[serviceDetail] resolve-slug:", e);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

export const resolveSlug = async (req, res) => {
  try {
    const { source_page_id, target_page_id, slug } = req.query || {};
    const spid = Number(source_page_id);
    const tpid = Number(target_page_id);
    const s = String(slug || '').trim();

    if (!Number.isFinite(spid) || !Number.isFinite(tpid) || !s) {
      return res.status(400).json({ message: "Params invalides." });
    }

    // 1) récupérer la service_key côté source
    const [srcRows] = await db.query(                      // ⬅️ req.db → db
      `SELECT service_key
         FROM contenu
        WHERE type='service_list' AND page_id=? AND slug=?
        LIMIT 1`,
      [spid, s]
    );
    const key = srcRows?.[0]?.service_key;
    if (!key) return res.json({ found: false });           // 200, pas de paire

    // 2) chercher la paire côté cible via service_key
    const [dstRows] = await db.query(                      // ⬅️ req.db → db
      `SELECT id, slug
         FROM contenu
        WHERE type='service_list' AND page_id=? AND service_key=?
        LIMIT 1`,
      [tpid, key]
    );
    const dst = dstRows?.[0];
    if (!dst) return res.json({ found: false });           // 200, pas de paire

    return res.json({ found: true, contenu_id: dst.id, slug: dst.slug });
  } catch (e) {
    console.error("[resolve-slug] error:", e);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

export const handleGetServicesByTag = async (req, res) => {
  try {
    const page_id = Number(req.query.page_id);
    const tag = String(req.query.tag || "").trim();
    const limit = Math.min(Number(req.query.limit || 12), 50);
    const offset = Number(req.query.offset || 0);
    const sort = (req.query.sort || "recent").toString();
    const includeDraft = String(req.query.includeDraft || req.query.preview || "") === "1";

    if (!Number.isFinite(page_id) || !tag) {
      return res.status(400).json({ message: "Paramètres 'page_id' et 'tag' requis." });
    }

    const data = await listServicesByTag({ page_id, tag, limit, offset, sort, includeDraft });
    return res.json(data);
  } catch (error) {
    console.error("[services] by-tag error:", error?.sqlMessage || error);
    return res.status(error?.status || 500).json({ message: error?.message || "Erreur serveur" });
  }
};