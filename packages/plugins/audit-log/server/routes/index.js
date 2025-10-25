'use strict';

const auditLogRoutes = require('./audit-log');

module.exports = {
  'content-api': {
    type: 'content-api',
    routes: auditLogRoutes(),
  },
};
