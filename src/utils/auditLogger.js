import { get, push, ref, remove, set, update } from "firebase/database";
import { database } from "../Database/firebaseConfig";
import { decryptData } from "./security";


// ============================================================
// AUDIT LOGGER - Registro centralizado de cambios de admin
// ============================================================

// Mapa de nombres legibles para campos técnicos de Firebase
const CAMPO_LABELS = {
  realizadopor: "Realizado Por",
  anombrede: "A Nombre De",
  direccion: "Dirección",
  servicio: "Servicio",
  cubicos: "Cúbicos",
  valor: "Valor",
  pago: "Pago",
  formadepago: "Forma De Pago",
  banco: "Banco",
  notas: "Notas",
  metododepago: "Método De Pago",
  efectivo: "Efectivo",
  factura: "Factura",
  nombre: "Nombre",
  telefono: "Teléfono",
  email: "Email",
  hora: "Hora",
  numerodeorden: "Número De Orden",
  observaciones: "Observaciones",
  fechapago: "Fecha De Pago",
  payment: "Payment",
  password: "Contraseña",
  role: "Rol",
  name: "Nombre",
  frecuencia: "Frecuencia",
  lastService: "Último Servicio",
  tipo: "Tipo",
  candadoservicioshoy: "Candado Servicios Hoy",
  candadoserviciosmañana: "Candado Servicios Mañana",
  creadoEn: "Creado En",
  extra: "Extra",
  estado: "Estado",
  recibido: "Recibido",
  qty: "Cantidad",
  rate: "Tarifa",
  amount: "Monto",
  item: "Item",
  descripcion: "Descripción",
  servicioextra: "Servicio Extra",
  numerodefactura: "N° Factura",
  referenciaFactura: "Referencia Factura",
};

/**
 * Devuelve el nombre legible de un campo, o el campo original con formato si no está mapeado.
 */
const getCampoLabel = (campo) => {
  return CAMPO_LABELS[campo] || campo;
};

// Cache de usuarios para resolver IDs a nombres
let usersCache = null;
let usersCacheTimestamp = 0;
const USERS_CACHE_TTL = 60000; // 1 minuto

/**
 * Obtiene los usuarios de Firebase (con cache de 1 minuto).
 */
const getUsers = async () => {
  const now = Date.now();
  if (usersCache && (now - usersCacheTimestamp) < USERS_CACHE_TTL) {
    return usersCache;
  }
  try {
    const snapshot = await get(ref(database, "users"));
    if (snapshot.exists()) {
      usersCache = snapshot.val();
      usersCacheTimestamp = now;
      return usersCache;
    }
  } catch {
    // Si falla, retornar cache anterior o vacío
  }
  return usersCache || {};
};

/**
 * Resuelve un valor a su forma legible.
 * Por ejemplo, si el campo es "realizadopor" y el valor es un ID de usuario,
 * devuelve el nombre del usuario en lugar del ID.
 */
const resolverValor = async (campo, valor) => {
  if (valor === undefined || valor === null || valor === "") return valor;
  
  // Para "realizadopor", resolver ID de usuario a nombre
  if (campo === "realizadopor") {
    const users = await getUsers();
    if (users && users[valor] && users[valor].name) {
      return users[valor].name;
    }
  }
  
  // Para "factura", mostrar Sí/No
  if (campo === "factura") {
    if (valor === true || valor === "true") return "Sí";
    if (valor === false || valor === "false") return "No";
  }
  
  return valor;
};

// Función para obtener el usuario admin logueado desde localStorage
const getAdminUser = () => {
  try {
    const userData = decryptData(localStorage.getItem("user"));
    if (!userData || userData.role?.toLowerCase() !== "admin") {
      return null;
    }
    return userData;
  } catch {
    return null;
  }
};

/**
 * Formatea la fecha y hora actual en formato legible.
 */
const getFormattedDateTime = () => {
  const now = new Date();
  const fecha = now.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }); // "03-03-2026"
  const hora = now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }); // "14:30:25"
  return { fecha, hora, timestamp: now.getTime() };
};

/**
 * Genera un detalle legible del cambio.
 */
const generarDetalle = (accion, modulo, campoLabel, valorAnterior, valorNuevo, extra) => {
  switch (accion) {
    case "crear":
      return `Creó un nuevo registro en ${modulo}${extra ? `: ${extra}` : ""}`;
    case "editar":
      if (campoLabel) {
        const anterior = valorAnterior !== undefined && valorAnterior !== null && valorAnterior !== ""
          ? `"${valorAnterior}"`
          : "(vacío)";
        const nuevo = valorNuevo !== undefined && valorNuevo !== null && valorNuevo !== ""
          ? `"${valorNuevo}"`
          : "(vacío)";
        return `Cambió en "${campoLabel}" de ${anterior} a ${nuevo}`;
      }
      return `Editó un registro en ${modulo}`;
    case "eliminar":
      return `Eliminó un registro de ${modulo}${extra ? `: ${extra}` : ""}`;
    case "mover":
      return `Movió un registro${extra ? `: ${extra}` : ""}`;
    default:
      return `Realizó una acción en ${modulo}`;
  }
};

/**
 * Registra un cambio en el nodo "historialcambios" de Firebase.
 * Solo registra si el usuario logueado es admin.
 *
 * @param {Object} params
 * @param {string} params.modulo        - Nombre visible del módulo ("Hoja de Servicios")
 * @param {string} params.nodoFirebase  - Nodo real en Firebase ("data")
 * @param {string} params.accion        - "crear" | "editar" | "eliminar" | "mover"
 * @param {string} params.registroId    - ID del registro afectado
 * @param {string} [params.campo]       - Campo específico que cambió
 * @param {*}      [params.valorAnterior] - Valor antes del cambio
 * @param {*}      [params.valorNuevo]    - Valor después del cambio
 * @param {string} [params.extra]       - Info adicional para el detalle
 */
const registrarCambio = async ({
  modulo,
  nodoFirebase,
  accion,
  registroId,
  campo,
  valorAnterior,
  valorNuevo,
  extra,
}) => {
  try {
    const adminUser = getAdminUser();
    if (!adminUser) return; // No es admin, no registrar

    const { fecha, hora, timestamp } = getFormattedDateTime();

    // Resolver nombres legibles
    const campoLabel = campo ? getCampoLabel(campo) : null;
    const valorAnteriorLegible = campo ? await resolverValor(campo, valorAnterior) : valorAnterior;
    const valorNuevoLegible = campo ? await resolverValor(campo, valorNuevo) : valorNuevo;

    const registro = {
      timestamp,
      fecha,
      hora,
      usuario: adminUser.name || "Admin desconocido",
      usuarioId: adminUser.id,
      modulo,
      nodoFirebase,
      accion,
      registroId: registroId || "N/A",
      campo: campoLabel || null,
      valorAnterior: valorAnteriorLegible !== undefined ? String(valorAnteriorLegible) : null,
      valorNuevo: valorNuevoLegible !== undefined ? String(valorNuevoLegible) : null,
      detalle: generarDetalle(accion, modulo, campoLabel, valorAnteriorLegible, valorNuevoLegible, extra),
    };

    const historialRef = ref(database, "historialcambios");
    const newRef = push(historialRef);
    await set(newRef, registro);
  } catch (error) {
    // No bloquear la operación principal si falla el log
    console.error("Error al registrar cambio en historial:", error);
  }
};

/**
 * Wrapper para update() que registra el cambio automáticamente.
 *
 * @param {string} path       - Ruta en Firebase (ej: "data/-NaBcD")
 * @param {Object} updates    - Campos a actualizar { campo: valor }
 * @param {Object} auditInfo  - Info para el historial
 * @param {string} auditInfo.modulo      - Nombre del módulo
 * @param {string} auditInfo.registroId  - ID del registro
 * @param {Object} [auditInfo.prevData]  - Datos anteriores del registro (para comparar)
 * @param {string} [auditInfo.extra]     - Info adicional
 */
export const auditUpdate = async (path, updates, auditInfo) => {
  const dbRef = ref(database, path);

  // Ejecutar la operación principal primero
  await update(dbRef, updates);

  // Registrar cada campo cambiado (fire-and-forget, no bloquea)
  for (const [campo, valorNuevo] of Object.entries(updates)) {
    const valorAnterior = auditInfo.prevData ? auditInfo.prevData[campo] : undefined;

    // Solo registrar si el valor realmente cambió
    if (valorAnterior !== undefined && String(valorAnterior) === String(valorNuevo)) {
      continue;
    }

    registrarCambio({
      modulo: auditInfo.modulo,
      nodoFirebase: path.split("/")[0],
      accion: "editar",
      registroId: auditInfo.registroId,
      campo,
      valorAnterior,
      valorNuevo,
      extra: auditInfo.extra,
    }).catch(() => {});
  }
};

/**
 * Wrapper para push() + set() que registra la creación.
 *
 * @param {string} path       - Ruta padre en Firebase (ej: "data")
 * @param {Object} data       - Datos del nuevo registro
 * @param {Object} auditInfo  - Info para el historial
 * @param {string} auditInfo.modulo - Nombre del módulo
 * @param {string} [auditInfo.extra] - Info adicional (ej: nombre del cliente)
 * @returns {Object} La referencia del nuevo registro (para obtener el key)
 */
export const auditCreate = async (path, data, auditInfo) => {
  const dbRef = ref(database, path);
  const newRef = push(dbRef);

  await set(newRef, data);

  // Fire-and-forget: no bloquea la operación principal
  registrarCambio({
    modulo: auditInfo.modulo,
    nodoFirebase: path.split("/")[0],
    accion: "crear",
    registroId: newRef.key,
    extra: auditInfo.extra,
  }).catch(() => {});

  return newRef;
};

/**
 * Wrapper para set() directo (sin push) que registra la creación/reemplazo.
 *
 * @param {string} path       - Ruta completa en Firebase (ej: "data/-NaBcD")
 * @param {Object} data       - Datos a escribir
 * @param {Object} auditInfo  - Info para el historial
 * @param {string} auditInfo.modulo      - Nombre del módulo
 * @param {string} auditInfo.registroId  - ID del registro
 * @param {string} [auditInfo.accion]    - "crear" | "mover" (default: "crear")
 * @param {string} [auditInfo.extra]     - Info adicional
 */
export const auditSet = async (path, data, auditInfo) => {
  const dbRef = ref(database, path);
  await set(dbRef, data);

  // Fire-and-forget: no bloquea la operación principal
  registrarCambio({
    modulo: auditInfo.modulo,
    nodoFirebase: path.split("/")[0],
    accion: auditInfo.accion || "crear",
    registroId: auditInfo.registroId || path.split("/").pop(),
    extra: auditInfo.extra,
  }).catch(() => {});
};

/**
 * Wrapper para remove() que registra la eliminación.
 * Lee los datos antes de eliminar para guardarlos en el historial.
 *
 * @param {string} path       - Ruta completa en Firebase (ej: "data/-NaBcD")
 * @param {Object} auditInfo  - Info para el historial
 * @param {string} auditInfo.modulo      - Nombre del módulo
 * @param {string} auditInfo.registroId  - ID del registro
 * @param {string} [auditInfo.extra]     - Info adicional (ej: nombre del cliente eliminado)
 */
export const auditRemove = async (path, auditInfo) => {
  const dbRef = ref(database, path);

  // Solo leer datos antes de eliminar si no se proporcionó 'extra'
  let datosEliminados = null;
  if (!auditInfo.extra) {
    try {
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        datosEliminados = snapshot.val();
      }
    } catch {
      // Si no puede leer, continuar igual
    }
  }

  await remove(dbRef);

  // Fire-and-forget: no bloquea la operación principal
  registrarCambio({
    modulo: auditInfo.modulo,
    nodoFirebase: path.split("/")[0],
    accion: "eliminar",
    registroId: auditInfo.registroId || path.split("/").pop(),
    extra: auditInfo.extra || (datosEliminados
      ? `Datos eliminados: ${JSON.stringify(datosEliminados).substring(0, 300)}`
      : undefined),
  }).catch(() => {});
};

// Exportar la función directa por si se necesita registrar algo custom
export { registrarCambio };



