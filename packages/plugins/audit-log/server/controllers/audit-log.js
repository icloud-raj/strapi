'use strict';

module.exports = {
  async find(ctx) {
    try {
      const query = ctx.query;
      const filters = {};
      
      // Build filters
      if (query.contentType) filters.contentType = query.contentType;
      if (query.userId) filters.user = query.userId;
      if (query.action) filters.action = query.action;
      
      // Date range filtering
      if (query.startDate || query.endDate) {
        filters.timestamp = {};
        if (query.startDate) {
          filters.timestamp.$gte = new Date(query.startDate).toISOString();
        }
        if (query.endDate) {
          filters.timestamp.$lte = new Date(query.endDate).toISOString();
        }
      }
      
      // Pagination
      const limit = parseInt(query._limit || 10);
      const page = parseInt(query._page || 1);
      
      // Fetch data
      const data = await strapi.entityService.findMany('plugin::audit-log.audit-log', {
        filters,
        limit,
        start: (page - 1) * limit,
        sort: [query._sort || 'timestamp:desc'],
        populate: ['user']
      });
      
      // Get total count
      const count = await strapi.entityService.count('plugin::audit-log.audit-log', {
        filters
      });
      
      ctx.body = {
        data,
        meta: {
          pagination: {
            page,
            pageSize: limit,
            pageCount: Math.ceil(count / limit),
            total: count
          }
        }
      };
      
    } catch (error) {
      strapi.log.error('[audit-log] Controller error:', error);
      ctx.throw(500, 'Internal server error');
    }
  },
  
  async findOneBlob(ctx) {
    try {
      const entry = await strapi.entityService.findOne(
        'plugin::audit-log.audit-log',
        ctx.params.id
      );
      
      if (!entry) {
        return ctx.notFound('Audit log not found');
      }
      
      if (entry.blobPath && require('fs').existsSync(entry.blobPath)) {
        ctx.set('Content-Type', 'application/gzip');
        ctx.body = require('fs').createReadStream(entry.blobPath);
      } else {
        ctx.body = {
          message: 'No blob data available',
          entry
        };
      }
      
    } catch (error) {
      strapi.log.error('[audit-log] Blob controller error:', error);
      ctx.throw(500, 'Internal server error');
    }
  }
};
