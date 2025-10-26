'use strict';

module.exports = async ({ strapi }) => {
  // Register permissions
  const RBAC_ACTIONS = [
    {
      section: 'plugins',
      displayName: 'Read audit logs',
      uid: 'read',
      pluginName: 'audit-log',
    },
  ];
  
  try {
    await strapi.service('admin::permission').actionProvider.registerMany(RBAC_ACTIONS);
  } catch (error) {
    strapi.log.error('[audit-log] Failed to register permissions:', error);
    return; // Exit early if permission registration fails
  }
  
  const cfg = strapi.config.get('plugin::audit-log.config', {});
  
  // Skip if disabled
  if (cfg.enabled === false) {
    strapi.log.info('[audit-log] Plugin is disabled in config');
    return;
  }
  
  // Validate config
  if (cfg.mode && !['sync', 'async'].includes(cfg.mode)) {
    strapi.log.warn(`[audit-log] Invalid mode "${cfg.mode}", defaulting to "sync"`);
  }
  if (cfg.backend && !['db', 'db-file'].includes(cfg.backend)) {
    strapi.log.warn(`[audit-log] Invalid backend "${cfg.backend}", defaulting to "db-file"`);
  }
  if (cfg.excludeContentTypes && !Array.isArray(cfg.excludeContentTypes)) {
    strapi.log.warn('[audit-log] excludeContentTypes must be an array, ignoring');
    cfg.excludeContentTypes = [];
  }
  
  // Get content types to monitor (exclude specified ones)
  const excluded = cfg.excludeContentTypes || [];
  const uids = Object.keys(strapi.contentTypes)
    .filter(uid => !excluded.includes(uid));
  
  // Subscribe to lifecycle events
  try {
    const unsubscribe = strapi.db.lifecycles.subscribe({
      models: uids,
      
      async afterCreate(event) {
        // Only record events after Strapi is fully loaded
        if (!strapi.isLoaded) return;
        
        // Skip audit logs themselves
        if (event.model.uid === 'plugin::audit-log.audit-log') return;
        
        const recordId = event.result?.id || event.result?.documentId;
        strapi.log.info(`[audit-log] Recording create for ${event.model.uid} id=${recordId}`);
        
        await strapi.plugin('audit-log').service('audit-logger')
          .record({ action: 'create', event });
      },
      
      async afterUpdate(event) {
        // Only record events after Strapi is fully loaded
        if (!strapi.isLoaded) return;
        
        // Skip audit logs themselves
        if (event.model.uid === 'plugin::audit-log.audit-log') return;
        
        const recordId = event.result?.id || event.result?.documentId;
        strapi.log.info(`[audit-log] Recording update for ${event.model.uid} id=${recordId}`);
        
        await strapi.plugin('audit-log').service('audit-logger')
          .record({ action: 'update', event });
      },
      
      async afterDelete(event) {
        // Only record events after Strapi is fully loaded
        if (!strapi.isLoaded) return;
        
        // Skip audit logs themselves
        if (event.model.uid === 'plugin::audit-log.audit-log') return;
        
        const recordId = event.params?.where?.id || event.params?.where?.documentId;
        strapi.log.info(`[audit-log] Recording delete for ${event.model.uid} id=${recordId}`);
        
        await strapi.plugin('audit-log').service('audit-logger')
          .record({ action: 'delete', event });
      }
    });
    
    // Store unsubscribe function for cleanup
    strapi.plugin('audit-log').unsubscribe = unsubscribe;
    
    strapi.log.info('[audit-log] Plugin initialized successfully');
  } catch (error) {
    strapi.log.error('[audit-log] Failed to initialize lifecycle hooks:', error);
  }
};
