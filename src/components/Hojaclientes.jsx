import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue, update, push, remove } from "firebase/database";
import "react-datepicker/dist/react-datepicker.css";
import Swal from "sweetalert2";
import Select from "react-select";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import Clock from "./Clock";

const Clientes = () => {
  const [data, setData] = useState([]);
  const [directions, setDirections] = useState([]);
  const [names, setNames] = useState([]);
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);
  // Ahora filter incluye anombrede
  const [filter, setFilter] = useState({
    direccion: [],
    anombrede: [],
    cubicosMin: "",
    cubicosMax: "",
    valorMin: "",
    valorMax: "",
  });

  // Carga datos de Firebase, incluyendo anombrede
  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedData = [];
        const uniqueDirections = new Set();
        const uniqueNames = new Set();

        Object.entries(snapshot.val()).forEach(([id, cliente]) => {
          const direccion = cliente.direccion || "";
          const anombrede = cliente.anombrede || "";
          fetchedData.push({
            id,
            direccion,
            anombrede,
            cubicos: cliente.cubicos || 0,
          });
          if (direccion) uniqueDirections.add(direccion);
          if (anombrede) uniqueNames.add(anombrede);
        });

        // Ordenamiento por “Nuevo Cliente” y luego alfabético
        fetchedData.sort((a, b) => {
          const aIsNew = a.direccion.startsWith("Nuevo Cliente");
          const bIsNew = b.direccion.startsWith("Nuevo Cliente");
          if (aIsNew && !bIsNew) return -1;
          if (!aIsNew && bIsNew) return 1;
          return a.direccion.localeCompare(b.direccion, undefined, {
            sensitivity: "base",
          });
        });

        setData(fetchedData);
        setDirections(Array.from(uniqueDirections));
        setNames(Array.from(uniqueNames));
      } else {
        setData([]);
        setDirections([]);
        setNames([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleDireccionFilterChange = (selectedOptions) => {
    setFilter((prev) => ({
      ...prev,
      direccion: selectedOptions ? selectedOptions.map((opt) => opt.value) : [],
    }));
  };

  const handleNameFilterChange = (selectedOptions) => {
    setFilter((prev) => ({
      ...prev,
      anombrede: selectedOptions ? selectedOptions.map((opt) => opt.value) : [],
    }));
  };

  const resetFilters = () =>
    setFilter({
      direccion: [],
      anombrede: [],
      cubicosMin: "",
      cubicosMax: "",
      valorMin: "",
      valorMax: "",
    });
  const toggleSlidebar = () => setShowSlidebar((v) => !v);
  const toggleFilterSlidebar = () => setShowFilterSlidebar((v) => !v);

  // Cierra slidebars al clicar fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        slidebarRef.current &&
        !slidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-slidebar-button")
      ) {
        setShowSlidebar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutsideFilter = (e) => {
      if (
        filterSlidebarRef.current &&
        !filterSlidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-filter-slidebar-button")
      ) {
        setShowFilterSlidebar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideFilter);
    return () =>
      document.removeEventListener("mousedown", handleClickOutsideFilter);
  }, []);

  // Actualiza campos en Firebase y en estado local
  const handleFieldChange = (id, field, value) => {
    if (field === "direccion") {
      const exists = data.some(
        (c) => c.direccion.toLowerCase() === value.toLowerCase() && c.id !== id
      );
      if (exists) {
        alert(`La dirección "${value}" ya existe para otro cliente.`);
        return;
      }
    }
    const dbRefItem = ref(database, `clientes/${id}`);
    update(dbRefItem, { [field]: value }).catch((err) =>
      console.error("Error updating data: ", err)
    );
    setData((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  // Agregar cliente con A Nombre De
  const handleAddCliente = () => {
    const dbRefClientes = ref(database, "clientes");

    Swal.fire({
      title: "Agregar Cliente",
      html:
        `<input id="swal-direccion" class="swal2-input" placeholder="Dirección">` +
        `<input id="swal-anombrede" class="swal2-input" placeholder="A nombre de (opcional)">` +
        `<input id="swal-cubicos" type="number" min="0" class="swal2-input" placeholder="Cúbicos (opcional)">` +
        `<input id="swal-valor" type="number" min="0" class="swal2-input" placeholder="Valor (opcional)">`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Agregar",
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: () => {
        const direccion = document
          .getElementById("swal-direccion")
          .value.trim();
        const anombrede = document
          .getElementById("swal-anombrede")
          .value.trim();
        const cubicosVal = document.getElementById("swal-cubicos").value;
        const valorVal = document.getElementById("swal-valor").value;

        // Validación: dirección obligatoria
        if (!direccion) {
          Swal.showValidationMessage("La dirección es obligatoria");
          return false;
        }

        const nuevoCliente = {
          direccion,
          anombrede: anombrede || null,
          cubicos: cubicosVal ? Number(cubicosVal) : 0,
          valor: valorVal ? Number(valorVal) : 0,
        };

        // Push dentro de preConfirm para integrar la operación en el flujo
        return push(dbRefClientes, nuevoCliente)
          .then(() => nuevoCliente)
          .catch((err) => {
            Swal.showValidationMessage(`Error al guardar: ${err.message}`);
          });
      },
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: "success",
          title: "Cliente agregado",
          text: `"${result.value.direccion}" se agregó correctamente.`,
          timer: 2000,
          showConfirmButton: false,
        });
      }
    });
  };

  const handleDeleteClientes = () => {
    selectedClientes.forEach((id) => {
      remove(ref(database, `clientes/${id}`)).catch((err) =>
        console.error("Error deleting client: ", err)
      );
    });
    setSelectedClientes([]);
  };

  const handleSelectCliente = (id) =>
    setSelectedClientes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // Aplica ambos filtros antes de ordenar
  const filteredData = data
    .filter((c) =>
      filter.direccion.length ? filter.direccion.includes(c.direccion) : true
    )
    .filter((c) =>
      filter.anombrede.length ? filter.anombrede.includes(c.anombrede) : true
    )
    .filter((c) => {
      const cubicos = Number(c.cubicos);
      const cubicosMin = filter.cubicosMin ? Number(filter.cubicosMin) : null;
      const cubicosMax = filter.cubicosMax ? Number(filter.cubicosMax) : null;
      return (
        (!cubicosMin || cubicos >= cubicosMin) &&
        (!cubicosMax || cubicos <= cubicosMax)
      );
    })
    .filter((c) => {
      const valor = Number(c.valor);
      const valorMin = filter.valorMin ? Number(filter.valorMin) : null;
      const valorMax = filter.valorMax ? Number(filter.valorMax) : null;
      return (
        (!valorMin || valor >= valorMin) && (!valorMax || valor <= valorMax)
      );
    })
    .sort((a, b) => {
      const aIsNew = a.direccion.startsWith("Nuevo Cliente");
      const bIsNew = b.direccion.startsWith("Nuevo Cliente");
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      return a.direccion.localeCompare(b.direccion, undefined, {
        sensitivity: "base",
      });
    });

  return (
    <div className="homepage-container">
      <Slidebar />
      <div onClick={() => toggleSlidebar(!showSlidebar)}></div>

      {/* Filtro */}
      <div onClick={toggleFilterSlidebar}>
        <img
          src={filtericon}
          className="show-filter-slidebar-button"
          alt="Filtros"
        />
      </div>
      <div
        ref={filterSlidebarRef}
        className={`filter-slidebar ${showFilterSlidebar ? "show" : ""}`}
      >
        <h2>Filtros</h2>
        <label>Dirección</label>
        <Select
          isClearable
          isMulti
          options={directions.map((dir) => ({ value: dir, label: dir }))}
          placeholder="Selecciona dirección(es)..."
          onChange={handleDireccionFilterChange}
          value={filter.direccion.map((dir) => ({ value: dir, label: dir }))}
        />
        <label>A Nombre De</label>
        <Select
          isClearable
          isMulti
          options={names.map((name) => ({ value: name, label: name }))}
          placeholder="Selecciona nombre(s)..."
          onChange={handleNameFilterChange}
          value={filter.anombrede.map((name) => ({ value: name, label: name }))}
        />
        <label>Cúbicos (rango)</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="number"
            placeholder="Min"
            value={filter.cubicosMin}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, cubicosMin: e.target.value }))
            }
            style={{ width: "10ch" }}
          />
          <input
            type="number"
            placeholder="Max"
            value={filter.cubicosMax}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, cubicosMax: e.target.value }))
            }
            style={{ width: "10ch" }}
          />
        </div>
        <label>Valor (rango)</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="number"
            placeholder="Min"
            value={filter.valorMin}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, valorMin: e.target.value }))
            }
            style={{ width: "10ch" }}
          />
          <input
            type="number"
            placeholder="Max"
            value={filter.valorMax}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, valorMax: e.target.value }))
            }
            style={{ width: "10ch" }}
          />
        </div>
        <button className="discard-filter-button" onClick={resetFilters}>
          Descartar Filtros
        </button>
      </div>

      {/* Título y Fecha/Hora */}
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Clientes</h1>
          <div className="current-date">
            <div>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="homepage-card">
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Seleccionar</th>
                <th>Dirección</th>
                <th>A Nombre De</th>
                <th>Cúbicos</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length ? (
                filteredData.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>
                      <input
                        type="checkbox"
                        style={{
                          width: "3ch",
                          height: "3ch",
                          marginLeft: "40%",
                        }}
                        checked={selectedClientes.includes(cliente.id)}
                        onChange={() => handleSelectCliente(cliente.id)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        style={{ textAlign: "center", width: "25ch" }}
                        value={cliente.direccion}
                        onChange={(e) =>
                          handleFieldChange(
                            cliente.id,
                            "direccion",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        style={{ textAlign: "center", width: "20ch" }}
                        value={cliente.anombrede}
                        onChange={(e) =>
                          handleFieldChange(
                            cliente.id,
                            "anombrede",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ textAlign: "center", width: "13ch" }}
                        value={cliente.cubicos}
                        onChange={(e) =>
                          handleFieldChange(
                            cliente.id,
                            "cubicos",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ textAlign: "center", width: "13ch" }}
                        value={cliente.valor}
                        onChange={(e) =>
                          handleFieldChange(cliente.id, "valor", e.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">No se encontraron clientes</td>
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
            style={{ backgroundColor: "red" }}
            onClick={handleDeleteClientes}
            className="filter-button"
            disabled={!selectedClientes.length}
          >
            Eliminar Clientes Seleccionados
          </button>
        </div>
      </div>
      <button onClick={handleAddCliente} className="create-table-button">
        +
      </button>
    </div>
  );
};

export default Clientes;
