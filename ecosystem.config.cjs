module.exports = {
  apps: [
    {
      name: 'transcription-app',
      cwd: '/home/william/workspace/transcription-app/go-backend',
      script: './run.sh',
      exec_interpreter: 'bash',
      env: {
        NODE_ENV: 'production',
        PORT: 12050,
      },
      // Memory management settings
      max_memory_restart: '150M', // Restart if memory exceeds 150MB (Go uses much less)
      kill_timeout: 3000, // Allow 3 seconds for graceful shutdown
      output: '/home/william/logs/transcription-app.log',
    },
  ],
}