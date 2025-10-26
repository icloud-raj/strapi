'use strict';

module.exports = () => [
  {
    method: 'GET',
    path: '/audit-logs',
    handler: 'audit-log.find',
    config: {
      policies: ['plugin::audit-log.canReadLogs']
    }
  },
  {
    method: 'GET',
    path: '/audit-logs/:id/blob',
    handler: 'audit-log.findOneBlob',
    config: {
      policies: ['plugin::audit-log.canReadLogs']
    }
  }
];
