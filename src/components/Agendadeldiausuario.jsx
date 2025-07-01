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

  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);

  // Cargar la rama "data"
  useEffect(() => {
    const unsubData = onValue(ref(database, "data"), (snap) => {
      if (snap.exists()) {
        const fetched = Object.entries(snap.val());
        const con = fetched.filter(([, it]) => !!it.realizadopor);
        const sin = fetched.filter(([, it]) => !it.realizadopor);

        setData([
          ...con.sort(([, a], [, b]) =>
            a.realizadopor.localeCompare(b.realizadopor)
          ),
          ...sin,
        ]);
      } else {
        setData([]);
      }
      setLoadedData(true);
    });

    // Cargar "users" (excluyendo administradores y contadores)
    const unsubUsers = onValue(ref(database, "users"), (snap) => {
      if (snap.exists()) {
        const fetched = Object.entries(snap.val())
          .filter(([_, u]) => u.role !== "admin" && u.role !== "contador")
          .map(([id, u]) => ({ id, name: u.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setUsers(fetched);
      } else {
        setUsers([]);
      }
      setLoadedUsers(true);
    });

    // Cargar "clientes"
    const unsubClients = onValue(ref(database, "clientes"), (snap) => {
      if (snap.exists()) {
        setClients(
          Object.entries(snap.val()).map(([id, c]) => ({
            id,
            direccion: c.direccion,
            cubicos: c.cubicos,
          }))
        );
      } else {
        setClients([]);
      }
      setLoadedClients(true);
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
    const dbRefItem = ref(database, `data/${id}`);
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
      return [...conRealizadopor, ...sinRealizadopor];
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
      const dbRefItem = ref(database, `data/${dataId}`);
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
      const dbRefItem = ref(database, `data/${dataId}`);
      update(dbRefItem, { cubicos: cli.cubicos }).catch(console.error);
      setData((d) =>
        d.map(([iid, it]) =>
          iid === dataId ? [iid, { ...it, cubicos: cli.cubicos }] : [iid, it]
        )
      );
    } else {
      // si no existe o no tiene cubicos, limpiamos
      const dbRefItem = ref(database, `data/${dataId}`);
      update(dbRefItem, { cubicos: "" }).catch(console.error);
      setData((d) =>
        d.map(([iid, it]) =>
          iid === dataId ? [iid, { ...it, cubicos: "" }] : [iid, it]
        )
      );
    }
  };

  

  // --- Hook para verificar permisos 'candadoservicioshoy' ---
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;
    const candadoRef = ref(database, `users/${user.id}/candadoservicioshoy`);
    let inicial = true;
    let previo = null;

    // Listener de Firebase
    const unsub = onValue(candadoRef, (snap) => {
      const val = snap.val();
      if (inicial) {
        inicial = false;
        previo = val;
        setCanEdit(val === "sdhca");
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

  // --- Helper para clases de fila según método de pago ---
  const getRowClass = (metodo) =>
    metodo === "efectivo"
      ? "efectivo"
      : metodo === "cancelado"
      ? "cancelado"
      : metodo === "credito"
      ? "credito"
      : "";

  const handleNotesClick = (id, currentNotes) => {
    Swal.fire({
      title: "Notas",
      input: "textarea",
      inputLabel: "Notas",
      inputValue: currentNotes || "",
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        handleFieldChange(id, "notas", result.value);
      }
    });
  };

  const loggedUser = JSON.parse(localStorage.getItem("user"));
  const myUserId = loggedUser?.id;
  const showMisServicios = () => {
    if (!myUserId) {
      return Swal.fire("Error", "No hay usuario logueado", "error");
    }
    // Filtra sólo los servicios de “yo”
    const mis = data.filter(([_, item]) => item.realizadopor === myUserId);

    // Si quieres sólo el conteo:
    const total = mis.length;

    // O si prefieres un listado con dirección y servicio:
    let html = total
      ? `<ul style="text-align:left;">${mis
          .map(
            ([, it]) =>
              `<li><strong>${it.servicio || "(sin servicio)"}</strong> — ${
                it.direccion || "(sin dirección)"
              }</li>`
          )
          .join("")}</ul>`
      : "<p>No tienes servicios asignados hoy.</p>";

    Swal.fire({
      title: `Mis servicios de hoy (${total})`,
      html,
      width: "500px",
      showCloseButton: true,
      confirmButtonText: "Cerrar",
    });
  };

  useEffect(() => {
    if (loadedData && loadedUsers && loadedClients) {
      setLoading(false);
    }
  }, [loadedData, loadedUsers, loadedClients]);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  return (
   <div className={`homepage-container ${loggedUser?.role === "user" ? "user" : ""}`}>

      <Slidebaruser />

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Servicios De Hoy</h1>
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
                <th className="direccion-fixed-th">Dirección</th>
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
                    <td className="direccion-fixed-td">
                      {canEdit ? (
                        <p
                          className="p-text"
                          style={{
                            width: "20ch",
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
                        <>
                          <button
                            style={{
                              border: "none",
                              backgroundColor: "transparent",
                              borderRadius: "0.25em",
                              color: "black",
                              padding: "0.2em 0.5em",
                              cursor: "pointer",
                              fontSize: "1em",
                              maxWidth: "20ch",
                              textAlign: "left",
                              width: "100%",
                            }}
                            onClick={() => handleNotesClick(id, item.notas)}
                          >
                            {item.notas ? (
                              <p
                                style={{
                                  margin: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  maxWidth: "20ch",
                                }}
                              >
                                {item.notas}
                              </p>
                            ) : (
                              <span
                                style={{
                                  width: "100%",
                                  display: "inline-block",
                                }}
                              ></span>
                            )}
                          </button>
                        </>
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
        <div
          className="button-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <button
            style={{ backgroundColor: "#5271ff" }}
            onClick={showMisServicios}
            className="filter-button"
          >
            Mis Servicios De Hoy
          </button>
        </div>
      </div>
    </div>
  );
};

export default Agendadeldiausuario;
