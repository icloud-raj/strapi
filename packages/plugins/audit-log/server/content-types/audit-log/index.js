'use strict';

module.exports = {
  collectionName: 'audit_logs',
  info: {
    displayName: 'Audit Log',
    singularName: 'audit-log',
    pluralName: 'audit-logs'
  },
  options: {
    draftAndPublish: false,
    // Add indexes for efficient querying
    indexes: [
      {
        name: 'audit_logs_content_type_idx',
        columns: ['content_type'],
      },
      {
        name: 'audit_logs_user_id_idx',
        columns: ['user_id'],
      },
      {
        name: 'audit_logs_action_idx',
        columns: ['action'],
      },
      {
        name: 'audit_logs_timestamp_idx',
        columns: ['timestamp'],
      },
      {
        name: 'audit_logs_composite_idx',
        columns: ['content_type', 'action', 'timestamp'],
      },
    ],
  },
  pluginOptions: {
    'content-manager': {
      visible: false
    }
  },
  attributes: {
    action: {
      type: 'enumeration',
      enum: ['create', 'update', 'delete'],
      required: true
    },
    contentType: {
      type: 'string',
      required: true
    },
    recordId: {
      type: 'string',
      required: true
    },
    userId: {
      type: 'integer'
    },
    timestamp: {
      type: 'datetime',
      required: true
    },
    changedKeys: {
      type: 'json'
    },
    diff: {
      type: 'json'
    },
    blobPath: {
      type: 'string'
    },
    eventId: {
      type: 'string',
      required: true
    }
  }
};
