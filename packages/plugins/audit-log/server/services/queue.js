'use strict';

const { Queue } = require('bullmq');

module.exports = ({ strapi }) => {
  const config = strapi.config.get('plugin.audit-log.config', {});
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
