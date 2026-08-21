module.exports = {
  apps: [
    {
      name: 'timesheet-metso',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3005',
      cwd: '/home/Prime-Projectx/timesheet/nextjs-app',
      env: {
        NODE_ENV: 'production',
        PORT: 3005
      }
    }
  ]
};
