'use strict';

const auditLogRoutes = require('./audit-log');

module.exports = {
  'admin': {
    type: 'admin',
    prefix: '', // Remove default /audit-log prefix
    routes: auditLogRoutes(),
  },
};
