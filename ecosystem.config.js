module.exports = {
  apps: [
    {
      name: 'timesweet',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 8565',
      cwd: '/data/data/com.termux/files/home/timesweet',
      env: {
        NODE_ENV: 'production',
        PORT: 8565
      }
    }
  ]
};
