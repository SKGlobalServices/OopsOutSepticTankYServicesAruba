import { database } from "../Database/firebaseConfig";
import { ref, onValue } from "firebase/database";
import { formatDateWithHyphen } from "../utils/informeUtils";

// Servicio de acceso a Firebase para el informe de efectivo.
// Cada helper convierte un snapshot crudo en la forma que consumen los hooks y componentes.

// Aplana la rama registrofechas para que cada registro conserve su fecha de origen.
const buildRegistroFechasList = (allData) =>
  Object.entries(allData).flatMap(([fecha, registros]) =>
    Object.entries(registros).map(([id, registro]) => ({
      id,
      fecha,
      origin: "registrofechas",
      realizadopor: registro.realizadopor || "",
      ...registro,
    }))
  );

// Convierte la rama data en una lista uniforme con la fecha del día como referencia.
const buildDataList = (allData) => {
  const today = formatDateWithHyphen(new Date());
  return Object.entries(allData).map(([id, registro]) => ({
    id,
    fecha: today,
    origin: "data",
    realizadopor: registro.realizadopor || "",
    ...registro,
  }));
};

// Normaliza la tabla materializada informedeefectivo sin perder el origen del registro.
const buildInformeEfectivoList = (allData) =>
  Object.entries(allData).map(([id, registro]) => ({
    id,
    origin: registro.origin || "informedeefectivo",
    realizadopor: registro.realizadopor || "",
    ...registro,
  }));

// Resume la colección de usuarios para que el componente pueda resolver ids y nombres.
const buildUsersList = (allData) =>
  Object.entries(allData)
    .map(([id, user]) => ({
      id,
      name: user.name || "",
      role: user.role || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

// Resume la colección de clientes con los campos que usan los formularios y filtros.
const buildClientsList = (allData) =>
  Object.entries(allData).map(([id, client]) => ({
    id,
    direccion: client.direccion || "",
    cubicos: client.cubicos,
    valor: client.valor,
    anombrede: client.anombrede,
  }));

// Envuelve onValue para reutilizar la misma mecánica de suscripción y manejo de errores.
const attachListener = (path, onSnapshot, onError) => {
  const dbRef = ref(database, path);
  return onValue(
    dbRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onSnapshot(snapshot.val());
      } else {
        onSnapshot(null);
      }
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        console.error(`Error listening to ${path}:`, error);
      }
    }
  );
};

// Expone registrofechas ya aplanado para consumo directo del hook compartido.
export const subscribeRegistroFechas = (onData, onError) =>
  attachListener(
    "registrofechas",
    (allData) => {
      onData(allData ? buildRegistroFechasList(allData) : []);
    },
    onError
  );

// Expone data ya convertida a una lista homogénea para el informe.
export const subscribeData = (onData, onError) =>
  attachListener(
    "data",
    (allData) => {
      onData(allData ? buildDataList(allData) : []);
    },
    onError
  );

// Expone la tabla materializada del informe para que las vistas no repitan la lectura.
export const subscribeInformedeefectivo = (onData, onError) =>
  attachListener(
    "informedeefectivo",
    (allData) => {
      onData(allData ? buildInformeEfectivoList(allData) : []);
    },
    onError
  );

// Expone el catálogo de usuarios con una forma estable y ordenada.
export const subscribeUsers = (onData, onError) =>
  attachListener(
    "users",
    (allData) => {
      onData(allData ? buildUsersList(allData) : []);
    },
    onError
  );

// Expone clientes con el subconjunto de campos que el módulo realmente consume.
export const subscribeClients = (onData, onError) =>
  attachListener(
    "clientes",
    (allData) => {
      onData(allData ? buildClientsList(allData) : []);
    },
    onError
  );