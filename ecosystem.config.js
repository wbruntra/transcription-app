module.exports = {
  apps: [
    {
      name: 'transcription-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
      // Memory management settings
      max_memory_restart: '350M', // Restart if memory exceeds 250MB
      kill_timeout: 3000, // Allow 3 seconds for graceful shutdown
    },
  ],
}
