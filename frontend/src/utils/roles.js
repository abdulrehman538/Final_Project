export const OFFICIAL_ROLES = ["admin", "seller"];

export function normalizeRole(role) {
  const normalized = (role || "user").toString().toLowerCase();

  if (normalized === "buyer") {
    return "user";
  }

  if (OFFICIAL_ROLES.includes(normalized)) {
    return normalized;
  }

  return "user";
}

export function isAdmin(role) {
  return normalizeRole(role) === "admin";
}

export function isSeller(role) {
  return normalizeRole(role) === "seller";
}

export function isOfficialRole(role) {
  return OFFICIAL_ROLES.includes(normalizeRole(role));
}

export function canBecomeSeller(role, isAuthenticated = false) {
  return isAuthenticated && !isAdmin(role) && !isSeller(role);
}

export function needsPortalAuth(role) {
  return isAdmin(role) || isSeller(role);
}

export function getPostLoginPath(role) {
  const normalized = normalizeRole(role);

  if (normalized === "admin") {
    return "/dashboard";
  }

  if (normalized === "seller") {
    return "/seller-dashboard";
  }

  return "/profile";
}
