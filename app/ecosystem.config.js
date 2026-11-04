// DEPLOY_TAG of the release, exported by reconcile-pm2-backend.sh during a
// deploy. PM2 6 does not hand shell variables to an app reloaded from this
// file, even with --update-env (only keys declared here reach the process),
// so it is declared per environment. Left out when unset, so a manual reload
// without a tag doesn't write "undefined".
const deployTag = process.env.DEPLOY_TAG ? { DEPLOY_TAG: process.env.DEPLOY_TAG } : {};

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
        ...deployTag,
      },
      env_acceptance: {
        NODE_ENV: 'acceptance',
        ...deployTag,
      },
      env_production: {
        NODE_ENV: 'production',
        ...deployTag,
      },
      // Logging — rotation handled by /etc/logrotate.d/armouredsouls (copytruncate)
      output: '/var/log/armouredsouls/backend-out.log',
      error: '/var/log/armouredsouls/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
