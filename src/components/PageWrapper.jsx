import React, { useEffect } from "react";
import LoadingScreen from "./LoadingScreen";
import { useGlobalLoading } from "../utils/useGlobalLoading";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { decryptData } from "../utils/security";
import { database } from "../Database/firebaseConfig";
import { ref, update } from "firebase/database";

const PageWrapper = ({ children }) => {
  const globalLoading = useGlobalLoading();
  const navigate = useNavigate();

  // Función de logout (igual que en Slidebar)
  const handleLogout = async () => {
    const userData = decryptData(localStorage.getItem("user"));
    if (userData && userData.id && userData.role?.toLowerCase() === "user") {
      try {
        const userRef = ref(database, `users/${userData.id}`);
        await update(userRef, { activeSession: null });
      } catch (error) {
        console.error("Error al limpiar sesión:", error);
      }
    }
    localStorage.clear();
    sessionStorage.clear();
    navigate("/");
  };

  // Cierre automático con alerta
  const handleAutomaticLogout = async () => {
    let countdown = 30;

    await Swal.fire({
      icon: "warning",
      title: "Plataforma Cerrada",
      html: `La plataforma está cerrada en este horario 11:30pm a 1:00am, serás redireccionado al login.<br><br>Cerrando sesión en <b>${countdown}</b> segundos`,
      confirmButtonText: "Aceptar",
      allowOutsideClick: false,
      allowEscapeKey: false,
      timer: 30000,
      timerProgressBar: true,
      didOpen: () => {
        const timer = setInterval(() => {
          countdown--;
          Swal.getHtmlContainer().innerHTML = `La plataforma está cerrada en este horario 11:30pm a 1:00am, serás redireccionado al login.<br><br>Cerrando sesión en <b>${countdown}</b> segundos`;
          if (countdown <= 0) clearInterval(timer);
        }, 1000);
      },
    });

    handleLogout();
  };

  useEffect(() => {
    const checkPlatformClosure = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // De 23:30 a 23:59 o de 00:00 a 00:59
      if ((hour === 23 && minute >= 30) || hour === 0) {
        handleAutomaticLogout();
      }
    };

    // Verificar inmediatamente
    checkPlatformClosure();

    // Verificar cada minuto
    const interval = setInterval(checkPlatformClosure, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {globalLoading && <LoadingScreen />}
      {children}
    </>
  );
};

export default React.memo(PageWrapper);
