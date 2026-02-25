module.exports = {
  apps: [
    {
      name: 'armouredsouls-backend',
      script: 'dist/index.js',
      cwd: '/opt/armouredsouls/backend',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 5000,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
      // Logging
      output: '/var/log/armouredsouls/backend-out.log',
      error: '/var/log/armouredsouls/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_size: '50M',
    },
  ],
};
