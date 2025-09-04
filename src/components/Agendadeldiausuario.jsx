import React, { useState, useEffect } from "react";
import { ref, set, push, get, onValue, update } from "firebase/database";
import { database } from "../Database/firebaseConfig";
import { decryptData } from "../utils/security";
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

  // === NUEVO: referencia al usuario logueado y helpers de permisos por fila
  const loggedUser = decryptData(localStorage.getItem("user"));
  const myUserId = loggedUser?.id;

  /** Regla por fila:
   * - Si no hay realizadopor: solo se puede abrir el select de asignación (si canEdit global lo permite)
   * - Si hay realizadopor y coincide con mi usuario: puedo editar el resto
   * - Si hay realizadopor y NO coincide: todo bloqueado
   */
  const getRowPermission = (item) => {
    const assigned = !!item.realizadopor;
    const mine = item.realizadopor === myUserId;

    // `canEdit` (candado) sigue siendo el switch global de tu app.
    // Si quieres ignorar candado para permitir asignar siempre, cambia `canEdit &&` por solo `true`.
    const canAssign = canEdit && !assigned; // select de "Realizado Por" habilitado solo si aún no está asignado
    const canEditFields = canEdit && assigned && mine; // demás campos solo si está asignado a mí
    return { canAssign, canEditFields };
  };

  // === Cargar data ===
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
    const safeValue = value == null ? "" : value;

    // Actualiza en DB (data)
    const dbRefItem = ref(database, `data/${id}`);
    update(dbRefItem, { [field]: safeValue }).catch(console.error);

    // Actualiza estado local y reordena
    setData((d) => {
      const updated = d.map(([iid, it]) =>
        iid === id ? [iid, { ...it, [field]: safeValue }] : [iid, it]
      );
      const sinRealizadopor = updated.filter(([, it]) => !it.realizadopor);
      const conRealizadopor = updated
        .filter(([, it]) => !!it.realizadopor)
        .sort(([, a], [, b]) => a.realizadopor.localeCompare(b.realizadopor));
      return [...conRealizadopor, ...sinRealizadopor];
    });

    // Lógica específica para "servicio"
    if (field === "servicio") {
      if (safeValue) {
        const item = data.find(([iid]) => iid === id)?.[1];
        const direccion = item?.direccion;
        if (direccion) {
          const existing = clients.find((c) => c.direccion === direccion);
          if (!existing) {
            const newClientRef = push(ref(database, "clientes"));
            set(newClientRef, {
              direccion,
              cubicos:
                item?.cubicos != null && item?.cubicos !== ""
                  ? item.cubicos
                  : null,
            }).catch(console.error);
          }
          loadCubicosFromClient(direccion, id);
        }
      } else {
        handleFieldChange(id, "cubicos", "");
      }
    }

    if (field === "direccion") {
      loadCubicosFromClient(safeValue, id);
    }
  };

  // --- Leer cubicos desde "clientes" y sincronizar en data ---
  const loadCubicosFromClient = (direccion, dataId) => {
    if (!direccion) {
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
      const dbRefItem = ref(database, `data/${dataId}`);
      update(dbRefItem, { cubicos: cli.cubicos }).catch(console.error);
      setData((d) =>
        d.map(([iid, it]) =>
          iid === dataId ? [iid, { ...it, cubicos: cli.cubicos }] : [iid, it]
        )
      );
    } else {
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
    const user = decryptData(localStorage.getItem("user"));
    if (!user) return;
    const candadoRef = ref(database, `users/${user.id}/candadoservicioshoy`);
    let inicial = true;
    let previo = null;

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

  const showMisServicios = () => {
    if (!myUserId) {
      return Swal.fire("Error", "No hay usuario logueado", "error");
    }
    const mis = data.filter(([_, item]) => item.realizadopor === myUserId);
    const total = mis.length;
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
    if (loadedData && loadedUsers && loadedClients) setLoading(false);
  }, [loadedData, loadedUsers, loadedClients]);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  return (
    <div
      className={`homepage-container ${
        loggedUser?.role === "user" ? "user" : ""
      }`}
    >
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
                data.map(([id, item]) => {
                  const { canAssign, canEditFields } = getRowPermission(item);

                  return (
                    <tr key={id} className={getRowClass(item.metododepago)}>
                      {/* Dirección: solo lectura siempre aquí (tu UI actual la mostraba como p/readonly o p "editable" visual) */}
                      <td className="direccion-fixed-td">
                        <p
                          className="p-text"
                          style={{
                            width: canEdit ? "20ch" : "30ch",
                            textAlign: "left",
                            margin: "5px",
                            borderRadius: "5px",
                            cursor: "default",
                          }}
                        >
                          {item.direccion}
                        </p>
                      </td>

                      {/* Notas */}
                      <td>
                        {canEditFields ? (
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
                              />
                            )}
                          </button>
                        ) : (
                          <p style={{ width: "20ch", textAlign: "left" }}>
                            {item.notas}
                          </p>
                        )}
                      </td>

                      {/* Cúbicos */}
                      <td>
                        {canEditFields ? (
                          <input
                            type="number"
                            style={{ width: "10ch", textAlign: "center" }}
                            value={item.cubicos || ""}
                            onChange={(e) =>
                              handleFieldChange(id, "cubicos", e.target.value)
                            }
                          />
                        ) : (
                          <p style={{ textAlign: "center" }}>{item.cubicos}</p>
                        )}
                      </td>

                      {/* Realizado Por */}
                      <td style={{ minWidth: "26ch" }}>
                        {canAssign ? (
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
                          // Cuando ya hay asignación (o no hay permiso global), mostramos el nombre fijo
                          <p>
                            {item.realizadopor
                              ? users.find((u) => u.id === item.realizadopor)
                                  ?.name
                              : ""}
                          </p>
                        )}
                      </td>

                      {/* Método de Pago */}
                      <td>
                        {canEditFields ? (
                          <select
                            value={item.metododepago || ""}
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

                      {/* Efectivo */}
                      <td>
                        {canEditFields ? (
                          <input
                            type="number"
                            style={{ width: "12ch", textAlign: "center" }}
                            value={item.efectivo || ""}
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
                  );
                })
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

export default React.memo(Agendadeldiausuario);
