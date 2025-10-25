'use strict';

const { v4: uuidv4 } = require('uuid');
const _ = require('lodash');

module.exports = ({ strapi }) => {
  const cfg = strapi.config.get('plugin.audit-log.config', {});
  const backend = require(`./backends/${cfg.backend || 'db-file'}`)({ strapi, config: cfg });
  
  // Smart diff algorithm
  function diff(action, before, after) {
    if (action === 'create') return { after };
    if (action === 'delete') return { before };
    
    // For updates, only store changed fields
    const changes = {};
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {})
    ]);
    
    for (const key of allKeys) {
      if (!_.isEqual(before?.[key], after?.[key])) {
        changes[key] = {
          before: before?.[key],
          after: after?.[key]
        };
      }
    }
    
    return changes;
  }
  
  return {
    async record({ action, event }) {
      try {
        const model = event.model || {};
        const result = event.result || {};
        const params = event.params || {};
        const state = event.state || {};
        
        // Extract user information
        const user = state.auth?.credentials?.user || 
                    state.user || 
                    null;
        
        // Build metadata
        const meta = {
          eventId: uuidv4(),
          action,
          contentType: model.uid || 'unknown',
          recordId: String(result?.id || params?.where?.id || uuidv4()),
          user: user?.id || null,
          timestamp: new Date().toISOString()
        };
        
        // Calculate diff
        const diffData = diff(action, params.dataBefore, result);
        meta.changedKeys = Object.keys(diffData || {});
        
        // Write via backend (sync or async based on config)
        if ((cfg.mode || 'sync') === 'sync') {
          await backend.writeNow(meta, diffData);
        } else {
          await strapi.plugin('audit-log').service('queue')
            .addJob({ meta, diff: diffData });
        }
        
      } catch (error) {
        strapi.log.error('[audit-log] Failed to record audit log:', error);
      }
    }
  };
};
