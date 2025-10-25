'use strict';

module.exports = () => ({
  graphql: {
    enabled: true,
    config: {
      endpoint: '/graphql',

      defaultLimit: 25,
      maxLimit: 100,

      apolloServer: {
        tracing: true,
      },

      v4CompatibilityMode: true,
    },
  },
  documentation: {
    config: {
      info: {
        version: '1.0.0',
      },
    },
  },
  myplugin: {
    enabled: true,
    resolve: `./src/plugins/local-plugin`, // From the root of the project
    config: {
      testConf: 3,
    },
  },
  // NOTE: set enabled:true to test with a pre-built plugin. Make sure to run yarn build in the plugin folder first
  todo: {
    enabled: false,
    resolve: `../plugins/todo-example`, // From the /examples/plugins folder
  },
  'audit-log': {
    enabled: true,
    resolve: `../../packages/plugins/audit-log`, // From the monorepo packages
    config: {
      mode: 'sync',                    // 'sync' or 'async'
      backend: 'db-file',              // 'db', 'db-file', 'db-s3'
      excludeContentTypes: [
        'plugin::audit-log.audit-log', // Don't audit the audit logs
        'admin::user',                 // Exclude sensitive content types
        'plugin::upload.file'
      ],
      queue: {
        redis: 'redis://localhost:6379'
      },
      storage: {
        file: {
          basePath: './data/audit_blobs'
        }
      }
    }
  }
});
