'use strict';

module.exports = (policyContext) => {
  const { user, userAbility } = policyContext.state;
  
  // User must be authenticated
  if (!user) {
    return false;
  }
  
  // User must have ability object
  if (!userAbility) {
    return false;
  }
  
  // Check if user has read_audit_logs permission using CASL ability
  return userAbility.can('plugin::audit-log.read', null);
};
