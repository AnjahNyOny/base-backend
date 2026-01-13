module.exports = {
  apps: [
    // 1. LE CERVEAU (API & Site Web)
    {
      name: "base-api",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      out_file: "./logs/api-out.log",
      error_file: "./logs/api-error.log",
      merge_logs: true,
      time: true
    },

    // 2. L'OREILLE (Réception des emails IMAP)
    {
      name: "base-worker-imap",
      script: "workers/imapIngest.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      out_file: "./logs/imap-out.log",
      error_file: "./logs/imap-error.log",
      merge_logs: true,
      time: true
    },

    // 3. LA BOUCHE (Envoi des emails SMTP)
    {
      name: "base-worker-outbox",
      script: "workers/emailOutboxWorker.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "256M",
      env: { NODE_ENV: "production" },
      out_file: "./logs/outbox-out.log",
      error_file: "./logs/outbox-error.log",
      merge_logs: true,
      time: true
    }
  ]
};