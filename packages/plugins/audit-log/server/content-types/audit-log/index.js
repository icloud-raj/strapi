'use strict';

module.exports = {
  collectionName: 'audit_logs',
  info: {
    displayName: 'Audit Log',
    singularName: 'audit-log',
    pluralName: 'audit-logs'
  },
  options: {
    draftAndPublish: false
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
    user: {
      type: 'relation',
      relation: 'oneToOne',
      target: 'admin::user'
    },
    timestamp: {
      type: 'datetime',
      required: true
    },
    changedKeys: {
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
