'use strict';

module.exports = ({ strapi }) => {
  const config = strapi.config.get('plugin::audit-log.config', {});
  
  // Only initialize queue if in async mode
  if (config.mode !== 'async') {
    return {
      async addJob(payload) {
        strapi.log.warn('[audit-log] Queue service called but mode is not async');
      }
    };
  }
  
  // Lazy load bullmq only when needed
  let Queue;
  try {
    Queue = require('bullmq').Queue;
  } catch (error) {
    strapi.log.error('[audit-log] bullmq not installed. Install it with: npm install bullmq');
    return {
      async addJob(payload) {
        strapi.log.error('[audit-log] Cannot add job: bullmq not installed');
      }
    };
  }
  
  const redisConnection = config.queue?.redis || 'redis://localhost:6379';
  
  const queue = new Queue('audit-log-queue', {
    connection: {
      connectionString: redisConnection
    }
  });
  
  return {
    async addJob(payload) {
      try {
        await queue.add('audit', payload, {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        });
      } catch (error) {
        strapi.log.error('[audit-log] Queue error:', error);
        throw error;
      }
    }
  };
};
