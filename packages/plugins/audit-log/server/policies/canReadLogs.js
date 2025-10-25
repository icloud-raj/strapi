'use strict';

module.exports = async (ctx, next) => {
  const user = ctx.state.user;
  
  if (!user) {
    return ctx.unauthorized('Authentication required');
  }
  
  // Super Admin or root users have access
  if (user.role?.name === 'Super Admin' || user.role?.type === 'root') {
    return next();
  }
  
  // Check for specific audit log permission
  // This would need to be implemented based on your permission system
  return ctx.forbidden('read_audit_logs permission required');
};
