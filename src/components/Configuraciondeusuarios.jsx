import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, remove, update, onValue } from "firebase/database";
import Swal from "sweetalert2";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import lock_off from "../assets/img/lock_off.png";
import lock_on from "../assets/img/lock_on.png";

const Usuarios = () => {
  const [data, setData] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const slidebarRef = useRef(null);

  // LOADER
  const [loading, setLoading] = useState(true);
  const [loadedUsers, setLoadedUsers] = useState(false);

  // Escucha de Firebase para "users"
  useEffect(() => {
    const dbRef = ref(database, "users");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        setData(Object.entries(snapshot.val()));
      } else {
        setData([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const addUser = () => {
    const dbRef = ref(database, "users");
    const existingNames = data.map(([_, user]) => user.name);

    let nextNumber = 1;
    let newName = `Nuevo Usuario ${nextNumber}`;
    while (existingNames.includes(newName)) {
      nextNumber++;
      newName = `Nuevo Usuario ${nextNumber}`;
    }

    // Crear el nuevo usuario con nombre único y rol predeterminado
    const newUser = {
      email: `newuser${nextNumber}@example.com`,
      password: "password123",
      name: newName,
      role: "user",
    };

    // Guardar en Firebase
    const newUserRef = push(dbRef);
    set(newUserRef, newUser).catch((error) => {
      console.error("Error al agregar usuario: ", error);
    });
  };

  const deleteUser = (id) => {
    const dbRef = ref(database, `users/${id}`);
    remove(dbRef).catch((error) => {
      console.error("Error al eliminar usuario: ", error);
    });
  };

  const handleFieldChange = (id, field, value) => {
    const dbRef = ref(database, `users/${id}`);
    update(dbRef, { [field]: value }).catch((error) => {
      console.error("Error al actualizar usuario: ", error);
    });
  };

  // Función para alternar la visibilidad de la contraseña por fila
  const toggleRowPassword = (id) => {
    setShowPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);

  const handleClickOutside = (e) => {
    if (
      slidebarRef.current &&
      !slidebarRef.current.contains(e.target) &&
      !e.target.closest(".show-slidebar-button")
    ) {
      setShowSlidebar(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="homepage-container">
      <Slidebar />

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Usuarios</h1>
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
                <th>Correo</th>
                <th>Nombre</th>
                <th>Contraseña</th>
                <th>Rol</th>
                <th>Edición Servicios De Hoy</th>
                <th>Edición Servicios De Mañana</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data && data.length > 0 ? (
                data.map(([id, item]) => (
                  <tr key={id}>
                    <td>
                      <input
                        type="email"
                        style={{ width: "28ch", textAlign: "center" }}
                        value={item.email || ""}
                        onChange={(e) =>
                          handleFieldChange(id, "email", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        style={{ width: "30ch", textAlign: "left" }}
                        value={item.name || ""}
                        onChange={(e) =>
                          handleFieldChange(id, "name", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        style={{
                          fontWeight: "bold",
                          width: "22ch",
                          textAlign: "left",
                        }}
                        type={showPasswords[id] ? "text" : "password"}
                        value={item.password || ""}
                        onChange={(e) =>
                          handleFieldChange(id, "password", e.target.value)
                        }
                      />
                      <button
                        style={{
                          marginRight: "10px",
                          backgroundColor: "green",
                        }}
                        className="delete-button"
                        onClick={() => toggleRowPassword(id)}
                      >
                        {showPasswords[id] ? "Ocultar" : "Mostrar"}
                      </button>
                    </td>
                    <td
                      style={{
                        minWidth: "18ch",
                      }}
                    >
                      <select
                        value={item.role || "user"}
                        onChange={(e) =>
                          handleFieldChange(id, "role", e.target.value)
                        }
                      >
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                        <option value="contador">Contador</option>
                      </select>
                    </td>
                    {/* Edición Servicios De Hoy */}
                    <td style={{ textAlign: "center", padding: "4px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-evenly",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          className="lock-on-button"
                          style={{
                            opacity:
                              item.candadoservicioshoy === "sdhca" ? 1 : 0.3,
                          }}
                          onClick={() =>
                            handleFieldChange(
                              id,
                              "candadoservicioshoy",
                              "sdhca"
                            )
                          }
                        >
                          <img
                            src={lock_on}
                            alt="Abierto"
                            style={{ width: 20, height: 20 }}
                          />
                        </button>
                        <button
                          className="lock-off-button"
                          style={{
                            opacity:
                              item.candadoservicioshoy === "sdhcc" ? 1 : 0.3,
                          }}
                          onClick={() =>
                            handleFieldChange(
                              id,
                              "candadoservicioshoy",
                              "sdhcc"
                            )
                          }
                        >
                          <img
                            src={lock_off}
                            alt="Cerrado"
                            style={{ width: 20, height: 20 }}
                          />
                        </button>
                      </div>
                    </td>
                    {/* Edición Servicios De Mañana */}
                    <td style={{ textAlign: "center", padding: "4px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-evenly",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          className="lock-on-button"
                          style={{
                            opacity:
                              item.candadoserviciosmañana === "sdmca" ? 1 : 0.3,
                          }}
                          onClick={() =>
                            handleFieldChange(
                              id,
                              "candadoserviciosmañana",
                              "sdmca"
                            )
                          }
                        >
                          <img
                            src={lock_on}
                            alt="Abierto"
                            style={{ width: 20, height: 20 }}
                          />
                        </button>
                        <button
                          className="lock-off-button"
                          style={{
                            opacity:
                              item.candadoserviciosmañana === "sdmcc" ? 1 : 0.3,
                          }}
                          onClick={() =>
                            handleFieldChange(
                              id,
                              "candadoserviciosmañana",
                              "sdmcc"
                            )
                          }
                        >
                          <img
                            src={lock_off}
                            alt="Cerrado"
                            style={{ width: 20, height: 20 }}
                          />
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        className="delete-button"
                        style={{ marginLeft: "10px" }}
                        onClick={() => {
                          Swal.fire({
                            title: "¿Estás seguro?",
                            text: "Esta acción eliminará al usuario permanentemente.",
                            icon: "warning",
                            showCancelButton: true,
                            confirmButtonColor: "#d33",
                            cancelButtonColor: "#3085d6",
                            confirmButtonText: "Sí, eliminar",
                            cancelButtonText: "Cancelar",
                            position: "center",
                            backdrop: "rgba(0,0,0,0.4)",
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                            stopKeydownPropagation: false,
                            heightAuto: false,
                            didOpen: () => {
                              document.body.style.overflow = "auto";
                            },
                            willClose: () => {
                              document.body.style.overflow = "";
                            },
                          }).then((result) => {
                            if (result.isConfirmed) {
                              deleteUser(id);

                              Swal.fire({
                                title: "¡Usuario Eliminado!",
                                text: "El usuario ha sido eliminado exitosamente.",
                                icon: "success",
                                position: "center",
                                backdrop: "rgba(0,0,0,0.4)",
                                timer: 2000,
                                showConfirmButton: false,
                                heightAuto: false,
                                didOpen: () => {
                                  document.body.style.overflow = "auto";
                                },
                                willClose: () => {
                                  document.body.style.overflow = "";
                                },
                              });
                            }
                          });
                        }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="no-data">
                  <td colSpan="5">No hay usuarios disponibles</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="button-container">
        <button
          style={{ marginLeft: "0px" }}
          className="create-table-button"
          onClick={addUser}
        >
          +
        </button>
      </div>
    </div>
  );
};

export default Usuarios;
