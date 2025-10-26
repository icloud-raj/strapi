'use strict';

const { v4: uuidv4 } = require('uuid');
const _ = require('lodash');

module.exports = ({ strapi }) => {
  const cfg = strapi.config.get('plugin::audit-log.config', {});
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
        
        // Safety check: prevent recording audit logs of audit logs (redundant but safe)
        if (model.uid === 'plugin::audit-log.audit-log') {
          return;
        }
        
        // Extract user information from request context (Strapi v5 way)
        const requestState = strapi.requestContext?.get()?.state;
        const user = requestState?.user || null;
        
        // Determine record ID
        const recordId = result?.id || result?.documentId || params?.where?.id || params?.where?.documentId;
        if (!recordId) {
          strapi.log.warn('[audit-log] Could not determine record ID for audit log');
          return;
        }
        
        // Build metadata
        const meta = {
          eventId: uuidv4(),
          action,
          contentType: model.uid || 'unknown',
          recordId: String(recordId),
          userId: user?.id || null,
          timestamp: new Date().toISOString()
        };
        
        // For updates, fetch the before state if not provided by lifecycle hook
        let dataBefore = params.dataBefore;
        if (action === 'update' && !dataBefore && recordId) {
          try {
            dataBefore = await strapi.db.query(model.uid).findOne({
              where: { id: recordId }
            });
          } catch (err) {
            strapi.log.debug('[audit-log] Could not fetch before state:', err.message);
          }
        }
        
        // Calculate diff
        const diffData = diff(action, dataBefore, result);
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
        // Don't rethrow - we don't want audit failures to break the main operation
      }
    }
  };
};
