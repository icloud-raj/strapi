'use strict';

module.exports = () => ({
  bootstrap: require('./bootstrap'),
  services: {
    'audit-logger': require('./services/audit-logger'),
    queue: require('./services/queue')
  },
  controllers: { 
    'audit-log': require('./controllers/audit-log') 
  },
  routes: require('./routes'),
  policies: { 
    canReadLogs: require('./policies/canReadLogs') 
  },
  contentTypes: { 
    'audit-log': { schema: require('./content-types/audit-log') }
  }
});
