// Utilidades de seguridad
export const sanitizeForLog = (data) => {
  if (typeof data === 'string') {
    return data.replace(/[<>\"'&]/g, '***');
  }
  return '***';
};

export const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
};

export const validatePassword = (password) => {
  return password.length >= 6 && password.length <= 128;
};

export const encryptData = (data) => {
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return null;
  }
};

export const decryptData = (encryptedData) => {
  try {
    return JSON.parse(atob(encryptedData));
  } catch {
    return null;
  }
};

export const validateRole = (userRole, allowedRoles) => {
  return allowedRoles.includes(userRole?.toLowerCase());
};

// Rate limiting por email
const loginAttempts = new Map();

export const checkRateLimit = (email) => {
  const now = Date.now();
  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: now };
  
  // Reset después de 5 minutos
  if (now - attempts.lastAttempt > 5 * 60 * 1000) {
    attempts.count = 0;
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  loginAttempts.set(email, attempts);
  
  return attempts.count <= 5; // Máximo 5 intentos por 5 min
};