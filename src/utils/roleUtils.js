export const normalizeRole = (role) =>
  String(role || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();

export const isAdminRole = (role) => normalizeRole(role) === "admin";

export const isAssistantAdministrativeRole = (role) =>
  normalizeRole(role) === "asistenteadministrativo";

export const isAdminLikeRole = (role) =>
  isAdminRole(role) || isAssistantAdministrativeRole(role);

export const isOperativeRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "user" || normalizedRole === "coordinador";
};

export const isCoordinatorRole = (role) => normalizeRole(role) === "coordinador";

export const getLandingRouteForRole = (role) => {
  switch (normalizeRole(role)) {
    case "admin":
      return "/dashboard";
    case "asistenteadministrativo":
      return "/homepage";
    case "user":
    case "coordinador":
      return "/agendadeldiausuario";
    case "contador":
      return "/informedetransferenciascontador";
    default:
      return "/";
  }
};