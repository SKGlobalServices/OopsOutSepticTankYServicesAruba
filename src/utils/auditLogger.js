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
  servicioAdicional: "Servicio Adicional",
  metodoPago: "Metodo de Pago",
  montoafavor: "Monto a Favor",
  fechaEmision: "Fecha de Emisión"
};

const AUDIT_ACTIONS = new Set(["crear", "editar", "eliminar", "mover"]);

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
  } catch (error) {
    console.warn("[auditLogger] No se pudieron cargar usuarios para resolver labels:", error);
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
  
  // Para campos de usuario, resolver ID a nombre
  if (campo === "realizadopor" || campo === "realizado" || campo === "nombre") {
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
  } catch (error) {
    console.warn("[auditLogger] No se pudo leer usuario admin desde localStorage:", error);
    return null;
  }
};

const serializeAuditValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
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
        return `Cambió en "${campoLabel}" de ${anterior} a ${nuevo}${extra ? ` | ${extra}` : ""}`;
      }
      return `Editó un registro en ${modulo}${extra ? ` | ${extra}` : ""}`;
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

    const accionNormalizada = AUDIT_ACTIONS.has(accion) ? accion : "editar";

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
      accion: accionNormalizada,
      registroId: registroId || "N/A",
      campo: campoLabel || null,
      valorAnterior: serializeAuditValue(valorAnteriorLegible),
      valorNuevo: serializeAuditValue(valorNuevoLegible),
      detalle: generarDetalle(accionNormalizada, modulo, campoLabel, valorAnteriorLegible, valorNuevoLegible, extra),
    };

    const historialRef = ref(database, "historialcambios");
    const newRef = push(historialRef);
    await set(newRef, registro);
  } catch (error) {
    // No bloquear la operación principal si falla el log
    console.error("Error al registrar cambio en historial:", error);
  }
};

const normalizeAuditInfo = (auditInfo) =>
  auditInfo && typeof auditInfo === "object" ? auditInfo : {};

const getPathParts = (path) =>
  typeof path === "string" ? path.split("/").filter(Boolean) : [];

const getNodoFirebaseFromPath = (path) => getPathParts(path)[0] || "N/A";

const getRegistroIdFromPath = (path, auditInfo = {}) =>
  auditInfo.registroId || getPathParts(path).pop() || "N/A";

const handleAuditLogError = (context, error) => {
  console.error(`[auditLogger] Falló ${context}:`, error);
};

/**
 * Wrapper para bulk multi-path update() que registra UN ÚNICO registro de auditoría de resumen.
 * Usar cuando una sola acción del usuario actualiza N rutas/claves en Firebase (ej: guardar
 * el calendario mensual completo), evitando generar N entradas de log.
 *
 * @param {Object} updates    - Objeto de multi-path updates { "ruta/clave": valor, ... }
 * @param {Object} auditInfo  - Info para el historial
 * @param {string} auditInfo.modulo      - Nombre del módulo
 * @param {string} auditInfo.registroId  - ID del registro
 * @param {string} [auditInfo.extra]     - Info adicional
 */
export const auditBulkUpdate = async (updates, auditInfo) => {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new Error("auditBulkUpdate requiere un objeto updates válido.");
  }

  const info = normalizeAuditInfo(auditInfo);

  // Ejecutar la operación principal primero
  await update(ref(database), updates);

  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  // Registrar UN único resumen (fire-and-forget)
  registrarCambio({
    modulo: info.modulo || "Sistema",
    nodoFirebase: getNodoFirebaseFromPath(keys[0]),
    accion: "editar",
    registroId: info.registroId || "N/A",
    extra: info.extra,
  }).catch((error) => handleAuditLogError("registro de actualización masiva", error));
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
  if (!path || typeof path !== "string") {
    throw new Error("auditUpdate requiere un path válido.");
  }
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new Error("auditUpdate requiere un objeto updates válido.");
  }

  const info = normalizeAuditInfo(auditInfo);
  const dbRef = ref(database, path);

  // Ejecutar la operación principal primero
  await update(dbRef, updates);

  const keys = Object.keys(updates);
  if (keys.length === 0) {
    return;
  }

  // Registrar cada campo cambiado (fire-and-forget, no bloquea)
  for (const [campo, valorNuevo] of Object.entries(updates)) {
    const valorAnterior = info.prevData ? info.prevData[campo] : undefined;

    // Solo registrar si el valor realmente cambió
    if (valorAnterior !== undefined && String(valorAnterior) === String(valorNuevo)) {
      continue;
    }

    registrarCambio({
      modulo: info.modulo || "Sistema",
      nodoFirebase: getNodoFirebaseFromPath(path),
      accion: "editar",
      registroId: getRegistroIdFromPath(path, info),
      campo,
      valorAnterior,
      valorNuevo,
      extra: info.extra,
    }).catch((error) => handleAuditLogError("registro de actualización", error));
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
  if (!path || typeof path !== "string") {
    throw new Error("auditCreate requiere un path válido.");
  }
  const info = normalizeAuditInfo(auditInfo);
  const dbRef = ref(database, path);
  const newRef = push(dbRef);

  await set(newRef, data);

  // Fire-and-forget: no bloquea la operación principal
  registrarCambio({
    modulo: info.modulo || "Sistema",
    nodoFirebase: getNodoFirebaseFromPath(path),
    accion: "crear",
    registroId: newRef.key || getRegistroIdFromPath(path, info),
    extra: info.extra,
  }).catch((error) => handleAuditLogError("registro de creación", error));

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
  if (!path || typeof path !== "string") {
    throw new Error("auditSet requiere un path válido.");
  }
  const info = normalizeAuditInfo(auditInfo);
  const dbRef = ref(database, path);
  await set(dbRef, data);

  // Fire-and-forget: no bloquea la operación principal
  const accion = info.accion || (data === null ? "eliminar" : "crear");
  registrarCambio({
    modulo: info.modulo || "Sistema",
    nodoFirebase: getNodoFirebaseFromPath(path),
    accion,
    registroId: getRegistroIdFromPath(path, info),
    extra: info.extra,
  }).catch((error) => handleAuditLogError("registro en set", error));
};

/**
 * Wrapper para remove() que registra la eliminación.
 *
 * @param {string} path       - Ruta completa en Firebase (ej: "data/-NaBcD")
 * @param {Object} auditInfo  - Info para el historial
 * @param {string} auditInfo.modulo      - Nombre del módulo
 * @param {string} auditInfo.registroId  - ID del registro
 * @param {string} [auditInfo.extra]     - Info adicional (ej: nombre del cliente eliminado)
 */
export const auditRemove = async (path, auditInfo) => {
  if (!path || typeof path !== "string") {
    throw new Error("auditRemove requiere un path válido.");
  }
  const info = normalizeAuditInfo(auditInfo);
  const dbRef = ref(database, path);

  await remove(dbRef);

  // Fire-and-forget: no bloquea la operación principal
  registrarCambio({
    modulo: info.modulo || "Sistema",
    nodoFirebase: getNodoFirebaseFromPath(path),
    accion: "eliminar",
    registroId: getRegistroIdFromPath(path, info),
    extra: info.extra,
  }).catch((error) => handleAuditLogError("registro de eliminación", error));
};




