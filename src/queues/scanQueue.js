// backend/src/queues/scanQueue.js
const Queue = require('bull');
const scanLogger = require('../utils/scanLogger');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Crear cola de procesamiento Bull utilizando Redis
const beautyScanQueue = new Queue('beauty-scan-jobs', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

beautyScanQueue.on('error', (error) => {
  scanLogger.error('❌ BullQueue Error:', { error: error.message });
});

beautyScanQueue.on('failed', (job, err) => {
  scanLogger.error('❌ Job fallido en cola de escaneo', {
    jobId: job.id,
    userId: job.data.userId,
    error: err.message
  });
});

module.exports = beautyScanQueue;
