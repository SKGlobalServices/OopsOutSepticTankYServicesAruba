import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue, update, push, remove } from "firebase/database";
import "react-datepicker/dist/react-datepicker.css";
import Swal from "sweetalert2";
import Select from "react-select";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import Clock from "./Clock";
import ExcelJS from "exceljs";
import excel_icon from "../assets/img/excel_icon.jpg";


const Clientes = () => {
  const [data, setData] = useState([]);
  const [directions, setDirections] = useState([]);
  const [names, setNames] = useState([]);
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);

  // Estados locales para campos editables (onBlur)
  const [localValues, setLocalValues] = useState({});
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // Ahora filter incluye anombrede
  const [filter, setFilter] = useState({
    direccion: [],
    anombrede: [],
    cubicosMin: "",
    cubicosMax: "",
    valorMin: "",
    valorMax: "",
  });

  const [loading, setLoading] = useState(true);

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
            email: cliente.email || "",
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
      setLoading(false);
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

  // Función para resetear filtros y volver a página 1
  const resetFilters = () => {
    setFilter({
      direccion: [],
      anombrede: [],
      cubicosMin: "",
      cubicosMax: "",
      valorMin: "",
      valorMax: "",
    });
    setCurrentPage(1); // Resetear a página 1 cuando se limpian filtros
  };
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
        `<input id="swal-valor" type="number" min="0" class="swal2-input" placeholder="Valor (opcional)">` +
        `<input id="swal-email" type="email" class="swal2-input" placeholder="Email (opcional)">`,
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
        const email = document.getElementById("swal-email").value.trim();

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
          email: email || null,
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

  const formatCurrency = (amount) => {
    return Number(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

   const generateXLSX = async () => {
    try {
      const exportData = filteredData.map((cliente) => ({
        "A Nombre De": cliente.anombrede || "",
        "Dirección": cliente.direccion || "",
        "Cúbicos": cliente.cubicos || 0,
        "Valor": formatCurrency(cliente.valor || 0),
        "Email": cliente.email || "",
      }));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Clientes");

      const headers = [
        "A Nombre De",
        "Dirección", 
        "Cúbicos",
        "Valor",
        "Email"
      ];

      // Agregar cabecera
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F81BD" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Agregar filtro automático
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      };

      // Ajustar anchos de columnas
      worksheet.columns = [
        { width: 25 }, // A Nombre De
        { width: 35 }, // Dirección
        { width: 15 }, // Cúbicos
        { width: 15 }, // Valor
        { width: 30 }, // Email
      ];

      // Agregar datos
      exportData.forEach((rowData) => {
        const row = worksheet.addRow(Object.values(rowData));
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Generar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Clientes_${new Date().toLocaleDateString()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      // Mostrar mensaje de éxito
      Swal.fire({
        icon: "success",
        title: "Excel generado",
        text: `Se exportaron ${exportData.length} clientes exitosamente.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error generando Excel:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo generar el archivo Excel.",
      });
    }
  };

  // Función para eliminar clientes seleccionados con paginación
  const handleDeleteClientes = () => {
    selectedClientes.forEach((id) => {
      remove(ref(database, `clientes/${id}`)).catch((err) =>
        console.error("Error deleting client: ", err)
      );
    });
    setSelectedClientes([]);
    // Si después de eliminar la página actual queda vacía, ir a la anterior
    const totalAfterDelete = filteredData.length - selectedClientes.length;
    const totalPages = Math.ceil(totalAfterDelete / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  };

  const handleSelectCliente = (id) =>
    setSelectedClientes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // Aplicar filtros sobre todos los datos (sin paginación)
  const filteredData = data
    .filter((c) => {
      if (!filter.direccion.length) return true;
      if (filter.direccion.includes("__EMPTY__")) {
        const hasEmpty = !c.direccion || c.direccion === "" || c.direccion === null || c.direccion === undefined;
        const hasOthers = filter.direccion.some((d) => d !== "__EMPTY__" && d === c.direccion);
        return hasEmpty || hasOthers;
      }
      return filter.direccion.includes(c.direccion);
    })
    .filter((c) => {
      if (!filter.anombrede.length) return true;
      if (filter.anombrede.includes("__EMPTY__")) {
        const hasEmpty = !c.anombrede || c.anombrede === "" || c.anombrede === null || c.anombrede === undefined;
        const hasOthers = filter.anombrede.some((d) => d !== "__EMPTY__" && d === c.anombrede);
        return hasEmpty || hasOthers;
      }
      return filter.anombrede.includes(c.anombrede);
    })
    .filter((c) => {
      const cubicos = Number(c.cubicos);
      const cubicosMin = filter.cubicosMin ? Number(filter.cubicosMin) : null;
      const cubicosMax = filter.cubicosMax ? Number(filter.cubicosMax) : null;
      return (!cubicosMin || cubicos >= cubicosMin) && (!cubicosMax || cubicos <= cubicosMax);
    })
    .filter((c) => {
      const valor = Number(c.valor);
      const valorMin = filter.valorMin ? Number(filter.valorMin) : null;
      const valorMax = filter.valorMax ? Number(filter.valorMax) : null;
      return (!valorMin || valor >= valorMin) && (!valorMax || valor <= valorMax);
    })
    .sort((a, b) => {
      const aIsNew = a.direccion.startsWith("Nuevo Cliente");
      const bIsNew = b.direccion.startsWith("Nuevo Cliente");
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      return a.direccion.localeCompare(b.direccion, undefined, { sensitivity: "base" });
    });

  // Cálculos de paginación
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  // Funciones de navegación
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setSelectedClientes([]); // Limpiar selección al cambiar página
    }
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  // Función para cambiar tamaño de página
  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1); // Resetear a página 1
    setSelectedClientes([]); // Limpiar selección
  };

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
    setSelectedClientes([]);
  }, [filter]);

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
        <br/>
        <hr/>
        <label>Dirección</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: "__EMPTY__", label: "🚫 Vacío" },
            ...directions.map((dir) => ({ value: dir, label: dir })),
          ]}
          placeholder="Selecciona dirección(es)..."
          onChange={handleDireccionFilterChange}
          value={filter.direccion.map((dir) => ({ value: dir, label: dir }))}
        />
        <label>A Nombre De</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: "__EMPTY__", label: "🚫 Vacío" },
            ...names.map((name) => ({ value: name, label: name })),
          ]}
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

      {/* Información de paginación y controles */}
      <div className="homepage-card">
        {/* Tabla */}
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Seleccionar</th>
                <th>A Nombre De</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Cúbicos</th>
                <th>Valor</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length ? (
                currentPageData.map((cliente) => (
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
                        style={{ textAlign: "center", width: "16ch" }}
                        value={localValues[`${cliente.id}_anombrede`] ?? cliente.anombrede ?? ""}
                        onChange={(e) =>
                          setLocalValues(prev => ({
                            ...prev,
                            [`${cliente.id}_anombrede`]: e.target.value
                          }))
                        }
                        onBlur={(e) => {
                          if (e.target.value !== (cliente.anombrede || "")) {
                            handleFieldChange(
                              cliente.id,
                              "anombrede",
                              e.target.value
                            );
                          }
                        }}
                      />
                    </td>
                    <td className="direccion-fixed-td">
                      <input
                        className="direccion-fixed-input "
                        type="text"
                        style={{ textAlign: "center", width: "18ch" }}
                        value={localValues[`${cliente.id}_direccion`] ?? cliente.direccion ?? ""}
                        onChange={(e) =>
                          setLocalValues(prev => ({
                            ...prev,
                            [`${cliente.id}_direccion`]: e.target.value
                          }))
                        }
                        onBlur={(e) => {
                          if (e.target.value !== (cliente.direccion || "")) {
                            handleFieldChange(
                              cliente.id,
                              "direccion",
                              e.target.value
                            );
                          }
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ textAlign: "center", width: "13ch" }}
                        value={localValues[`${cliente.id}_cubicos`] ?? cliente.cubicos ?? ""}
                        onChange={(e) =>
                          setLocalValues(prev => ({
                            ...prev,
                            [`${cliente.id}_cubicos`]: e.target.value
                          }))
                        }
                        onBlur={(e) => {
                          if (e.target.value !== (cliente.cubicos || "")) {
                            handleFieldChange(
                              cliente.id,
                              "cubicos",
                              e.target.value
                            );
                          }
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ textAlign: "center", width: "13ch" }}
                        value={localValues[`${cliente.id}_valor`] ?? cliente.valor ?? ""}
                        onChange={(e) =>
                          setLocalValues(prev => ({
                            ...prev,
                            [`${cliente.id}_valor`]: e.target.value
                          }))
                        }
                        onBlur={(e) => {
                          if (e.target.value !== (cliente.valor || "")) {
                            handleFieldChange(cliente.id, "valor", e.target.value);
                          }
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        style={{ textAlign: "center", width: "35ch" }}
                        value={localValues[`${cliente.id}_email`] ?? cliente.email ?? ""}
                        onChange={(e) =>
                          setLocalValues(prev => ({
                            ...prev,
                            [`${cliente.id}_email`]: e.target.value
                          }))
                        }
                        onBlur={(e) => {
                          if (e.target.value !== (cliente.email || "")) {
                            handleFieldChange(cliente.id, "email", e.target.value);
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">No se encontraron clientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-container">
        <div className="pagination-info">
          <span>
            Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems} registros
          </span>
          <div className="items-per-page">
            <label>Mostrar:</label>
            <select 
              value={itemsPerPage} 
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
            <span>por página</span>
          </div>
        </div>
        
        {/* Controles de navegación */}
        <div className="pagination-controls">
          <button 
            onClick={goToFirstPage} 
            disabled={currentPage === 1}
            title="Primera página"
          >
            ««
          </button>
          <button 
            onClick={goToPreviousPage} 
            disabled={currentPage === 1}
            title="Página anterior"
          >
            «
          </button>
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <button 
            onClick={goToNextPage} 
            disabled={currentPage === totalPages}
            title="Página siguiente"
          >
            »
          </button>
          <button 
            onClick={goToLastPage} 
            disabled={currentPage === totalPages}
            title="Última página"
          >
            »»
          </button>
        </div>
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
            Eliminar Clientes Seleccionados ({selectedClientes.length})
          </button>
        </div>

      </div>
       <button className="generate-button2" onClick={generateXLSX}>
        <img className="generate-button-imagen2" src={excel_icon} alt="Excel" />
      </button>

      <button onClick={handleAddCliente} className="create-table-button">
        +
      </button>
    </div>
  );
};

export default Clientes;
