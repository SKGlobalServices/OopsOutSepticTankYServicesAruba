import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import Swal from "sweetalert2";

// Hook de guardas para las pantallas del informe de efectivo.
// Muestra un aviso informativo al entrar y protege la salida cuando hay cambios sin guardar.
export const useInformeEfectivoGuards = ({
  isDirty,
  moduleLabel,
  entryTitle,
  entryText,
  exitTitle,
  exitText,
}) => {
  const blocker = useBlocker(isDirty);
  const exitPromptOpenRef = useRef(false);

  // Aviso de entrada: explica el nuevo flujo de guardado con un modal informativo.
  // El timeout de 0ms evita mostrarlo durante el render y ayuda a no duplicarlo en desarrollo.
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      Swal.fire({
        icon: "info",
        title: entryTitle || `Actualización de ${moduleLabel}`,
        text:
          entryText ||
          "Se hicieron actualizaciones en este módulo. A partir de ahora, los cambios se confirman con el botón Guardar Cambios.",
        confirmButtonText: "Entendido",
      });
    }, 3500);

    return () => window.clearTimeout(timerId);
  }, [entryText, entryTitle, moduleLabel]);

  // Protege el cierre o recarga del navegador. En beforeunload el navegador no permite usar un modal custom.
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Bloquea la navegación dentro del SPA cuando hay cambios pendientes y confirma la salida con SweetAlert2.
  useEffect(() => {
    if (blocker.state !== "blocked" || exitPromptOpenRef.current) return;

    exitPromptOpenRef.current = true;

    Swal.fire({
      icon: "warning",
      title: exitTitle || "Cambios pendientes por guardar",
      text:
        exitText ||
        `Tienes cambios pendientes en ${moduleLabel}. Si sales sin guardar, perderás esos cambios.`,
      showCancelButton: true,
      confirmButtonText: "Salir sin guardar",
      cancelButtonText: "Quedarme",
    }).then((result) => {
      exitPromptOpenRef.current = false;

      if (result.isConfirmed) {
        blocker.proceed();
        return;
      }

      blocker.reset();
    });
  }, [blocker, exitText, exitTitle, moduleLabel]);
};