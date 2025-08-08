import { database } from "../Database/firebaseConfig";
import {
  ref,
  push,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
} from "firebase/database";

// Registra un nuevo histórico en Firebase
const guardarEnHistorial = (registro) => {
  const historialRef = ref(database, "historialdecambios");
  push(historialRef, {
    ...registro,
    timestamp: Date.now(),
    fechaRegistro: obtenerFecha(),
    horaRegistro: obtenerHora(),
  }).catch((error) => {
    console.error("Error guardando historial:", error);
  });
};

// Genera descripción legible del cambio
const generarDescripcionCambio = (tabla, id, registro, tipo) => {
  const campos = Object.keys(registro).filter(
    (k) => !["fecha", "hora", "usuario", "timestamp", "fechaRegistro", "horaRegistro"].includes(k)
  );
  if (campos.length === 0) return `${tipo} en "${tabla}"`;
  const detalles = campos
    .slice(0, 3)
    .map((c) => {
      const v = registro[c];
      const valor = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${c}: ${valor}`;
    })
    .join(" | ");
  return `${tipo} en "${tabla}" → ${detalles}`;
};

// Genera descripción detallada para ediciones
const generarDescripcionEdicion = (tabla, id, datosAntes, datosDespues) => {
  const camposIgnorar = ["fecha", "hora", "usuario", "timestamp", "fechaRegistro", "horaRegistro"];
  const cambios = [];
  
  // Comparar todos los campos
  const todosCampos = new Set([...Object.keys(datosAntes), ...Object.keys(datosDespues)]);
  
  todosCampos.forEach(campo => {
    if (camposIgnorar.includes(campo)) return;
    
    const valorAntes = datosAntes[campo] || "";
    const valorDespues = datosDespues[campo] || "";
    
    if (valorAntes !== valorDespues) {
      const antes = String(valorAntes);
      const despues = String(valorDespues);
      cambios.push(`${campo}: "${antes}" → "${despues}"`);
    }
  });
  
  if (cambios.length === 0) {
    return `EDITADO en "${tabla}" - Sin cambios detectados`;
  }
  
  return `EDITADO en "${tabla}" → ${cambios.join(" | ")}`;
};

// Utilidades de fecha/hora
const obtenerFecha = () => {
  const h = new Date();
  return `${String(h.getDate()).padStart(2, "0")}-${String(
    h.getMonth() + 1
  ).padStart(2, "0")}-${h.getFullYear()}`;
};

const obtenerHora = () =>
  new Date().toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// Variables de control
let trackerIniciado = false;
let datosAnteriores = new Map(); // Para comparar cambios

// Función principal que inicia el seguimiento de cambios
export const iniciarSeguimientoHistorial = () => {
  if (trackerIniciado) return;
  
  trackerIniciado = true;
  console.log("🟢 Iniciando tracker de historial");

  const tablas = ["data", "hojamañana", "hojapasadomañana", "registrofechas", "facturas", "informedeefectivo"];

  tablas.forEach((tabla) => {
    const tablaRef = ref(database, tabla);
    let inicializado = false;

    // Cargar datos existentes para comparaciones (sin generar historial)
    onChildAdded(tablaRef, (snap) => {
      if (inicializado) {
        // Ya inicializado, es un registro nuevo
        const r = snap.val();
        datosAnteriores.set(`${tabla}_${snap.key}`, r);
        
        const cambio = generarDescripcionCambio(tabla, snap.key, r, "CREADO");
        guardarEnHistorial({
          ...r,
          id: snap.key,
          lugar: tabla,
          cambio,
          fecha: r.fecha || obtenerFecha(),
          hora: r.hora || obtenerHora(),
          usuario: r.usuario || "desconocido",
        });
      } else {
        // Carga inicial, solo guardar para comparaciones
        datosAnteriores.set(`${tabla}_${snap.key}`, snap.val());
      }
    });

    // EDICIÓN - Inmediato
    onChildChanged(tablaRef, (snap) => {
      const r = snap.val();
      const datosAntes = datosAnteriores.get(`${tabla}_${snap.key}`) || {};
      
      const cambio = generarDescripcionEdicion(tabla, snap.key, datosAntes, r);
      datosAnteriores.set(`${tabla}_${snap.key}`, r);
      
      guardarEnHistorial({
        ...r,
        id: snap.key,
        lugar: tabla,
        cambio,
        fecha: r.fecha || obtenerFecha(),
        hora: r.hora || obtenerHora(),
        usuario: r.usuario || "desconocido",
      });
    });

    // ELIMINACIÓN - Inmediato
    onChildRemoved(tablaRef, (snap) => {
      const r = snap.val() || {};
      const cambio = `Registro ELIMINADO en "${tabla}"`;
      guardarEnHistorial({
        ...r,
        id: snap.key,
        lugar: tabla,
        cambio,
        fecha: r.fecha || obtenerFecha(),
        hora: r.hora || obtenerHora(),
        usuario: r.usuario || "desconocido",
      });
    });

    // Marcar como inicializado después de un breve delay para cargar datos existentes
    setTimeout(() => {
      inicializado = true;
      console.log(`✅ ${tabla} listo`);
    }, 50);
  });
};