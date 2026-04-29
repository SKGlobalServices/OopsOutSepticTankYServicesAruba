import { useEffect, useMemo } from "react";
import { auditBulkUpdate } from "../utils/auditLogger";
import { sanitizeForLog } from "../utils/security";
import { normalizeTextValue } from "../utils/informeUtils";
import { trackInformeWrites } from "../utils/informeMetrics";

// Hook que materializa el informe de efectivo sin arrastrar registros con otros metodos de pago.
// La proyeccion se calcula a partir de las fuentes y se sincroniza contra el nodo informedeefectivo.
// Determina si un registro debe vivir en la proyeccion efectiva del informe.
// Esta regla es el filtro principal: solo lo que sea efectivo se considera parte del espejo materializado.
const isEfectivoRecord = (record) =>
  normalizeTextValue(record?.metododepago).toLowerCase() === "efectivo";

// Construye el payload que se debe guardar en el nodo proyectado.
// Se conserva el origen para no perder trazabilidad entre data, registrofechas e informedeefectivo.
const buildProjectionRecord = (record, originFallback) => ({
  ...record,
  origin: record?.origin || originFallback,
  timestamp: record?.timestamp ?? 0,
});

// Devuelve la llave estable del registro para compararlo con el nodo materializado.
// Se usa String/trim para evitar que ids con espacios o nulos rompan la comparación.
const getRecordId = (record) => String(record?.id || "").trim();

// Serializa solo los campos que importan para saber si el nodo ya coincide con la proyeccion.
// Esto evita reescribir en Firebase cuando el contenido real no cambió.
const serializeProjectionRecord = (record) =>
  JSON.stringify({
    id: record?.id || "",
    origin: record?.origin || "",
    fecha: record?.fecha || "",
    realizadopor: record?.realizadopor || "",
    metododepago: record?.metododepago || "",
    direccion: record?.direccion || "",
    cubicos: record?.cubicos ?? "",
    efectivo: record?.efectivo ?? "",
    valor: record?.valor ?? "",
    anombrede: record?.anombrede ?? "",
    timestamp: record?.timestamp ?? 0,
  });

// Construye el mapa objetivo de la proyeccion y conserva los registros efectivos ya materializados manualmente.
const buildProjectionState = (
  registroFechasData,
  dataData,
  dataInformedeefectivoData
) => {
  const projectionMap = new Map();

  // Este helper decide, fuente por fuente, si un registro debe quedar en el espejo efectivo.
  // Si no es efectivo, se marca como null para que luego se elimine del nodo proyectado.
  const registerSourceRecord = (record, originFallback) => {
    const recordId = getRecordId(record);
    if (!recordId) return;

    if (isEfectivoRecord(record)) {
      projectionMap.set(recordId, buildProjectionRecord(record, originFallback));
    } else {
      projectionMap.set(recordId, null);
    }
  };

  registroFechasData.forEach((record) => {
    registerSourceRecord(record, "registrofechas");
  });

  dataData.forEach((record) => {
    registerSourceRecord(record, "data");
  });

  dataInformedeefectivoData.forEach((record) => {
    const recordId = getRecordId(record);
    if (!recordId || projectionMap.has(recordId)) return;

    // Si el registro ya viene de una fuente base, no lo revalidamos como espejo manual.
    // Esto evita que un dato viejo del nodo materializado sobreviva por error.
    if (record.origin === "registrofechas" || record.origin === "data") {
      projectionMap.set(recordId, null);
      return;
    }

    if (isEfectivoRecord(record)) {
      projectionMap.set(
        recordId,
        buildProjectionRecord(record, "informedeefectivo")
      );
    } else {
      projectionMap.set(recordId, null);
    }
  });

  const projectedInformeEfectivoData = Array.from(projectionMap.values()).filter(
    Boolean
  );

  // Devuelve tanto el mapa completo como la lista ya materializada para consumo del hook.
  return { projectionMap, projectedInformeEfectivoData };
};

export const useInformeEfectivoProjection = ({
  registroFechasData,
  dataData,
  dataInformedeefectivoData,
  loading = false,
}) => {
  const { projectionMap, projectedInformeEfectivoData } = useMemo(
    () =>
      buildProjectionState(
        registroFechasData,
        dataData,
        dataInformedeefectivoData
      ),
    [registroFechasData, dataData, dataInformedeefectivoData]
  );

  // Sincroniza el nodo proyectado solo cuando las fuentes ya terminaron de cargar.
  useEffect(() => {
    if (loading) return;

    // Comparamos el estado deseado contra lo que ya existe para generar un batch mínimo.
    const currentRecordsMap = new Map(
      dataInformedeefectivoData.map((record) => [getRecordId(record), record])
    );
    const batchUpdates = {};

    projectionMap.forEach((desiredRecord, recordId) => {
      if (!recordId) return;

      const currentRecord = currentRecordsMap.get(recordId);
      const projectionPath = `informedeefectivo/${recordId}`;

      // null significa que ese id no debe seguir existiendo en el espejo.
      if (!desiredRecord) {
        if (currentRecord) {
          batchUpdates[projectionPath] = null;
        }
        return;
      }

      // Si el registro ya coincide, no se escribe nada: eso reduce ruido y escrituras innecesarias.
      if (
        !currentRecord ||
        serializeProjectionRecord(currentRecord) !==
          serializeProjectionRecord(desiredRecord)
      ) {
        batchUpdates[projectionPath] = desiredRecord;
      }
    });

    if (Object.keys(batchUpdates).length === 0) return;

    // Un solo update multipath mantiene la proyección consistente y evita escritura por escritura.
    auditBulkUpdate(batchUpdates, {
      modulo: "Informe De Efectivo",
      registroId: "sincronizacion-proyeccion",
      extra: `Registros sincronizados: ${Object.keys(batchUpdates).length}`,
    })
      .then(() => {
        trackInformeWrites(
          "UseInformeEfectivoProjection",
          Object.keys(batchUpdates).length,
          { action: "syncProjection" }
        );
      })
      .catch((error) => {
        console.error(
          "Error syncing effective projection:",
          sanitizeForLog(error.message)
        );
      });
  }, [dataInformedeefectivoData, loading, projectionMap]);

  return projectedInformeEfectivoData;
};