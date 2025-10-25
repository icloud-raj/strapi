'use strict';

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { v4: uuidv4 } = require('uuid');

module.exports = ({ strapi, config }) => {
  const basePath = config.storage?.file?.basePath || './data/audit_blobs';
  
  return {
    async writeNow(meta, diff) {
      try {
        // Generate unique file path
        const id = uuidv4();
        const filename = `${Date.now()}-${id}.json.gz`;
        const filepath = path.join(basePath, filename);
        
        // Ensure directory exists
        await fs.mkdir(basePath, { recursive: true });
        
        // Compress and write diff to file
        const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(diff || {})));
        await fs.writeFile(filepath, compressed);
        
        // Store metadata in database
        await strapi.entityService.create('plugin::audit-log.audit-log', {
          data: {
            ...meta,
            blobPath: filepath
          }
        });
        
      } catch (error) {
        strapi.log.error('[audit-log] db-file backend error:', error);
        throw error;
      }
    }
  };
};
