'use strict';

module.exports = () => [
  {
    method: 'GET',
    path: '/audit-logs',
    handler: 'audit-log.find',
    config: {
      auth: false
    }
  },
  {
    method: 'GET',
    path: '/audit-logs/:id/blob',
    handler: 'audit-log.findOneBlob',
    config: {
      auth: false
    }
  }
];
