module.exports = [
  {
    method: 'GET',
    path: '/audit-logs',
    handler: 'plugin::audit-log.audit-log.find',
    config: {
      auth: false
    }
  },
  {
    method: 'GET',
    path: '/audit-logs/:id/blob',
    handler: 'plugin::audit-log.audit-log.findOneBlob',
    config: {
      auth: false
    }
  }
];
