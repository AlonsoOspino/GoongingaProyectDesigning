function hasNetworkRole(user, ...roles) {
  return Array.isArray(user?.roles) && user.roles.some((role) => roles.includes(role));
}

function hasManagerAccess(user) {
  return Boolean(
    user &&
    (user.role === "MANAGER" ||
      user.role === "ADMIN" ||
      hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN")),
  );
}

module.exports = { hasNetworkRole, hasManagerAccess };
