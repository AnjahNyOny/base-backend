// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "api-server",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      error_file: "logs/api-server.err.log",
      out_file: "logs/api-server.out.log",
      time: true
    },
    {
      name: "gmail-worker",
      script: "scripts/inboundGmail.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      error_file: "logs/gmail-worker.err.log",
      out_file: "logs/gmail-worker.out.log",
      time: true
    }
  ]
};