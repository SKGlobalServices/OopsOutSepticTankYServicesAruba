// Utilidades compartidas del informe de efectivo.
// Centralizan parseo de fechas, formato de usuario, método de pago y cálculo de efectivo.

// Normaliza cualquier valor a texto seguro para comparaciones y filtros.
// Se usa para evitar errores cuando llegan null, undefined o valores numéricos.
export const normalizeTextValue = (value) => String(value ?? "").trim();

// Convierte una fecha Date a formato dd-mm-yyyy para guardar y mostrar de forma consistente.
export const formatDateWithHyphen = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Reconvierte una fecha guardada como texto dd-mm-yyyy a un objeto Date real.
// Retorna null si el texto no tiene una forma válida.
export const parseDateStringToDate = (value) => {
  const normalizedValue = normalizeTextValue(value);
  if (!/^\d{2}-\d{2}-\d{4}$/.test(normalizedValue)) return null;
  const [day, month, year] = normalizedValue.split("-");
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  if (
    !Number.isInteger(dayNumber) ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(yearNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return null;
  }
  const parsedDate = new Date(yearNumber, monthNumber - 1, dayNumber);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== yearNumber ||
    parsedDate.getMonth() !== monthNumber - 1 ||
    parsedDate.getDate() !== dayNumber
  ) {
    return null;
  }
  return parsedDate;
};

// Alias semántico para dejar claro que el parseo se usa dentro del dominio del informe.
export const parseInformeDate = (value) => parseDateStringToDate(value);

// Obtiene el valor monetario efectivo desde distintos campos posibles del registro.
// El informe legacy no siempre usa la misma propiedad para el monto.
export const getEfectivoValue = (record) => {
  const candidates = [record?.efectivo, record?.valor, record?.monto];
  for (const candidate of candidates) {
    const parsed = parseFloat(candidate);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

// Resuelve el nombre visible del usuario a partir del id almacenado en los registros.
// Si no encuentra coincidencia, devuelve el id normalizado para no perder contexto.
export const getUserDisplayName = (userId, users = []) => {
  const found = users.find((user) => user.id === userId);
  if (found) return found.name;
  return normalizeTextValue(userId || "");
};

// Devuelve un color de fondo por método de pago para conservar la señal visual existente.
export const getMetodoPagoColor = (metododepago) => {
  switch (normalizeTextValue(metododepago).toLowerCase()) {
    case "efectivo":
      return "purple";
    case "credito":
      return "green";
    case "cancelado":
      return "red";
    default:
      return "transparent";
  }
};