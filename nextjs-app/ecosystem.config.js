const isWindows = process.platform === 'win32';

module.exports = {
  apps: [
    {
      name: 'timesheet-metso',
      script: 'node_modules/next/dist/bin/next',
      args: isWindows ? 'start -p 8565' : 'start -p 3005',
      cwd: isWindows ? 'D:/0 Running apps/Timesheet/nextjs-app' : '/home/Prime-Projectx/timesheet/nextjs-app',
      env: {
        NODE_ENV: 'production',
        PORT: isWindows ? 8565 : 3005
      }
    }
  ]
};
