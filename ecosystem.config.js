module.exports = {
  apps: [
    {
      name: 'transcription-app',
      script: 'bun',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 12050,
      },
      // Memory management settings
      max_memory_restart: '350M', // Restart if memory exceeds 350MB
      kill_timeout: 3000, // Allow 3 seconds for graceful shutdown
      output: '/home/william/logs/transcription-app.log',
    },
  ],
}
