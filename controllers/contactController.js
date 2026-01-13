// // controllers/contactController.js
// import {
//   listThreads,
//   getThreadById,          // alias de getThread
//   createInboundMessage,
//   replyToThread,
//   setThreadStatus,
//   bulkSetStatus,
//   deleteThread as deleteThreadSvc,
//   listLabels,
//   upsertLabel,
//   removeLabel,
//   setThreadLabels,
//   bulkDeleteThreads,
// } from "../services/contactService.js";
// import { broadcastAdmin } from "../services/realtime.js";

// import {
//   InboundMessageSchema,
//   ReplySchema,
//   StatusSchema,
//   IdsSchema,
//   UpsertLabelSchema,
//   SetThreadLabelsSchema,
//   ListThreadsQuerySchema,
// } from "../validation/contactSchemas.js";
// import { logAdminAction } from "../services/auditService.js";

// /* utils ip + ua */
// function getClientIp(req) {
//   return (req.headers["x-forwarded-for"] || req.ip || req.socket?.remoteAddress || "").toString();
// }
// function getUA(req) {
//   return (req.headers["user-agent"] || "").toString();
// }

// /* -------- Threads -------- */
// export const getThreadsController = async (req, res) => {
//   try {
//     // const { q, status, label, page, pageSize, sort } = req.query || {};
//     // const data = await listThreads({ q, status, label, page, pageSize, sort });
//     const parsed = ListThreadsQuerySchema.safeParse(req.query || {});
//     if (!parsed.success) {
//       return res.status(400).json({ error: "Query invalide.", issues: parsed.error.flatten() });
//     }
//     const { q, status, label, page, pageSize, sort } = parsed.data;
//     const data = await listThreads({ q, status, label, page, pageSize, sort });
//     res.json(data);
//   } catch (e) {
//     console.error("[contact] getThreads error:", e);
//     res.status(500).json({ error: "Erreur serveur." });
//   }
// };

// export const getThreadController = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const data = await getThreadById(id);   // renvoie {inbox, replies}
//     if (!data) return res.status(404).json({ error: "Fil introuvable." });
//     res.json(data);
//   } catch (e) {
//     console.error("[contact] getThread error:", e);
//     res.status(500).json({ error: "Erreur serveur." });
//   }
// };

// /* -------- Inbound public -------- */
// export const postInboundController = async (req, res) => {
//   try {
//     // normalisation FR/EN → schéma
//     const payload = {
//       nom: (req.body.nom ?? req.body.name ?? "").toString(),
//       email: (req.body.email ?? "").toString(),
//       sujet: (req.body.sujet ?? req.body.subject ?? "").toString(),
//       message: (req.body.message ?? "").toString(),
//       langue: (req.body.langue ?? "fr").toString(),
//       phone: req.body.phone ?? null,
//       company: req.body.company ?? null,
//       meta: req.body.meta ?? null,
//       attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
//     };

//     const parsed = InboundMessageSchema.safeParse(payload);
//     if (!parsed.success) {
//       return res.status(400).json({ ok: false, error: "Requête invalide.", issues: parsed.error.flatten() });
//     }

//     const result = await createInboundMessage(parsed.data);

//     try {
//       broadcastAdmin("message.ingested", {
//         type: "insert",
//         source: "api",
//         threadId: result.threadId,
//         subject: result.subject ?? parsed.data.sujet,
//         from: { name: parsed.data.nom, email: parsed.data.email },
//         preview: (result.preview ?? parsed.data.message).slice(0, 200),
//         at: result.createdAt ?? new Date().toISOString(),
//         messageId: result.messageId ?? null,
//       });
//     } catch { }

//     return res.status(201).json({ ok: true, success: true, ...result });
//   } catch (e) {
//     console.error("[contact] postInbound error:", e);
//     return res.status(400).json({
//       ok: false, success: false,
//       error: e?.message || "Requête invalide."
//     });
//   }
// };

// /* -------- Admin: reply -------- */
// export const replyController = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const parsed = ReplySchema.safeParse(req.body || {});
//     if (!parsed.success) {
//       return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
//     }

//     await replyToThread(id, {
//       sender_name: parsed.data.sender_name,
//       sender_email: parsed.data.sender_email,
//       subject: parsed.data.subject,
//       message: parsed.data.body,
//       attachments: parsed.data.attachments || [],
//     });

//     await logAdminAction({
//       adminId: req.user?.id ?? null,
//       action: "thread.reply",
//       threadId: Number(id) || null,
//       meta: { subject: parsed.data.subject || null, hasAttachments: !!(parsed.data.attachments?.length) },
//       ip: getClientIp(req),
//       ua: getUA(req),
//     });

//     res.json({ success: true });
//   } catch (e) {
//     console.error("[contact] reply error:", e);
//     res.status(400).json({ error: e.message || "Requête invalide." });
//   }
// };

// export const setStatusController = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const parsed = StatusSchema.safeParse(req.body || {});
//     if (!parsed.success) {
//       return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
//     }

//     const ok = await setThreadStatus(id, parsed.data.status);
//     if (!ok) return res.status(404).json({ error: "Fil introuvable." });

//     await logAdminAction({
//       adminId: req.user?.id ?? null,
//       action: "thread.status.set",
//       threadId: Number(id) || null,
//       meta: { status: parsed.data.status },
//       ip: getClientIp(req),
//       ua: getUA(req),
//     });

//     res.json({ success: true });
//   } catch (e) {
//     console.error("[contact] setStatus error:", e);
//     res.status(400).json({ error: e.message || "Requête invalide." });
//   }
// };

// export const bulkSetStatusController = async (req, res) => {
//   try {
//     const idsParse = IdsSchema.safeParse({ ids: req.body?.ids });
//     const statusParse = StatusSchema.safeParse({ status: req.body?.status });

//     if (!idsParse.success || !statusParse.success) {
//       return res.status(400).json({
//         error: "Payload invalide.",
//         issues: { ids: idsParse.success ? undefined : idsParse.error.flatten(), status: statusParse.success ? undefined : statusParse.error.flatten() },
//       });
//     }

//     const updated = await bulkSetStatus(idsParse.data.ids, statusParse.data.status);

//     await logAdminAction({
//       adminId: req.user?.id ?? null,
//       action: "threads.status.bulk",
//       threadId: null,
//       meta: { ids: idsParse.data.ids, status: statusParse.data.status, updated },
//       ip: getClientIp(req),
//       ua: getUA(req),
//     });

//     res.json({ success: true, updated });
//   } catch (e) {
//     console.error("[contact] bulkSetStatus error:", e);
//     res.status(400).json({ error: e.message || "Requête invalide." });
//   }
// };

// export const deleteThreadController = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const ok = await deleteThreadSvc(id);
//     if (!ok) return res.status(404).json({ error: "Fil introuvable." });

//     await logAdminAction({
//       adminId: req.user?.id ?? null,
//       action: "thread.delete",
//       threadId: Number(id) || null,
//       meta: null,
//       ip: getClientIp(req),
//       ua: getUA(req),
//     });

//     res.json({ success: true });
//   } catch (e) {
//     console.error("[contact] deleteThread error:", e);
//     res.status(400).json({ error: e.message || "Requête invalide." });
//   }
// };

// /* -------- Labels -------- */
// export const getLabelsController = async (_req, res) => {
//   try {
//     const data = await listLabels();
//     res.json({ labels: data });
//   } catch (e) {
//     console.error("[contact] getLabels error:", e);
//     res.status(500).json({ error: "Erreur serveur." });
//   }
// };

// export const upsertLabelController = async (req, res) => {
//   try {
//     const parsed = UpsertLabelSchema.safeParse(req.body || {});
//     if (!parsed.success) {
//       return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
//     }

//     const id = await upsertLabel({ name: parsed.data.name });

//     await logAdminAction({
//       adminId: req.user?.id ?? null,
//       action: "label.upsert",
//       threadId: null,
//       meta: { id, name: parsed.data.name },
//       ip: getClientIp(req),
//       ua: getUA(req),
//     });

//     res.status(201).json({ success: true, id });
//   } catch (e) {
//     console.error("[contact] upsertLabel error:", e);
//     res.status(400).json({ error: e.message || "Requête invalide." });
//   }
// };

// export const deleteLabelController = async (req, res) => {
//   try {
//     const ok = await removeLabel(req.params.id);
//     if (!ok) return res.status(404).json({ error: "Libellé introuvable." });

//     await logAdminAction({
//       adminId: req.user?.id ?? null,
//       action: "label.delete",
//       threadId: null,
//       meta: { id: Number(req.params.id) || null },
//       ip: getClientIp(req),
//       ua: getUA(req),
//     });

//     res.json({ success: true });
//   } catch (e) {
//     console.error("[contact] deleteLabel error:", e);
//     res.status(400).json({ error: e.message || "Requête invalide." });
//   }
// };

// export const setThreadLabelsController = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const parsed = SetThreadLabelsSchema.safeParse(req.body || {});
//     if (!parsed.success) {
//       return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
//     }

//     await setThreadLabels(id, parsed.data.labelIds);

//     await logAdminAction({
//       adminId: req.user?.id ?? null,
//       action: "thread.labels.set",
//       threadId: Number(id) || null,
//       meta: { labelIds: parsed.data.labelIds },
//       ip: getClientIp(req),
//       ua: getUA(req),
//     });

//     res.json({ success: true });
//   } catch (e) {
//     console.error("[contact] setThreadLabels error:", e);
//     res.status(400).json({ error: e.message || "Requête invalide." });
//   }
// };

// export const bulkDeleteController = async (req, res) => {
//   try {
//     const parsed = IdsSchema.safeParse({ ids: req.body?.ids });
//     if (!parsed.success) {
//       return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
//     }

//     const deleted = await bulkDeleteThreads(parsed.data.ids);

//     await logAdminAction({
//       adminId: req.user?.id ?? null,
//       action: "threads.bulkDelete",
//       threadId: null,
//       meta: { ids: parsed.data.ids, deleted },
//       ip: getClientIp(req),
//       ua: getUA(req),
//     });

//     res.json({ success: true, deleted });
//   } catch (e) {
//     console.error("[contact] bulkDelete error:", e);
//     res.status(400).json({ error: e.message || "Requête invalide." });
//   }
// };

// controllers/contactController.js
import {
  listThreads,
  getThreadById,
  createInboundMessage,
  replyToThread,
  setThreadStatus,
  bulkSetStatus,
  deleteThread as deleteThreadSvc,
  listLabels,
  upsertLabel,
  removeLabel,
  setThreadLabels,
  bulkDeleteThreads,
} from "../services/contactService.js";
import { broadcastAdmin } from "../services/realtime.js";

// --- NOUVEAU : On importe le service qui gère le style des mails ---
import { sendSystemMail } from "../services/emailService.js";

import {
  InboundMessageSchema,
  ReplySchema,
  StatusSchema,
  IdsSchema,
  UpsertLabelSchema,
  SetThreadLabelsSchema,
  ListThreadsQuerySchema,
} from "../validation/contactSchemas.js";
import { logAdminAction } from "../services/auditService.js";

/* utils ip + ua */
function getClientIp(req) {
  return (req.headers["x-forwarded-for"] || req.ip || req.socket?.remoteAddress || "").toString();
}
function getUA(req) {
  return (req.headers["user-agent"] || "").toString();
}

/* -------- Threads -------- */
export const getThreadsController = async (req, res) => {
  try {
    const parsed = ListThreadsQuerySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Query invalide.", issues: parsed.error.flatten() });
    }
    const { q, status, label, page, pageSize, sort } = parsed.data;
    const data = await listThreads({ q, status, label, page, pageSize, sort });
    res.json(data);
  } catch (e) {
    console.error("[contact] getThreads error:", e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const getThreadController = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getThreadById(id);
    if (!data) return res.status(404).json({ error: "Fil introuvable." });
    res.json(data);
  } catch (e) {
    console.error("[contact] getThread error:", e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

/* -------- Inbound public -------- */
export const postInboundController = async (req, res) => {
  try {
    // 1. Normalisation et Validation
    const payload = {
      nom: (req.body.nom ?? req.body.name ?? "").toString(),
      email: (req.body.email ?? "").toString(),
      sujet: (req.body.sujet ?? req.body.subject ?? "").toString(),
      message: (req.body.message ?? "").toString(),
      langue: (req.body.langue ?? "fr").toString(),
      phone: req.body.phone ?? null,
      company: req.body.company ?? null,
      meta: req.body.meta ?? null,
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
    };

    const parsed = InboundMessageSchema.safeParse(payload);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Requête invalide.", issues: parsed.error.flatten() });
    }

    // 2. Sauvegarde du message en Base de Données
    const result = await createInboundMessage(parsed.data);

    // 3. ENVOI DE L'ACCUSÉ DE RÉCEPTION STYLISÉ
    // On utilise sendSystemMail pour appliquer le template (Logo, Footer, Design)
    try {
      // Le contenu de ton message générique, en HTML simple
      const mailHtml = `
        <p>Bonjour,</p>
        <p>Merci pour votre message. Nous revenons vers vous très vite.</p>
        <p>Cordialement,<br>Anjah R.</p>
      `;

      await sendSystemMail({
        to: parsed.data.email,
        subject: "Accusé de réception - Anjah R.",
        html: mailHtml // Sera injecté dans le template visuel
      });

    } catch (mailError) {
      // On log l'erreur mais on ne fait pas échouer la requête HTTP pour ça
      console.error("[contact] Echec envoi accusé réception:", mailError);
    }

    // 4. Notification Temps Réel (Admin)
    try {
      broadcastAdmin("message.ingested", {
        type: "insert",
        source: "api",
        threadId: result.threadId,
        subject: result.subject ?? parsed.data.sujet,
        from: { name: parsed.data.nom, email: parsed.data.email },
        preview: (result.preview ?? parsed.data.message).slice(0, 200),
        at: result.createdAt ?? new Date().toISOString(),
        messageId: result.messageId ?? null,
      });
    } catch { }

    return res.status(201).json({ ok: true, success: true, ...result });

  } catch (e) {
    console.error("[contact] postInbound error:", e);
    return res.status(400).json({
      ok: false, success: false,
      error: e?.message || "Requête invalide."
    });
  }
};

/* -------- Admin: reply -------- */
export const replyController = async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = ReplySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
    }

    await replyToThread(id, {
      sender_name: parsed.data.sender_name,
      sender_email: parsed.data.sender_email,
      subject: parsed.data.subject,
      message: parsed.data.body,
      attachments: parsed.data.attachments || [],
    });

    await logAdminAction({
      adminId: req.user?.id ?? null,
      action: "thread.reply",
      threadId: Number(id) || null,
      meta: { subject: parsed.data.subject || null, hasAttachments: !!(parsed.data.attachments?.length) },
      ip: getClientIp(req),
      ua: getUA(req),
    });

    res.json({ success: true });
  } catch (e) {
    console.error("[contact] reply error:", e);
    res.status(400).json({ error: e.message || "Requête invalide." });
  }
};

export const setStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = StatusSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
    }

    const ok = await setThreadStatus(id, parsed.data.status);
    if (!ok) return res.status(404).json({ error: "Fil introuvable." });

    await logAdminAction({
      adminId: req.user?.id ?? null,
      action: "thread.status.set",
      threadId: Number(id) || null,
      meta: { status: parsed.data.status },
      ip: getClientIp(req),
      ua: getUA(req),
    });

    res.json({ success: true });
  } catch (e) {
    console.error("[contact] setStatus error:", e);
    res.status(400).json({ error: e.message || "Requête invalide." });
  }
};

export const bulkSetStatusController = async (req, res) => {
  try {
    const idsParse = IdsSchema.safeParse({ ids: req.body?.ids });
    const statusParse = StatusSchema.safeParse({ status: req.body?.status });

    if (!idsParse.success || !statusParse.success) {
      return res.status(400).json({
        error: "Payload invalide.",
        issues: { ids: idsParse.success ? undefined : idsParse.error.flatten(), status: statusParse.success ? undefined : statusParse.error.flatten() },
      });
    }

    const updated = await bulkSetStatus(idsParse.data.ids, statusParse.data.status);

    await logAdminAction({
      adminId: req.user?.id ?? null,
      action: "threads.status.bulk",
      threadId: null,
      meta: { ids: idsParse.data.ids, status: statusParse.data.status, updated },
      ip: getClientIp(req),
      ua: getUA(req),
    });

    res.json({ success: true, updated });
  } catch (e) {
    console.error("[contact] bulkSetStatus error:", e);
    res.status(400).json({ error: e.message || "Requête invalide." });
  }
};

export const deleteThreadController = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await deleteThreadSvc(id);
    if (!ok) return res.status(404).json({ error: "Fil introuvable." });

    await logAdminAction({
      adminId: req.user?.id ?? null,
      action: "thread.delete",
      threadId: Number(id) || null,
      meta: null,
      ip: getClientIp(req),
      ua: getUA(req),
    });

    res.json({ success: true });
  } catch (e) {
    console.error("[contact] deleteThread error:", e);
    res.status(400).json({ error: e.message || "Requête invalide." });
  }
};

/* -------- Labels -------- */
export const getLabelsController = async (_req, res) => {
  try {
    const data = await listLabels();
    res.json({ labels: data });
  } catch (e) {
    console.error("[contact] getLabels error:", e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const upsertLabelController = async (req, res) => {
  try {
    const parsed = UpsertLabelSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
    }

    const id = await upsertLabel({ name: parsed.data.name });

    await logAdminAction({
      adminId: req.user?.id ?? null,
      action: "label.upsert",
      threadId: null,
      meta: { id, name: parsed.data.name },
      ip: getClientIp(req),
      ua: getUA(req),
    });

    res.status(201).json({ success: true, id });
  } catch (e) {
    console.error("[contact] upsertLabel error:", e);
    res.status(400).json({ error: e.message || "Requête invalide." });
  }
};

export const deleteLabelController = async (req, res) => {
  try {
    const ok = await removeLabel(req.params.id);
    if (!ok) return res.status(404).json({ error: "Libellé introuvable." });

    await logAdminAction({
      adminId: req.user?.id ?? null,
      action: "label.delete",
      threadId: null,
      meta: { id: Number(req.params.id) || null },
      ip: getClientIp(req),
      ua: getUA(req),
    });

    res.json({ success: true });
  } catch (e) {
    console.error("[contact] deleteLabel error:", e);
    res.status(400).json({ error: e.message || "Requête invalide." });
  }
};

export const setThreadLabelsController = async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = SetThreadLabelsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
    }

    await setThreadLabels(id, parsed.data.labelIds);

    await logAdminAction({
      adminId: req.user?.id ?? null,
      action: "thread.labels.set",
      threadId: Number(id) || null,
      meta: { labelIds: parsed.data.labelIds },
      ip: getClientIp(req),
      ua: getUA(req),
    });

    res.json({ success: true });
  } catch (e) {
    console.error("[contact] setThreadLabels error:", e);
    res.status(400).json({ error: e.message || "Requête invalide." });
  }
};

export const bulkDeleteController = async (req, res) => {
  try {
    const parsed = IdsSchema.safeParse({ ids: req.body?.ids });
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalide.", issues: parsed.error.flatten() });
    }

    const deleted = await bulkDeleteThreads(parsed.data.ids);

    await logAdminAction({
      adminId: req.user?.id ?? null,
      action: "threads.bulkDelete",
      threadId: null,
      meta: { ids: parsed.data.ids, deleted },
      ip: getClientIp(req),
      ua: getUA(req),
    });

    res.json({ success: true, deleted });
  } catch (e) {
    console.error("[contact] bulkDelete error:", e);
    res.status(400).json({ error: e.message || "Requête invalide." });
  }
};