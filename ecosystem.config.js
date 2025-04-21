module.exports = {
  apps: [
    {
      name: 'transcription-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
