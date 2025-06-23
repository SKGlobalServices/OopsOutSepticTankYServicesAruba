import React, { useState, useEffect } from "react";
import { ref, set, push, get, onValue, update } from "firebase/database";
import { database } from "../Database/firebaseConfig";
import Swal from "sweetalert2";
import Clock from "./Clock";
import Slidebaruser from "./Slidebaruser";

const Agendadeldiausuario = () => {
  const [data, setData] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [canEdit, setCanEdit] = useState(false);

  // --- Efecto para cargar datos de 'data', 'users' y 'clients' (idéntico a tu código) ---
  useEffect(() => {
    const unsubData = onValue(ref(database, "hojamañana"), (snap) => {
      if (snap.exists()) {
        const fetched = Object.entries(snap.val());
        const sin = fetched.filter(([, it]) => !it.realizadopor);
        const con = fetched.filter(([, it]) => !!it.realizadopor);
        setData(reorderData(sin, con));
      } else {
        setData([]);
      }
    });
    const unsubUsers = onValue(ref(database, "users"), (snap) => {
      if (snap.exists()) {
        const fetched = Object.entries(snap.val())
          .filter(([_, u]) => u.role !== "admin" && u.role !== "contador")
          .map(([id, u]) => ({ id, name: u.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setUsers(fetched);
      }
    });
    const unsubClients = onValue(ref(database, "clientes"), (snap) => {
      if (snap.exists()) {
        setClients(
          Object.entries(snap.val()).map(([id, c]) => ({
            id,
            direccion: c.direccion,
            cubicos: c.cubicos,
          }))
        );
      }
    });
    return () => {
      unsubData();
      unsubUsers();
      unsubClients();
    };
  }, []);

  // --- Lógica para editar campos en Firebase y estado local ---
  const handleFieldChange = (id, field, value) => {
    // actualizamos el campo en data
    const safeValue = value == null ? "" : value;
    const dbRefItem = ref(database, `hojamañana/${id}`);
    update(dbRefItem, { [field]: safeValue }).catch(console.error);

    // actualizamos estado local y reordenamos
    setData((d) => {
      // 1) Reemplazamos el elemento modificado
      const updated = d.map(([iid, it]) =>
        iid === id ? [iid, { ...it, [field]: safeValue }] : [iid, it]
      );

      // 2) Separamos:
      const sinRealizadopor = updated.filter(([, it]) => !it.realizadopor);
      const conRealizadopor = updated
        .filter(([, it]) => !!it.realizadopor)
        .sort(([, a], [, b]) => a.realizadopor.localeCompare(b.realizadopor));

      // 3) Concatenamos, sin volver a “tocar” el bloque de vacíos:
      return [...sinRealizadopor, ...conRealizadopor];
    });

    // --- Lógica específica para servicio ---
    if (field === "servicio") {
      // solo si se asignó un servicio no vacío
      if (safeValue) {
        const item = data.find(([iid]) => iid === id)[1];
        const direccion = item.direccion;
        if (direccion) {
          const existing = clients.find((c) => c.direccion === direccion);
          if (!existing) {
            // insertar nuevo cliente
            const newClientRef = push(ref(database, "clientes"));
            set(newClientRef, {
              direccion,
              cubicos:
                item.cubicos != null && item.cubicos !== ""
                  ? item.cubicos
                  : null,
            }).catch(console.error);
          }
          // luego, cargar cubicos desde clientes (si existe)
          loadCubicosFromClient(direccion, id);
        }
      } else {
        handleFieldChange(id, "cubicos", "");
      }
    }

    // --- Lógica específica para direccion ---
    if (field === "direccion") {
      // al cambiar dirección, siempre recargamos cubicos desde clientes
      loadCubicosFromClient(safeValue, id);
    }
  };

  // 2) Función de solo lectura de cúbicos desde clientes
  const loadCubicosFromClient = (direccion, dataId) => {
    if (!direccion) {
      // limpia cubicos en data si no hay dirección
      const dbRefItem = ref(database, `hojamañana/${dataId}`);
      update(dbRefItem, { cubicos: "" }).catch(console.error);
      setData((d) =>
        d.map(([iid, it]) =>
          iid === dataId ? [iid, { ...it, cubicos: "" }] : [iid, it]
        )
      );
      return;
    }
    const cli = clients.find((c) => c.direccion === direccion);
    if (cli && cli.cubicos != null) {
      // escribe en data solo lectura
      const dbRefItem = ref(database, `hojamañana/${dataId}`);
      update(dbRefItem, { cubicos: cli.cubicos }).catch(console.error);
      setData((d) =>
        d.map(([iid, it]) =>
          iid === dataId ? [iid, { ...it, cubicos: cli.cubicos }] : [iid, it]
        )
      );
    } else {
      // si no existe o no tiene cubicos, limpiamos
      const dbRefItem = ref(database, `hojamañana/${dataId}`);
      update(dbRefItem, { cubicos: "" }).catch(console.error);
      setData((d) =>
        d.map(([iid, it]) =>
          iid === dataId ? [iid, { ...it, cubicos: "" }] : [iid, it]
        )
      );
    }
  };

  // --- Hook para verificar permisos 'candadoserviciosmañana' ---
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;
    const candadoRef = ref(database, `users/${user.id}/candadoserviciosmañana`);
    let inicial = true;
    let previo = null;

    // Listener de Firebase
    const unsub = onValue(candadoRef, (snap) => {
      const val = snap.val();
      if (inicial) {
        inicial = false;
        previo = val;
        setCanEdit(val === "sdmca");
      } else if (val !== previo) {
        Swal.fire({
          icon: "info",
          title: "Permisos actualizados",
          text: "Se actualizaron los permisos. Recargando...",
          confirmButtonText: "OK",
        }).then(() => window.location.reload());
      }
    });

    // Al volver de otra pestaña
    const onVisibilityChange = () => {
      if (!document.hidden) {
        get(candadoRef).then((snap) => {
          const val = snap.val();
          if (val !== previo) {
            Swal.fire({
              icon: "info",
              title: "Permisos actualizados",
              text: "Se actualizaron los permisos. Recargando...",
              confirmButtonText: "OK",
            }).then(() => window.location.reload());
          }
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Función para reordenar: concatena vacíos (en orden dado) + con valor (alfabético)
  const reorderData = (sinRealizadopor, conRealizadopor) => {
    // Ordena alfabeticamente TIPO A–Z usando el nombre del usuario
    const sorted = conRealizadopor.sort(([, a], [, b]) => {
      const nameA = users.find((u) => u.id === a.realizadopor)?.name ?? "";
      const nameB = users.find((u) => u.id === b.realizadopor)?.name ?? "";
      return nameA.localeCompare(nameB);
    });

    return [
      // primero los que NO tienen “realizadopor”
      ...sinRealizadopor,
      // luego los que sí lo tienen, ordenados
      ...sorted,
    ];
  };

  // --- Helper para clases de fila según método de pago ---
  const getRowClass = (metodo) =>
    metodo === "efectivo"
      ? "efectivo"
      : metodo === "cancelado"
      ? "cancelado"
      : metodo === "credito"
      ? "credito"
      : "";

  return (
    <div className="homepage-container">
      <Slidebaruser />

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Servicios De Mañana</h1>
          <div className="current-date">
            <div>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Dirección</th>
                <th>Notas</th>
                <th>Cúbicos</th>
                <th>Realizado Por</th>
                <th>Metodo De Pago</th>
                <th>Efectivo</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map(([id, item]) => (
                  <tr key={id} className={getRowClass(item.metododepago)}>
                    <td>
                      {canEdit ? (
                        <p
                          className="p-text"
                          style={{
                            width: "30ch",
                            textAlign: "left",
                            backgroundColor: "white",
                            margin: "5px",
                            borderRadius: "5px",
                            cursor: "default",
                          }}
                        >
                          {item.direccion}
                        </p>
                      ) : (
                        <p
                          className="p-text"
                          style={{
                            width: "30ch",
                            textAlign: "left",
                            margin: "5px",
                            borderRadius: "5px",
                            cursor: "default",
                          }}
                        >
                          {item.direccion}
                        </p>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          type="text"
                          style={{width:"20"}}
                          value={item.notas}
                          onChange={(e) =>
                            handleFieldChange(id, "notas", e.target.value)
                          }
                        />
                      ) : (
                        <p
                          style={{
                            width: "20ch",
                            textAlign: "left",
                          }}
                        >
                          {item.notas}
                        </p>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          type="number"
                          style={{
                            width: "10ch",
                            textAlign: "center",
                          }}
                          value={item.cubicos}
                          onChange={(e) =>
                            handleFieldChange(id, "cubicos", e.target.value)
                          }
                        />
                      ) : (
                        <p style={{ textAlign: "center" }}>{item.cubicos}</p>
                      )}
                    </td>
                    <td style={{ minWidth: "26ch" }}>
                      {canEdit ? (
                        <select
                          style={{ width: "24ch" }}
                          value={item.realizadopor || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              id,
                              "realizadopor",
                              e.target.value
                            )
                          }
                        >
                          <option value=""></option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p>
                          {users.find((u) => u.id === item.realizadopor)?.name}
                        </p>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          value={item.metododepago}
                          onChange={(e) => {
                            const m = e.target.value;
                            handleFieldChange(id, "metododepago", m);
                            if (m === "efectivo") {
                              handleFieldChange(id, "efectivo", item.valor);
                            } else {
                              handleFieldChange(id, "efectivo", "");
                            }
                          }}
                        >
                          <option value=""></option>
                          <option value="credito">Crédito</option>
                          <option value="cancelado">Cancelado</option>
                          <option value="efectivo">Efectivo</option>
                        </select>
                      ) : (
                        <p>{item.metododepago}</p>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          type="number"
                          style={{ width: "12ch", textAlign: "center" }}
                          value={item.efectivo}
                          onChange={(e) =>
                            handleFieldChange(id, "efectivo", e.target.value)
                          }
                          disabled={item.metododepago !== "efectivo"}
                        />
                      ) : (
                        <p>{item.efectivo}</p>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="no-data">
                  <td colSpan="6">No hay datos disponibles</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Agendadeldiausuario;
