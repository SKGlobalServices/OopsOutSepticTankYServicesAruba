import { ref, get } from 'firebase/database';
import { database } from '../Database/firebaseConfig';
import { decryptData } from './security';

export const validateSession = async () => {
  try {
    const userData = decryptData(localStorage.getItem("user"));
    const sessionId = localStorage.getItem("sessionId");
    
    if (!userData || !sessionId || userData.role?.toLowerCase() !== "user") {
      return true; // No validar para admin/contador
    }
    
    const userRef = ref(database, `users/${userData.id}/activeSession`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists() || snapshot.val() !== sessionId) {
      // Sesión inválida
      localStorage.clear();
      alert("Sesión inválida. Redirigiendo al login.");
      window.location.href = "/";
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error validando sesión");
    return false;
  }
};

export const validateSessionForAction = async (actionName) => {
  const isValid = await validateSession();
  if (!isValid) {
    console.log(`Acción bloqueada: ${actionName} - Sesión inválida`);
    return false;
  }
  return true;
};