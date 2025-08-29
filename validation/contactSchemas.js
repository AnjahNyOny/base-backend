// validation/contactSchemas.js
import { z } from "zod";

/** Attachement tel que renvoyé par /api/upload */
export const AttachmentSchema = z.object({
  name: z.string().min(1).optional(),
  mime: z.string().min(1).optional(),
  size: z.number().int().nonnegative().optional(),
  path: z.string().min(1).optional(),     // ex: /uploads/xxx
  url: z.string().min(1).optional(),      // ex: /uploads/xxx ou https://...
  diskPath: z.string().min(1).optional(), // absolu sur le serveur
}).partial();

/** Inbound (formulaire public) – accepte alias FR/EN et normalise */
export const InboundMessageSchema = z.object({
  nom:     z.string().trim().min(1),
  email:   z.string().trim().email(),
  sujet:   z.string().trim().min(1),
  message: z.string().trim().min(1),
  langue:  z.string().trim().min(1).default("fr"),
  phone:   z.string().trim().optional().nullable(),
  company: z.string().trim().optional().nullable(),
  meta:    z.record(z.any()).optional().nullable(),
  attachments: z.array(AttachmentSchema).optional().default([]),
});

/** Reply admin */
export const ReplySchema = z.object({
  sender_name:  z.string().trim().optional(),
  sender_email: z.string().trim().email().optional(),
  subject:      z.string().trim().optional(),
  body:         z.string().trim().min(1),
  attachments:  z.array(AttachmentSchema).optional().default([]),
});

/** Status UI accepté */
export const StatusSchema = z.object({
  status: z.enum(["new", "read", "handled", "archived"]),
});

/** { ids: number[] } */
export const IdsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

/** { name } pour label */
export const UpsertLabelSchema = z.object({
  name: z.string().trim().min(1),
});

/** { labelIds } pour setThreadLabels */
export const SetThreadLabelsSchema = z.object({
  labelIds: z.array(z.number().int().positive()).default([]),
});

// GET /contact/threads query
export const ListThreadsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.string().trim().optional(),
  label: z.string().trim().optional(),
  sort: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
});