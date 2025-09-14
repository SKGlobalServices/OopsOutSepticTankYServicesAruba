import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, push, onValue, set, update, remove } from "firebase/database";
import { decryptData } from "../utils/security";
import Swal from "sweetalert2";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from "react-select";
import filtericon from "../assets/img/filters_icon.jpg";

const formatDateWithHyphen = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const Extras = () => {
  const [extras, setExtras] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedExtras, setLoadedExtras] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState(false);
  const [localValues, setLocalValues] = useState({});
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtros
  const [filters, setFilters] = useState({
    realizado: [],
    servicioAdicional: [],
    fechaInicio: null,
    fechaFin: null,
  });
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const serviciosAdicionales = {
    "Semanal": 15,
    "Dominical": 50,
    "Emergencia": 50
  };

  // Cargar usuarios excluyendo usernotactive
  useEffect(() => {
    const usersRef = ref(database, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersList = Object.entries(usersData)
          .filter(([, user]) => user.role !== "usernotactive" && user.name !== "IT")
          .map(([id, user]) => ({ id, name: user.name }));
        usersList.sort((a, b) => a.name.localeCompare(b.name));
        setUsers(usersList);
      } else {
        setUsers([]);
      }
      setLoadedUsers(true);
    });
    return () => unsubscribe();
  }, []);

  // Cargar extras ordenados por timestamp (más reciente primero)
  useEffect(() => {
    const extrasRef = ref(database, "extras");
    const unsubscribe = onValue(extrasRef, (snapshot) => {
      if (snapshot.exists()) {
        const extrasData = snapshot.val();
        const extrasList = Object.entries(extrasData)
          .map(([id, extra]) => ({ id, ...extra }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setExtras(extrasList);
      } else {
        setExtras([]);
      }
      setLoadedExtras(true);
    });
    return () => unsubscribe();
  }, []);

  // Control de carga
  useEffect(() => {
    if (loadedExtras && loadedUsers) {
      setLoading(false);
    }
  }, [loadedExtras, loadedUsers]);



  // Actualizar campos
  const handleFieldChange = async (id, field, value) => {
    try {
      let updateData = { [field]: value };
      
      // Si cambia cantidad o servicio, recalcular valor
      const currentExtra = extras.find(e => e.id === id);
      if (field === "cantidad" || field === "servicioAdicional") {
        const cantidad = parseFloat(field === "cantidad" ? value : currentExtra.cantidad) || 0;
        const servicio = field === "servicioAdicional" ? value : currentExtra.servicioAdicional;
        updateData.valor = cantidad * (serviciosAdicionales[servicio] || 0);
      }

      // Actualizar en Firebase
      await update(ref(database, `extras/${id}`), updateData);
      
      // Actualizar estado local
      setExtras(prev => 
        prev.map(extra => 
          extra.id === id ? { ...extra, ...updateData } : extra
        ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      );
    } catch (error) {
      console.error("Error updating field:", error);
      Swal.fire("Error", "No se pudo actualizar el campo", "error");
    }
  };

  // Agregar nuevo registro
  const addData = async () => {
    const hoy = formatDateWithHyphen(new Date());
    const newData = {
      fecha: hoy,
      cantidad: "",
      servicioAdicional: "",
      realizado: "",
      valor: 0,
      timestamp: Date.now(),
      createdBy: decryptData(localStorage.getItem("user"))?.name || "Admin"
    };

    try {
      const extrasRef = ref(database, "extras");
      const newRef = push(extrasRef);
      await set(newRef, newData);
    } catch (error) {
      console.error("Error adding data:", error);
      Swal.fire("Error", "No se pudo agregar el registro", "error");
    }
  };

  // Eliminar registro
  const deleteRecord = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await remove(ref(database, `extras/${id}`));
        Swal.fire("Eliminado", "El registro ha sido eliminado", "success");
      } catch (error) {
        console.error("Error deleting record:", error);
        Swal.fire("Error", "No se pudo eliminar el registro", "error");
      }
    }
  };

  // Obtener nombre de usuario
  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : "";
  };

  // Filtrado y ordenamiento por fecha
  const filteredExtras = extras.filter((extra) => {
    if (filters.fechaInicio && filters.fechaFin) {
      const [day, month, year] = extra.fecha.split("-");
      const itemDate = new Date(year, month - 1, day);
      if (itemDate < filters.fechaInicio || itemDate > filters.fechaFin)
        return false;
    }

    if (filters.realizado.length > 0) {
      const matchRealizado = filters.realizado.some((filterValue) => {
        if (filterValue === "__EMPTY__") {
          return !extra.realizado || extra.realizado.trim() === "";
        }
        return extra.realizado === filterValue;
      });
      if (!matchRealizado) return false;
    }

    if (filters.servicioAdicional.length > 0) {
      const matchServicio = filters.servicioAdicional.some((filterValue) => {
        if (filterValue === "__EMPTY__") {
          return !extra.servicioAdicional || extra.servicioAdicional.trim() === "";
        }
        return extra.servicioAdicional === filterValue;
      });
      if (!matchServicio) return false;
    }

    return true;
  }).sort((a, b) => {
    const [dayA, monthA, yearA] = (a.fecha || "").split("-");
    const [dayB, monthB, yearB] = (b.fecha || "").split("-");
    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);
    return dateB - dateA; // Más reciente primero
  });

  // Paginación
  const totalItems = filteredExtras.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredExtras.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  // Manejo del rango de fechas
  const handleDateRangeChange = (dates) => {
    const [start, end] = dates;
    setFilters((prev) => ({
      ...prev,
      fechaInicio: start
        ? new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            0,
            0,
            0
          )
        : null,
      fechaFin: end
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)
        : null,
    }));
  };

  // Slidebar de filtros
  const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);
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

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

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
      
      {/* Filtros */}
      <div onClick={() => toggleFilterSlidebar(!showFilterSlidebar)}>
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
        <h2 style={{color:"white"}}>Filtros</h2>
        <br />
        <hr />

        <button
          onClick={() => setShowDatePicker((s) => !s)}
          className="filter-button"
        >
          {showDatePicker
            ? "Ocultar selector de fechas"
            : "Filtrar por rango de fechas"}
        </button>
        {showDatePicker && (
          <DatePicker
            selected={filters.fechaInicio}
            onChange={handleDateRangeChange}
            startDate={filters.fechaInicio}
            endDate={filters.fechaFin}
            selectsRange
            inline
          />
        )}

        <label>Realizado Por</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: "__EMPTY__", label: "🚫 Vacío" },
            ...users.map((u) => ({ value: u.id, label: u.name })),
          ]}
          placeholder="Usuario(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              realizado: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.realizado.map((id) => ({
            value: id,
            label:
              id === "__EMPTY__"
                ? "🚫 Vacío"
                : users.find((u) => u.id === id)?.name || id,
          }))}
        />

        <label>Servicio Adicional</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: "__EMPTY__", label: "🚫 Vacío" },
            ...Object.keys(serviciosAdicionales).map((servicio) => ({
              value: servicio,
              label: servicio,
            })),
          ]}
          placeholder="Servicio(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              servicioAdicional: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.servicioAdicional.map((servicio) => ({
            value: servicio,
            label: servicio === "__EMPTY__" ? "🚫 Vacío" : servicio,
          }))}
        />

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              realizado: [],
              servicioAdicional: [],
              fechaInicio: null,
              fechaFin: null,
            })
          }
        >
          Descartar Filtros
        </button>
      </div>
      
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Extras</h1>
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
                <th style={{ textAlign: "center" }}>Fecha</th>
                <th>Cantidad</th>
                <th>Servicio Adicional</th>
                <th>Realizado</th>
                <th>Valor</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((extra) => {
                  return (
                    <tr key={extra.id}>
                      <td style={{ minWidth: "120px", textAlign: "center" }}>
                        <DatePicker
                          selected={
                            extra.fecha
                              ? new Date(
                                  extra.fecha.split("-")[2],
                                  extra.fecha.split("-")[1] - 1,
                                  extra.fecha.split("-")[0]
                                )
                              : null
                          }
                          onChange={(date) => {
                            const nuevaFecha = formatDateWithHyphen(date);
                            handleFieldChange(extra.id, "fecha", nuevaFecha);
                          }}
                          dateFormat="dd-MM-yyyy"
                          className="calendar-datepicker"
                          placeholderText="Selecciona fecha"
                        />
                      </td>
                      
                      <td>
                        <input
                          type="number"
                          value={localValues[`${extra.id}_cantidad`] ?? extra.cantidad ?? ""}
                          onChange={(e) =>
                            setLocalValues(prev => ({
                              ...prev,
                              [`${extra.id}_cantidad`]: e.target.value
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (extra.cantidad || "")) {
                              handleFieldChange(extra.id, "cantidad", e.target.value);
                            }
                          }}
                          min="0"
                          step="1"
                          style={{ width: "80px", textAlign: "center" }}
                        />
                      </td>
                      
                      <td>
                        <select
                          value={extra.servicioAdicional || ""}
                          onChange={(e) => handleFieldChange(extra.id, "servicioAdicional", e.target.value)}
                          style={{ width: "140px" }}
                        >
                          <option value=""></option>
                          {Object.entries(serviciosAdicionales).map(([servicio, valor]) => (
                            <option key={servicio} value={servicio}>
                              {servicio} (AWG {valor})
                            </option>
                          ))}
                        </select>
                      </td>
                      
                      <td>
                        <select
                          value={extra.realizado || ""}
                          onChange={(e) => handleFieldChange(extra.id, "realizado", e.target.value)}
                          style={{ width: "150px" }}
                        >
                          <option value=""></option>
                          {users.map(user => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {(extra.valor || 0).toFixed(2)} AWG
                      </td>
                      
                      <td style={{ minWidth: "100px", textAlign: "center" }}>
                        <button
                          className="delete-button"
                          onClick={() => deleteRecord(extra.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6">No hay registros disponibles</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de paginación */}
        <div className="pagination-container">
          <div className="pagination-info">
            <span>
              Mostrando {totalItems === 0 ? 0 : startIndex + 1}-
              {Math.min(endIndex, totalItems)} de {totalItems} registros
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
      </div>

      {/* Botón para agregar nuevo registro */}
      <button className="create-table-button" onClick={addData}>
        +
      </button>
    </div>
  );
};

export default React.memo(Extras);