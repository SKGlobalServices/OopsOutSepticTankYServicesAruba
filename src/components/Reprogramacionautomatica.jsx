import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, remove, update, onValue } from "firebase/database";
import Swal from "sweetalert2";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import agendamientosfuturos from "../assets/img/agendamientosfuturos_icon.png";
import Select from "react-select";
import Clock from "./Clock";

const Reprogramacionautomatica = () => {
  const [data, setData] = useState([]);
  const [clients, setClients] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);
  const [filters, setFilters] = useState({
    direccion: "",
    servicio: "",
    dia: "",
    semana: "",
    mes: "",
    activo: "",
  });

  // Escucha de Firebase para "reprogramacionautomatica"
  useEffect(() => {
    const dbRef = ref(database, "reprogramacionautomatica");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        // Extraer y normalizar cada item.dia como array
        const fetchedData = Object.entries(snapshot.val()).map(([id, item]) => [
          id,
          {
            ...item,
            dia: Array.isArray(item.dia) ? item.dia : [],
          },
        ]);

        // Ordenar por dirección
        const sortedData = fetchedData.sort(([, a], [, b]) =>
          a.direccion.localeCompare(b.direccion)
        );

        setData(sortedData);
      } else {
        setData([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const getDayName = (date) => {
    const days = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    return days[date.getDay()];
  };

  // 2) Para cada item, genera su próxima fecha tras `baseDate`
  const nextOccurrence = (item, baseDate, actualBase) => {
    if (item.periodo === "dia") {
      const next = new Date(baseDate);
      next.setDate(baseDate.getDate() + item.rc);
      return next;
    }
    if (item.periodo === "semana") {
      for (let d = 1; d <= 7 * item.rc; d++) {
        const cand = new Date(baseDate);
        cand.setDate(baseDate.getDate() + d);
        const weeksSince = Math.floor((cand - actualBase) / (7 * 86400000));
        if (
          item.dia.includes(getDayName(cand)) &&
          item.rc > 0 &&
          weeksSince % item.rc === 0
        ) {
          return cand;
        }
      }
      return null;
    }
    if (item.periodo === "mes") {
      const diasMes = item.dia.map((d) => parseInt(d, 10));
      for (let m = 1; m <= 12; m++) {
        const year =
          actualBase.getFullYear() +
          Math.floor((actualBase.getMonth() + m) / 12);
        const month = (actualBase.getMonth() + m) % 12;
        for (let day of diasMes.sort((a, b) => a - b)) {
          const cand = new Date(year, month, day);
          if (cand > baseDate) {
            const monthDiff =
              (cand.getFullYear() - actualBase.getFullYear()) * 12 +
              (cand.getMonth() - actualBase.getMonth());
            if (item.rc > 0 && monthDiff % item.rc === 0) {
              return cand;
            }
          }
        }
      }
      return null;
    }
    return null;
  };

  // 3) Genera N ocurrencias por item y recoge todas, luego ordena y trunca a 100
  const computePredictedTransfers = () => {
    const today = new Date();
    const active = data.filter(([, item]) => item.activo);
    const perItem = active.length ? Math.ceil(100 / active.length) : 0;

    const events = [];
    for (let [, item] of active) {
      const actualBase = item.timestamp
        ? new Date(item.timestamp)
        : new Date(today);
      let baseDate = actualBase;

      for (let i = 0; i < perItem; i++) {
        const next = nextOccurrence(item, baseDate, actualBase);
        if (!next) break;
        events.push({
          direccion: item.direccion,
          servicio: item.servicio,
          date: next,
          regla:
            item.periodo === "dia"
              ? `Cada ${item.rc} día${item.rc > 1 ? "s" : ""}`
              : item.periodo === "semana"
              ? `Cada ${item.rc} semana${item.rc > 1 ? "s" : ""} (${getDayName(
                  next
                )})`
              : `Cada ${item.rc} mes${
                  item.rc > 1 ? "es" : ""
                } (día ${next.getDate()})`,
        });
        baseDate = next;
      }
    }

    return events
      .sort((a, b) => a.date - b.date)
      .slice(0, 100)
      .map((e) => ({
        direccion: e.direccion,
        servicio: e.servicio,
        fecha: e.date.toLocaleDateString(),
        regla: e.regla,
      }));
  };

  // 4) Modal con la lista completa (hasta 100)
  const showFutureAppointments = () => {
    const preds = computePredictedTransfers();
    if (preds.length === 0) {
      return Swal.fire({
        icon: "info",
        title: "Sin registros",
        text: "No hay agendamientos activos.",
      });
    }

    const listHtml = preds
      .map(
        (p) => `
      <li style="margin-bottom:0.5em;">
        <strong>${p.direccion}</strong> — ${p.servicio} — ${p.fecha}
        <br/><small>${p.regla}</small>
      </li>
    `
      )
      .join("");

    Swal.fire({
      title: "Agendamientos Futuros",
      html: `
      <div style="max-height:400px;overflow:auto;text-align:left;margin:0 1em;">
        <ul style="padding-left:1em;margin:0;">${listHtml}</ul>
      </div>
    `,
      width: 600,
    });
  };

  // Función para actualizar uno o varios campos de un registro
  const updateFields = (id, updates) => {
    const dbRef = ref(database, `reprogramacionautomatica/${id}`);
    update(dbRef, updates).catch((error) =>
      console.error("Error actualizando en Firebase:", error)
    );
    setData((prev) =>
      prev
        .map(([itemId, item]) =>
          itemId === id ? [itemId, { ...item, ...updates }] : [itemId, item]
        )
        .sort(([, a], [, b]) => a.direccion.localeCompare(b.direccion))
    );
  };

  // Escucha de Firebase para "clientes"
  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedClients = Object.entries(snapshot.val()).map(
          ([id, client]) => ({
            id,
            direccion: client.direccion,
          })
        );
        setClients(fetchedClients);
      } else {
        setClients([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Opciones de direcciones de todos los clientes para datalists
  const direccionOptions = Array.from(
    new Set(clients.map((client) => client.direccion).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Opciones para filtro de dirección (solo direcciones presentes en tabla)
  const direccionFilterOptions = Array.from(
    new Set(data.map(([, item]) => item.direccion).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const servicioFilterOptions = Array.from(
    new Set(data.map(([, item]) => item.servicio).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const diaFilterOptions = Array.from(
    new Set(
      data
        .flatMap(([, item]) => (Array.isArray(item.dia) ? item.dia : []))
        .filter(Boolean)
    )
  ).sort((a, b) => {
    // Para mantener el orden Lunes...Domingo:
    const orden = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];
    return orden.indexOf(a) - orden.indexOf(b);
  });

  const semanaFilterOptions = Array.from(
    new Set(data.map(([, item]) => item.semana).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const mesFilterOptions = Array.from(
    new Set(data.map(([, item]) => item.mes).filter(Boolean))
  ).sort((a, b) => {
    // Para ordenar "Cada 1 Mes", "Cada 2 Meses", ... por número
    const numA = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
    const numB = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
    return numA - numB;
  });

  const dayOptions = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];
  const weekOptions = ["Semanal", "Cada 2 Semanas", "Cada 3 Semanas"];
  const monthOptions = Array.from(
    { length: 12 },
    (_, i) => `Cada ${i + 1} ${i + 1 === 1 ? "Mes" : "Meses"}`
  );

  // Función para mostrar el formulario de agregar servicio
  const showAddSwal = () => {
    // Valores por defecto
    let formData = {
      direccion: "",
      servicio: "",
      cubicos: "",
      rc: "",
      periodo: "",
      dia: [],
      semana: "",
      mes: "",
    };

    // HTML del formulario SIN el select de frecuencia mensual
    const formHtml = `
      <div class="swal-form">
        <!-- Dirección -->
        <div class="form-group">
          <label for="direccion">Dirección:</label>
          <input id="direccion" class="swal2-input" placeholder="Dirección" list="direcciones-list"/>
          <datalist id="direcciones-list">
            ${direccionOptions
              .map((dir) => `<option value="${dir}"/>`)
              .join("")}
          </datalist>
        </div>
        <!-- Servicio -->
        <div class="form-group">
        <label for="servicio">Servicio:</label>
        <select id="servicio" class="swal2-select">
          <option value=""></option>
          <option value="Poso">Poso</option>
          <option value="Tuberia">Tuberia</option>
          <option value="Poso + Tuberia">Poso + Tuberia</option>
          <option value="Poso + Grease Trap">Poso + Grease Trap</option>
          <option value="Tuberia + Grease Trap">Tuberia + Grease Trap</option>
          <option value="Grease Trap">Grease Trap</option>
          <option value="Water">Water</option>
        </select>
      </div>
        <!-- Cúbicos -->
        <div class="form-group">
          <label for="cubicos">Cúbicos:</label>
          <input id="cubicos" type="number" class="swal2-input" placeholder="Cúbicos"/>
        </div>
        <!-- Repetir cada -->
        <div class="form-group">
          <label for="repetirCada">Repetir cada:</label>
          <input id="repetirCada" type="number" min="1" class="swal2-input" placeholder="Intervalo"/>
        </div>
        <div class="form-group">
          <label for="tipoRepeticion">Frecuencia:</label>
          <select id="tipoRepeticion" class="swal2-select">
          <option value=""></option>
            <option value="dia">Día</option>
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
          </select>
        </div>
        <!-- Día -->
        <div id="dia-container" class="form-group">
        <label>Día</label>
          <input type="checkbox" id="checkbox-dia"/> 
        </div>
        <!-- Semanal -->
        <div id="semanal-container" class="form-group" style="display: none;">
          <label>Días de la semana:</label>
          <div class="dias-semana">
            ${dayOptions
              .map(
                (day) => `
              <div class="dia-checkbox">
                <input type="checkbox" id="dia-${day}" value="${day}"/>
                <label for="dia-${day}">${day.substring(0, 1)}</label>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        <!-- Mensual: solo calendario -->
        <div id="mes-container" class="form-group" style="display: none;">
          <label>Selecciona días del mes:</label>
          <div class="dias-mes-grid">
            ${Array.from({ length: 31 }, (_, i) => i + 1)
              .map(
                (day) => `
              <div class="dia-mes">
                <input type="checkbox" id="dia-mes-${day}" value="${day}"/>
                <label for="dia-mes-${day}">${day}</label>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;

    const formStyles = `
  <style>
    /* quita cualquier overflow horizontal */
    .swal2-html-container { overflow-x: hidden !important; }

    .swal-form { margin-top: 20px; }

    /* todos los fields de una sola línea (label + control) */
    .form-group {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }
    .form-group label {
      width: 50%;
      margin: 0;
      font-weight: 500;
    }
    .swal-form .swal2-input,
    .swal-form .swal2-select {
      width: 50%;
      box-sizing: border-box;
      height: 2.5em;
      padding: 0.5em 0.75em;
      font-size: 1rem;
      margin: 0;
      border: 1px solid #ccc;
    }
    .swal-form input[type="checkbox"] {
      transform: scale(1.5);
      cursor: pointer;
      margin: 0;
    }

    /* para los contenedores de multi-checkbox: ponemos label arriba y grid abajo */
    #semanal-container.form-group,
    #mes-container.form-group {
      flex-direction: column;
      align-items: flex-start;
    }
    /* label de esos contenedores en bloque */
    #semanal-container label,
    #mes-container label {
      width: auto;
      margin-bottom: 8px;
    }

    /* grid de días de la semana en full width, con wrap */
    .dias-semana {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      width: 100% !important;
      margin: 0 0 10px;
    }

    /* grid de días del mes full width, 7 cols, items centrados */
    .dias-mes-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      justify-items: center;
      width: 100% !important;
      margin: 0;
    }

    .dia-checkbox
     {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .dia-mes {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  </style>
`;

    Swal.fire({
      title: "Agregar Servicio Programado",
      html: formStyles + formHtml,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      width: "600px",
      focusConfirm: false,
      didOpen: () => {
        const sel = document.getElementById("tipoRepeticion");
        sel.addEventListener("change", () => {
          document.getElementById("dia-container").style.display =
            sel.value === "dia" ? "block" : "none";
          document.getElementById("semanal-container").style.display =
            sel.value === "semana" ? "block" : "none";
          document.getElementById("mes-container").style.display =
            sel.value === "mes" ? "block" : "none";
        });
      },
      preConfirm: () => {
        const direccion = document.getElementById("direccion").value.trim();
        if (!direccion) {
          Swal.showValidationMessage("La dirección es obligatoria");
          return false;
        }
        const servicio = document.getElementById("servicio").value;
        const cubicos = document.getElementById("cubicos").value;
        const rc = parseInt(document.getElementById("repetirCada").value, 10);
        if (!rc || rc < 1) {
          Swal.showValidationMessage(
            'Ingresa un valor válido en "Repetir cada"'
          );
          return false;
        }
        const periodo = document.getElementById("tipoRepeticion").value;
        let dia = [],
          semana = "",
          mes = "";

        if (periodo === "dia") {
          if (!document.getElementById("checkbox-dia").checked) {
            Swal.showValidationMessage("Marca la casilla Día");
            return false;
          }
          dia = ["Cada día"];
        } else if (periodo === "semana") {
          const seleccion = [];
          dayOptions.forEach((day) => {
            const cb = document.getElementById(`dia-${day}`);
            if (cb.checked) seleccion.push(day);
          });
          if (seleccion.length === 0) {
            Swal.showValidationMessage(
              "Selecciona al menos un día de la semana"
            );
            return false;
          }
          semana = `Cada ${rc} semana${rc > 1 ? "s" : ""}`;
          dia = seleccion;
        } else if (periodo === "mes") {
          const diasMes = [];
          for (let i = 1; i <= 31; i++) {
            const cb = document.getElementById(`dia-mes-${i}`);
            if (cb.checked) diasMes.push(String(i));
          }
          if (diasMes.length === 0) {
            Swal.showValidationMessage("Selecciona al menos un día del mes");
            return false;
          }
          dia = diasMes;
          mes = `Cada ${rc} ${rc === 1 ? "Mes" : "Meses"}`;
        }

        return {
          direccion,
          servicio,
          cubicos,
          rc,
          periodo,
          dia,
          semana,
          mes,
        };
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        addData(
          result.value.direccion,
          result.value.servicio,
          result.value.cubicos,
          result.value.rc,
          result.value.periodo,
          result.value.dia,
          result.value.semana,
          result.value.mes
        );
        Swal.fire({
          title: "¡Guardado!",
          text: "El servicio ha sido programado correctamente",
          icon: "success",
          toast: true,
          position: "center-end",
          showConfirmButton: false,
          timer: 3000,
        });
      }
    });
  };

  // Función para agregar un nuevo registro en "reprogramacionautomatica"
  const addData = async (
    direccion,
    servicio,
    cubicos,
    rc,
    periodo,
    dia,
    semana,
    mes,
    activo = false
  ) => {
    const dbRef = ref(database, "reprogramacionautomatica");
    const newRef = push(dbRef);
    const newData = {
      direccion,
      servicio,
      cubicos,
      rc,
      periodo,
      dia,
      semana,
      mes,
      activo,
      timestamp: Date.now(),
    };
    await set(newRef, newData);
  };

  // Función para actualizar campos en Firebase y en el estado local
  const handleFieldChange = (id, field, value) => {
    const safeValue = value === undefined ? "" : value;
    const dbRef = ref(database, `reprogramacionautomatica/${id}`);
    update(dbRef, { [field]: safeValue }).catch((error) => {
      console.error("Error updating data: ", error);
    });
    const updatedData = data.map(([itemId, item]) =>
      itemId === id ? [itemId, { ...item, [field]: safeValue }] : [itemId, item]
    );
    updatedData.sort(([idA, itemA], [idB, itemB]) =>
      itemA.direccion.localeCompare(itemB.direccion)
    );
    setData(updatedData);
  };

  // Función para eliminar un registro
  const deleteData = (id) => {
    const dbRef = ref(database, `reprogramacionautomatica/${id}`);
    remove(dbRef).catch((error) => {
      console.error("Error deleting data: ", error);
    });
    const updatedData = data.filter(([itemId]) => itemId !== id);
    updatedData.sort(([idA, itemA], [idB, itemB]) =>
      itemA.direccion.localeCompare(itemB.direccion)
    );
    setData(updatedData);
  };

  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);
  const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);

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

  // Filtrado de registros según los filtros seleccionados
  const filteredData = data.filter(([id, item]) => {
    if (
      filters.direccion &&
      (!item.direccion ||
        !item.direccion.toLowerCase().includes(filters.direccion.toLowerCase()))
    )
      return false;
    if (
      filters.servicio &&
      item.servicio.toLowerCase() !== filters.servicio.toLowerCase()
    )
      return false;
    if (filters.dia) {
      if (!item.dia || !item.dia.includes(filters.dia)) return false;
    }
    if (filters.semana && item.semana !== filters.semana) return false;
    if (filters.mes && item.mes !== filters.mes) return false;
    if (filters.activo !== "") {
      const activoBool = filters.activo === "true";
      if (
        (item.activo === undefined && activoBool) ||
        (item.activo !== undefined && item.activo !== activoBool)
      )
        return false;
    }

    return true;
  });

  return (
    <div className="homepage-container">
      <Slidebar />
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

        {/* Dirección */}
        <label>Dirección</label>
        <input
          id="direccion-filter"
          type="text"
          list="direccion-filter-list"
          value={filters.direccion}
          onChange={(e) =>
            setFilters({ ...filters, direccion: e.target.value })
          }
          placeholder="Todas"
          className="filter-input"
        />
        <datalist id="direccion-filter-list">
          <option value="" /> {/* equivale a “Todas” */}
          {direccionFilterOptions.map((dir, i) => (
            <option key={i} value={dir} />
          ))}
        </datalist>

        {/* Servicio */}
        <label>Servicio</label>
        <select
          value={filters.servicio}
          onChange={(e) => setFilters({ ...filters, servicio: e.target.value })}
        >
          <option value="">Todos</option>
          {servicioFilterOptions.map((srv, i) => (
            <option key={i} value={srv}>
              {srv}
            </option>
          ))}
        </select>

        {/* Día */}
        <label>Día</label>
        <Select
          isClearable
          options={diaFilterOptions.map((day) => ({ value: day, label: day }))}
          value={
            filters.dia ? { value: filters.dia, label: filters.dia } : null
          }
          onChange={(opt) =>
            setFilters({ ...filters, dia: opt ? opt.value : "" })
          }
          placeholder="Todos"
        />

        {/* Semana */}
        <label>Semana</label>
        <select
          value={filters.semana}
          onChange={(e) => setFilters({ ...filters, semana: e.target.value })}
        >
          <option value="">Todas</option>
          {semanaFilterOptions.map((wk, i) => (
            <option key={i} value={wk}>
              {wk}
            </option>
          ))}
        </select>

        {/* Mes */}
        <label>Mes</label>
        <select
          value={filters.mes}
          onChange={(e) => setFilters({ ...filters, mes: e.target.value })}
        >
          <option value="">Todos</option>
          {mesFilterOptions.map((m, i) => (
            <option key={i} value={m}>
              {m}
            </option>
          ))}
        </select>

        <label>Activo</label>
        <select
          value={filters.activo}
          onChange={(e) => setFilters({ ...filters, activo: e.target.value })}
        >
          <option value="">Todos</option>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              direccion: "",
              servicio: "",
              dia: "",
              semana: "",
              mes: "",
              activo: "",
            })
          }
        >
          Descartar filtros
        </button>
      </div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Reprogramación Automatica</h1>
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
                <th>Servicio</th>
                <th>Cúbicos</th>
                <th>Repetir Cada</th>
                <th>Día</th>
                <th>Semana</th>
                <th>Mes</th>
                <th>Acciones</th>
                <th>Activar / Desactivar</th>
              </tr>
            </thead>
            <tbody>
              {filteredData && filteredData.length > 0 ? (
                filteredData.map(([id, item]) => (
                  <tr key={id}>
                    <td>
                      <div className="custom-select-container">
                        <input
                          type="text"
                          style={{
                            width: "20ch",
                          }}
                          value={item.direccion || ""}
                          onChange={(e) =>
                            handleFieldChange(id, "direccion", e.target.value)
                          }
                          list={`direccion-options-${id}`}
                        />
                        <datalist id={`direccion-options-${id}`}>
                          {direccionOptions.map((direccion, index) => (
                            <option key={index} value={direccion} />
                          ))}
                        </datalist>
                      </div>
                    </td>
                    <td>
                      <select
                        value={item.servicio}
                        style={{ width: "18ch" }}
                        onChange={(e) =>
                          handleFieldChange(id, "servicio", e.target.value)
                        }
                      >
                        <option value=""></option>
                        <option value="Poso">Poso</option>
                        <option value="Tuberia">Tuberia</option>
                        <option value="Poso + Tuberia">Poso + Tuberia</option>
                        <option value="Poso + Grease Trap">
                          Poso + Grease Trap
                        </option>
                        <option value="Tuberia + Grease Trap">
                          Tuberia + Grease Trap
                        </option>
                        <option value="Grease Trap">Grease Trap</option>
                        <option value="Water">Water</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: "12ch", textAlign: "center" }}
                        value={item.cubicos}
                        onChange={(e) =>
                          handleFieldChange(id, "cubicos", e.target.value)
                        }
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="number"
                        value={item.rc}
                        style={{ width: "6ch" }}
                        onChange={(e) => {
                          const newRc = parseInt(e.target.value, 10) || 0;
                          const newMes =
                            item.periodo === "mes" && item.dia?.length
                              ? `Cada ${newRc} ${newRc === 1 ? "Mes" : "Meses"}`
                              : "";
                          updateFields(id, { rc: newRc, mes: newMes });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        style={{
                          width: "3ch",
                          height: "3ch",
                          marginLeft: "10px",
                        }}
                        checked={item.periodo === "dia"}
                        disabled={
                          item.periodo === "semana" || item.periodo === "mes"
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateFields(id, {
                            periodo: checked ? "dia" : "",
                            dia: checked ? ["Cada día"] : [],
                            semana: "",
                            mes: "",
                          });
                        }}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {dayOptions.map((day) => (
                          <label
                            key={day}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              fontSize: "0.8rem",
                              fontWeight: "bold",
                              lineHeight: 1,
                            }}
                          >
                            {/* La letra arriba */}
                            <span>{day.substring(0, 1)}</span>
                            {/* La casilla debajo */}
                            <input
                              type="checkbox"
                              style={{ width: "3ch", height: "3ch" }}
                              checked={
                                item.periodo === "semana" &&
                                item.dia.includes(day)
                              }
                              disabled={
                                item.periodo === "dia" || item.periodo === "mes"
                              }
                              onChange={(e) => {
                                const newDias = e.target.checked
                                  ? [...item.dia, day]
                                  : item.dia.filter((d) => d !== day);
                                updateFields(id, {
                                  periodo: newDias.length ? "semana" : "",
                                  dia: newDias,
                                  semana: newDias.length
                                    ? `Cada ${item.rc || 1} semana${
                                        (item.rc || 1) > 1 ? "s" : ""
                                      }`
                                    : "",
                                  mes: "",
                                });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(11, 1fr)",
                          backgroundColor: "aliceblue",
                          gap: "0.2rem",
                          paddingRight: "30px",
                          paddingLeft: "10px",
                        }}
                      >
                        {Array.from({ length: 31 }, (_, i) =>
                          String(i + 1)
                        ).map((day) => (
                          <label key={day} style={{ textAlign: "start" }}>
                            <input
                              style={{ width: "2.8ch", height: "2.8ch" }}
                              type="checkbox"
                              checked={
                                item.periodo === "mes" && item.dia.includes(day)
                              }
                              disabled={
                                item.periodo === "dia" ||
                                item.periodo === "semana"
                              }
                              onChange={(e) => {
                                const newDiasMes = e.target.checked
                                  ? [...item.dia, day]
                                  : item.dia.filter((d) => d !== day);
                                updateFields(id, {
                                  periodo: newDiasMes.length ? "mes" : "",
                                  dia: newDiasMes,
                                  semana: "",
                                  mes: newDiasMes.length
                                    ? `Cada ${item.rc || 1} ${
                                        item.rc === 1 ? "Mes" : "Meses"
                                      }`
                                    : "",
                                });
                              }}
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        className="delete-button"
                        onClick={() => {
                          Swal.fire({
                            title: "¿Estás seguro de borrar este servicio?",
                            text: "Esta acción no se puede deshacer",
                            icon: "warning",
                            showCancelButton: true,
                            confirmButtonColor: "#d33",
                            cancelButtonColor: "#3085d6",
                            confirmButtonText: "Sí, borrar",
                            cancelButtonText: "Cancelar",
                            position: "center",
                            backdrop: "rgba(0,0,0,0.4)",
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                            stopKeydownPropagation: false,
                            heightAuto: false,
                          }).then((result) => {
                            if (result.isConfirmed) {
                              deleteData(id);
                              Swal.fire({
                                title: "¡Borrado!",
                                text: "El servicio ha sido eliminado.",
                                icon: "success",
                                position: "center",
                                backdrop: "rgba(0,0,0,0.4)",
                                timer: 2000,
                                showConfirmButton: false,
                              });
                            }
                          });
                        }}
                      >
                        Borrar
                      </button>
                    </td>
                    <td>
                      <input
                        style={{
                          width: "3ch",
                          height: "3ch",
                          marginLeft: "40%",
                        }}
                        type="checkbox"
                        checked={item.activo === true}
                        onChange={(e) =>
                          handleFieldChange(id, "activo", e.target.checked)
                        }
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="no-data">
                  <td colSpan="8">No hay datos disponibles.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <button className="generate-button3" onClick={showFutureAppointments}>
        <img
          className="agendamientosfuturos_icon"
          src={agendamientosfuturos}
          alt="Generar y Emitir Factura"
        />
      </button>

      <button className="create-table-button" onClick={showAddSwal}>
        +
      </button>
    </div>
  );
};

export default Reprogramacionautomatica;
