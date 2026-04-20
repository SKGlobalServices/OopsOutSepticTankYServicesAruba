import React, { useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from "react-select";
import filtericon from "../assets/img/filters_icon.jpg";

// Panel visual compartido para los filtros del informe.
// Encapsula el toggle, el cierre por clic externo y la UI repetida de selects y fechas.
const InformeFiltersPanel = ({
  title = "Filtros",
  filters,
  setFilters,
  onDateRangeChange,
  resetFilters,
  users = [],
  directions = [],
  showUserFilter = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const panelRef = useRef(null);

  // Alterna la visibilidad del panel y limpia el selector de fechas al cerrarlo.
  const togglePanel = () => {
    setIsOpen((prevOpen) => {
      const nextOpen = !prevOpen;
      if (!nextOpen) {
        setShowDatePicker(false);
      }
      return nextOpen;
    });
  };

  // Cierra el panel cuando el usuario hace clic fuera, igual que en el comportamiento anterior.
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        !event.target.closest(".show-filter-slidebar-button")
      ) {
        setIsOpen(false);
        setShowDatePicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Limpia filtros y cierra el selector de fechas para mantener la misma salida visual que antes.
  const handleResetFilters = () => {
    resetFilters();
    setShowDatePicker(false);
  };

  return (
    <>
      <div className="filter-toggle" onClick={togglePanel}>
        <img
          src={filtericon}
          className="show-filter-slidebar-button"
          alt="Filtros"
        />
      </div>

      <div
        ref={panelRef}
        className={`filter-slidebar ${isOpen ? "show" : ""}`}
      >
        <h2 style={{ color: "white" }}>{title}</h2>
        <br />
        <hr />

        <button
          onClick={() => setShowDatePicker((prevShowDatePicker) => !prevShowDatePicker)}
          className="filter-button"
        >
          {showDatePicker
            ? "Ocultar selector de fechas"
            : "Filtrar por rango de fechas"}
        </button>

        {showDatePicker && (
          <DatePicker
            selected={filters.fechaInicio}
            onChange={onDateRangeChange}
            startDate={filters.fechaInicio}
            endDate={filters.fechaFin}
            selectsRange
            inline
          />
        )}

        {showUserFilter && (
          <>
            <label>Realizado Por</label>
            <Select
              isClearable
              isMulti
              options={[
                { value: "__EMPTY__", label: "🚫 Vacío" },
                ...users.map((user) => ({ value: user.id, label: user.name })),
              ]}
              placeholder="Usuario(s)..."
              onChange={(opts) =>
                setFilters((prevFilters) => ({
                  ...prevFilters,
                  realizadopor: opts ? opts.map((option) => option.value) : [],
                }))
              }
              value={filters.realizadopor.map((id) => ({
                value: id,
                label:
                  id === "__EMPTY__"
                    ? "🚫 Vacío"
                    : users.find((user) => user.id === id)?.name || id,
              }))}
            />
          </>
        )}

        <label>Dirección/Nota</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: "__EMPTY__", label: "🚫 Vacío" },
            ...directions.map((direccion) => ({
              value: direccion,
              label: direccion,
            })),
          ]}
          placeholder="Selecciona dirección(es)..."
          onChange={(selectedOptions) =>
            setFilters((prevFilters) => ({
              ...prevFilters,
              direccion: selectedOptions
                ? selectedOptions.map((option) => option.value)
                : [],
            }))
          }
          value={filters.direccion.map((direccion) => ({
            value: direccion,
            label: direccion === "__EMPTY__" ? "🚫 Vacío" : direccion,
          }))}
        />

        <button className="discard-filter-button" onClick={handleResetFilters}>
          Descartar Filtros
        </button>
      </div>
    </>
  );
};

export default React.memo(InformeFiltersPanel);