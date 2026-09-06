const PRIVILEGED_ROLES = new Set(['Admin', 'Manager']);

export const hasInventoryAccess = (user) => Boolean(
  user && (PRIVILEGED_ROLES.has(user.role) || user.permissions?.includes('view_inventory'))
);

export const inventoryVisibilityFilter = (user) => (
  hasInventoryAccess(user) ? {} : { _id: null }
);
