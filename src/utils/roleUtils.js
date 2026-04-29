export const normalizeRole = (role) => String(role || "").toLowerCase();

export const isOperativeRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "user" || normalizedRole === "coordinador";
};

export const isCoordinatorRole = (role) => normalizeRole(role) === "coordinador";