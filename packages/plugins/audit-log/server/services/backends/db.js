'use strict';

module.exports = ({ strapi }) => ({
  async writeNow(meta, diff) {
    try {
      await strapi.entityService.create('plugin::audit-log.audit-log', {
        data: {
          ...meta,
          diff: diff
        }
      });
    } catch (error) {
      strapi.log.error('[audit-log] db backend error:', error);
      throw error;
    }
  }
});
