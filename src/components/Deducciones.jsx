import React, { useState, useEffect, useRef, useMemo } from "react";
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

// Formatear moneda
const formatCurrency = (amount) =>
  Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const Deducciones = () => {
  const [deducciones, setDeducciones] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedDeducciones, setLoadedDeducciones] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtros
  const [filters, setFilters] = useState({
    realizado: [],
    fechaInicio: null,
    fechaFin: null,
  });
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);

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

  // Cargar deducciones ordenadas por timestamp (más reciente primero)
  useEffect(() => {
    const deduccionesRef = ref(database, "deducciones");
    const unsubscribe = onValue(deduccionesRef, (snapshot) => {
      if (snapshot.exists()) {
        const deduccionesData = snapshot.val();
        const deduccionesList = Object.entries(deduccionesData)
          .map(([id, deduccion]) => ({ id, ...deduccion }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setDeducciones(deduccionesList);
      } else {
        setDeducciones([]);
      }
      setLoadedDeducciones(true);
    });
    return () => unsubscribe();
  }, []);

  // Control de carga
  useEffect(() => {
    if (loadedDeducciones && loadedUsers) {
      setLoading(false);
    }
  }, [loadedDeducciones, loadedUsers]);

  // Actualizar campos
  const handleFieldChange = async (id, field, value) => {
    try {
      const updateData = { [field]: value };

      // Actualizar en Firebase
      await update(ref(database, `deducciones/${id}`), updateData);

      // Actualizar estado local
      setDeducciones((prev) =>
        prev
          .map((deduccion) =>
            deduccion.id === id ? { ...deduccion, ...updateData } : deduccion
          )
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
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
      descripcion: "",
      realizado: "",
      valor: 0,
      timestamp: Date.now(),
      createdBy: decryptData(localStorage.getItem("user"))?.name || "Admin",
    };

    try {
      const deduccionesRef = ref(database, "deducciones");
      const newRef = push(deduccionesRef);
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
        await remove(ref(database, `deducciones/${id}`));
        Swal.fire("Eliminado", "El registro ha sido eliminado", "success");
      } catch (error) {
        console.error("Error deleting record:", error);
        Swal.fire("Error", "No se pudo eliminar el registro", "error");
      }
    }
  };

  // Obtener nombre de usuario
  const getUserName = (userId) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.name : "";
  };

  // Filtrado y ordenamiento por fecha
  const filteredDeducciones = deducciones
    .filter((deduccion) => {
      if (filters.fechaInicio && filters.fechaFin) {
        const [day, month, year] = (deduccion.fecha || "").split("-");
        const itemDate = new Date(year, month - 1, day);
        if (itemDate < filters.fechaInicio || itemDate > filters.fechaFin)
          return false;
      }

      if (filters.realizado.length > 0) {
        const matchRealizado = filters.realizado.some((filterValue) => {
          if (filterValue === "__EMPTY__") {
            return !deduccion.realizado || deduccion.realizado.trim() === "";
          }
        return deduccion.realizado === filterValue;
        });
        if (!matchRealizado) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const [dayA, monthA, yearA] = (a.fecha || "").split("-");
      const [dayB, monthB, yearB] = (b.fecha || "").split("-");
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateB - dateA; // Más reciente primero
    });

  // >>> Total General de Valor (sobre el conjunto filtrado) <<<
  const totalGeneralValor = useMemo(
    () =>
      filteredDeducciones.reduce(
        (sum, item) => sum + (parseFloat(item.valor) || 0),
        0
      ),
    [filteredDeducciones]
  );

  // Paginación
  const totalItems = filteredDeducciones.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredDeducciones.slice(startIndex, endIndex);

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

      {/* FILTROS */}
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
        <h2 style={{ color: "white" }}>Filtros</h2>
        <br />
        <hr />

        <label>Filtrar Por Realizado</label>
        <Select
          isMulti
          value={filters.realizado.map((val) => ({
            value: val,
            label:
              val === "__EMPTY__" ? "Sin asignar" : getUserName(val) || val,
          }))}
          onChange={(selectedOptions) => {
            const values = selectedOptions
              ? selectedOptions.map((opt) => opt.value)
              : [];
            setFilters((prev) => ({ ...prev, realizado: values }));
          }}
          options={[
            { value: "__EMPTY__", label: "Sin asignar" },
            ...users.map((user) => ({ value: user.id, label: user.name })),
          ]}
          placeholder="Seleccionar usuarios..."
          className="react-select-container"
          classNamePrefix="react-select"
        />

        <label>Filtrar Por Rango de Fechas</label>
        <DatePicker
          selected={filters.fechaInicio}
          onChange={handleDateRangeChange}
          startDate={filters.fechaInicio}
          endDate={filters.fechaFin}
          selectsRange
          dateFormat="dd/MM/yyyy"
          placeholderText="Seleccionar rango de fechas"
          className="date-picker-input"
        />

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({ realizado: [], fechaInicio: null, fechaFin: null })
          }
        >
          Descartar Filtros
        </button>
      </div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Deducciones</h1>
          <div className="current-date">
            <div style={{ cursor: "default" }}>
              {new Date().toLocaleDateString()}
            </div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        {/* Resumen Totales */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              color: "#fff",
              borderRadius: "6px",
              padding: "8px",
              flex: 1,
              textAlign: "center",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              backgroundColor: "#28a745",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.backgroundColor = "#218838";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.backgroundColor = "#28a745";
            }}
          >
            <p
              style={{
                margin: "0",
                fontSize: "12px",
                pointerEvents: "none",
                fontWeight: "bold",
              }}
            >
              Total General Valor
            </p>
            <p
              style={{
                margin: "0",
                fontSize: "12px",
                pointerEvents: "none",
                fontWeight: "bold",
              }}
            >
              AWG {formatCurrency(totalGeneralValor)}
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Realizado</th>
                <th>Valor</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((deduccion) => (
                  <tr key={deduccion.id}>
                    <td>
                      <input
                        type="date"
                        value={
                          deduccion.fecha
                            ? deduccion.fecha.split("-").reverse().join("-")
                            : ""
                        }
                        onChange={(e) => {
                          const [year, month, day] = e.target.value.split("-");
                          const formattedDate = `${day}-${month}-${year}`;
                          handleFieldChange(
                            deduccion.id,
                            "fecha",
                            formattedDate
                          );
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={deduccion.descripcion || ""}
                        onChange={(e) =>
                          handleFieldChange(
                            deduccion.id,
                            "descripcion",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={deduccion.realizado || ""}
                        onChange={(e) =>
                          handleFieldChange(
                            deduccion.id,
                            "realizado",
                            e.target.value
                          )
                        }
                      >
                        <option value=""></option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <input
                          type="number"
                          value={deduccion.valor || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              deduccion.id,
                              "valor",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          min="0"
                          step="0.01"
                          style={{ width: "80px" }}
                        />
                        <span style={{ marginRight: "5px" }}>AWG</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="delete-button"
                        onClick={() => deleteRecord(deduccion.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">No hay deducciones registradas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="pagination-container">
          <div className="pagination-info">
            <span>
              Mostrando {startIndex + 1} a {Math.min(endIndex, totalItems)} de{" "}
              {totalItems} registros
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="items-per-page-select"
            >
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>
          </div>

          <div className="pagination-controls">
            <button onClick={goToFirstPage} disabled={currentPage === 1}>
              ««
            </button>
            <button onClick={goToPreviousPage} disabled={currentPage === 1}>
              «
            </button>
            <span className="page-info">
              Página {currentPage} de {totalPages}
            </span>
            <button onClick={goToNextPage} disabled={currentPage === totalPages}>
              »
            </button>
            <button onClick={goToLastPage} disabled={currentPage === totalPages}>
              »»
            </button>
          </div>
        </div>
      </div>

      <button className="create-table-button" onClick={addData}>
        +
      </button>
    </div>
  );
};

export default Deducciones;
