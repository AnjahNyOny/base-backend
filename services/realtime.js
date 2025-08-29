// // services/realtime.js
// import { Server } from 'socket.io';

// let io = /** @type {import('socket.io').Server | null} */ (null);

// // (facultatif) petite file d’attente si on émet avant init()
// const pendingQueue = [];
// const debug = (process.env.REALTIME_DEBUG || '').trim() === '1';

// // (facultatif) calcul d’origines autorisées
// function allowedOrigins() {
//   const list = new Set();
//   list.add('http://localhost:3000');
//   list.add('http://localhost:5173');
//   list.add('http://localhost:8080');
//   const admin = (process.env.ADMIN_ORIGIN || '').trim();
//   if (admin) list.add(admin);
//   return Array.from(list);
// }

// /**
//  * Initialise Socket.IO sur le serveur HTTP existant.
//  * À appeler depuis server.js juste après la création du httpServer.
//  */
// export function initRealtime(httpServer) {
//   if (io) return io;
//   io = new Server(httpServer, {
//     cors: { origin: true, credentials: true },
//   });

//   io.on('connection', (socket) => {
//     if (debug) console.log('[realtime] client connected', socket.id);
//     socket.on('disconnect', () => {
//       if (debug) console.log('[realtime] client disconnected', socket.id);
//     });
//   });

//   // Flush des évènements en attente éventuels
//   if (pendingQueue.length) {
//     if (debug) console.log(`[realtime] flush ${pendingQueue.length} pending events`);
//     for (const { event, payload } of pendingQueue.splice(0)) {
//       io.emit(event, payload);
//     }
//   }

//   if (debug) {
//     console.log('[realtime] Socket.IO initialisé. Origins =', allowedOrigins());
//   }
//   return io;
// }

// /** Récupère l’instance courante de Socket.IO (si initialisée) */
// export function getIO() {
//   return io;
// }

// /**
//  * Émet un évènement global (legacy).
//  * Préfère broadcastAdmin / broadcastPublic quand c’est possible.
//  */
// export function broadcast(event, payload) {
//   if (!io) {
//     pendingQueue.push({ event, payload });
//     if (debug) console.log('[realtime] queued event (not ready):', event);
//     return;
//   }
//   const safe = (() => { try { return JSON.stringify(payload).slice(0, 200); } catch { return String(payload); } })();
//   console.log(`[socket] emit "${event}" =>`, safe);
//   io.emit(event, payload);
// }

// /** Émetteur côté ADMIN uniquement (préfixe auto `admin.`) */
// export function broadcastAdmin(event, payload) {
//   const name = event.startsWith('admin.') ? event : `admin.${event}`;
//   broadcast(name, payload);
// }

// /** (optionnel) Émetteur côté PUBLIC (préfixe `public.`) */
// export function broadcastPublic(event, payload) {
//   const name = event.startsWith('public.') ? event : `public.${event}`;
//   broadcast(name, payload);
// }

// /** Raccourci historique → désormais sur canal admin */
// export function broadcastNewInbound(data) {
//   // avant : broadcast('message.ingested', data)
//   broadcastAdmin('message.ingested', data);
// }

// services/realtime.js
import { Server } from 'socket.io';

let io = /** @type {import('socket.io').Server | null} */ (null);
let nspAdmin = /** @type {import('socket.io').Namespace | null} */ (null);

export function initRealtime(httpServer) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  // namespace public (par défaut) — aucune émission ici pour l’inbox
  io.on('connection', () => {});

  // namespace admin dédié
  nspAdmin = io.of('/admin');
  nspAdmin.on('connection', () => {});

  return io;
}

export function getIO() {
  return io;
}

/** Émet UNIQUEMENT vers l’app admin (namespace /admin) */
export function broadcastAdmin(event, payload) {
  if (!nspAdmin) return;
  // On émet l’évènement “brut”, sans préfixe admin. Le namespace isole déjà.
  nspAdmin.emit(event, payload);
}

/** (optionnel) si tu veux émettre vers le public plus tard */
export function broadcastPublic(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}// services/realtime.js
// … (tout ton fichier refactoré avec broadcastAdmin)

export function broadcastNewInbound(data) {
  // alias legacy pour le vieux code
  broadcastAdmin('message.ingested', data);
}
