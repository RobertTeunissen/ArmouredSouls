module.exports = {
  apps: [
    {
      name: 'armouredsouls-backend',
      script: 'dist/index.js',
      cwd: '/opt/armouredsouls/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '1100M',
      node_args: '--max-old-space-size=768',
      min_uptime: '5s',
      restart_delay: 5000,
      // PM2 must not report a launch as successful until Express has bound its
      // port and index.ts has sent the explicit readiness signal.
      wait_ready: true,
      listen_timeout: 30000,
      env: {
        NODE_ENV: 'production',
      },
      env_acceptance: {
        NODE_ENV: 'acceptance',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Logging — rotation handled by /etc/logrotate.d/armouredsouls (copytruncate)
      output: '/var/log/armouredsouls/backend-out.log',
      error: '/var/log/armouredsouls/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
