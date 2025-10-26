'use strict';

const fs = require('fs');
const { existsSync, readFileSync } = fs;
const zlib = require('zlib');

module.exports = {
  async find(ctx) {
    try {
      const query = ctx.query;
      const filters = {};
      
      // Build filters
      if (query.contentType) filters.contentType = query.contentType;
      if (query.userId) filters.userId = query.userId; // Fixed: was 'user', should be 'userId'
      if (query.action) filters.action = query.action;
      
      // Date range filtering with validation
      if (query.startDate || query.endDate) {
        filters.timestamp = {};
        if (query.startDate) {
          const startDate = new Date(query.startDate);
          if (isNaN(startDate.getTime())) {
            return ctx.badRequest('Invalid startDate format');
          }
          filters.timestamp.$gte = startDate.toISOString();
        }
        if (query.endDate) {
          const endDate = new Date(query.endDate);
          if (isNaN(endDate.getTime())) {
            return ctx.badRequest('Invalid endDate format');
          }
          filters.timestamp.$lte = endDate.toISOString();
        }
      }
      
      // Pagination with validation
      const limit = Math.min(Math.max(parseInt(query._limit) || 10, 1), 100);
      const page = Math.max(parseInt(query._page) || 1, 1);
      
      // Fetch data
      const data = await strapi.entityService.findMany('plugin::audit-log.audit-log', {
        filters,
        limit,
        start: (page - 1) * limit,
        sort: [query._sort || 'timestamp:desc']
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
      // Validate ID parameter
      const id = parseInt(ctx.params.id);
      if (isNaN(id) || id < 1) {
        return ctx.badRequest('Invalid audit log ID');
      }
      
      const entry = await strapi.entityService.findOne(
        'plugin::audit-log.audit-log',
        id
      );
      
      if (!entry) {
        return ctx.notFound('Audit log not found');
      }
      
      // For db-file backend, decompress and return the blob as JSON
      if (entry.blobPath && existsSync(entry.blobPath)) {
        try {
          const compressed = readFileSync(entry.blobPath);
          const decompressed = zlib.gunzipSync(compressed);
          const diffData = JSON.parse(decompressed.toString());
          
          ctx.body = {
            metadata: {
              id: entry.id,
              action: entry.action,
              contentType: entry.contentType,
              recordId: entry.recordId,
              userId: entry.userId,
              timestamp: entry.timestamp,
              changedKeys: entry.changedKeys
            },
            diff: diffData
          };
        } catch (err) {
          strapi.log.error('[audit-log] Error reading blob file:', err);
          ctx.body = {
            message: 'Error reading diff data',
            metadata: entry
          };
        }
      } 
      // For db backend, return the diff data directly
      else if (entry.diff) {
        ctx.body = {
          metadata: {
            id: entry.id,
            action: entry.action,
            contentType: entry.contentType,
            recordId: entry.recordId,
            userId: entry.userId,
            timestamp: entry.timestamp,
            changedKeys: entry.changedKeys
          },
          diff: entry.diff
        };
      } 
      // No diff data available
      else {
        ctx.body = {
          message: 'No diff data available',
          metadata: entry
        };
      }
      
    } catch (error) {
      strapi.log.error('[audit-log] Blob controller error:', error);
      ctx.throw(500, 'Internal server error');
    }
  }
};
