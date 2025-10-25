'use strict';

module.exports = async ({ strapi }) => {
  const cfg = strapi.config.get('plugin.audit-log.config', {});
  
  // Skip if disabled
  if (cfg.enabled === false) return;
  
  // Get content types to monitor (exclude specified ones)
  const excluded = cfg.excludeContentTypes || [];
  const uids = Object.keys(strapi.contentTypes)
    .filter(uid => !excluded.includes(uid));
  
  // Subscribe to lifecycle events
  strapi.db.lifecycles.subscribe({
    models: uids,
    
    async afterCreate(event) {
      await strapi.plugin('audit-log').service('audit-logger')
        .record({ action: 'create', event });
    },
    
    async afterUpdate(event) {
      await strapi.plugin('audit-log').service('audit-logger')
        .record({ action: 'update', event });
    },
    
    async afterDelete(event) {
      await strapi.plugin('audit-log').service('audit-logger')
        .record({ action: 'delete', event });
    }
  });
  
  strapi.log.info('[audit-log] Plugin initialized successfully');
};
