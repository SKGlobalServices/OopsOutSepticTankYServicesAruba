import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, remove, update, onValue } from "firebase/database";
import Swal from "sweetalert2";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import agendamientosfuturos from "../assets/img/agendamientosfuturos_icon.png";
import Select from "react-select";
import Clock from "./Clock";
import * as XLSX from "xlsx";

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

  const [localValues, setLocalValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);

  // ---------- Helpers de fecha ----------
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

  const fmtYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };

  const parseYMD = (s) => {
    const [y, m, d] = (s || "").split("-").map((x) => parseInt(x, 10));
    const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
    if (isNaN(dt.getTime())) return null;
    return dt;
  };

  // ---------- Escucha principal (reprogramacionautomatica) ----------
  useEffect(() => {
    const dbRef = ref(database, "reprogramacionautomatica");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedData = Object.entries(snapshot.val()).map(([id, item]) => [
          id,
          {
            ...item,
            dia: Array.isArray(item.dia)
              ? item.dia
              : item.dia && typeof item.dia === "object"
              ? Object.values(item.dia)
              : [],
            exceptions: Array.isArray(item.exceptions) ? item.exceptions : [],
            overrides:
              item.overrides && typeof item.overrides === "object"
                ? item.overrides
                : {},
            cutovers: Array.isArray(item.cutovers) ? item.cutovers : [],
          },
        ]);
        const sorted = fetchedData.sort(([, a], [, b]) =>
          (a.direccion || "").localeCompare(b.direccion || "")
        );
        setData(sorted);
      } else {
        setData([]);
      }
      setLoadedData(true);
    });
    return () => unsubscribe();
  }, []);

  // ---------- Regla efectiva (respeta cutovers/overrides/exceptions) ----------
  const getEffectiveScheduleForDate = (item, date) => {
    if (item.solounavez) {
      return { rc: null, periodo: "", dia: [] };
    }
    const ymd = fmtYMD(date);
    const base = {
      rc: item.rc || 1,
      periodo: item.periodo || "",
      dia: Array.isArray(item.dia) ? item.dia : [],
    };
    if (!Array.isArray(item.cutovers) || item.cutovers.length === 0) {
      return base;
    }
    const applicable = [...item.cutovers]
      .filter((c) => c && c.fromYmd && c.fromYmd <= ymd)
      .sort((a, b) =>
        a.fromYmd < b.fromYmd ? -1 : a.fromYmd > b.fromYmd ? 1 : 0
      );
    if (applicable.length === 0) return base;
    const last = applicable[applicable.length - 1];
    return {
      rc: last.rc || 1,
      periodo: last.periodo || "",
      dia: Array.isArray(last.dia) ? last.dia : [],
    };
  };

  const nextOccurrence = (item, baseDate, actualBase, maxLookaheadDays = 366) => {
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // El script evalúa desde "pasado mañana" en adelante
    const minEvalDate = new Date(todayMid);
    minEvalDate.setDate(todayMid.getDate() + 2);
    
    const start = new Date(baseDate);

    for (let d = 1; d <= maxLookaheadDays; d++) {
      const cand = new Date(start);
      cand.setDate(start.getDate() + d);
      
      // Solo considerar fechas >= pasado mañana
      if (cand < minEvalDate) continue;

      const ymdCand = fmtYMD(cand);
      if (Array.isArray(item.exceptions) && item.exceptions.includes(ymdCand)) {
        continue;
      }

      const eff = getEffectiveScheduleForDate(item, cand);
      if (!eff.periodo) continue;

      const baseRef = item.timestamp ? new Date(item.timestamp) : actualBase;
      const diffDays = Math.floor((cand - baseRef) / 86400000);

      let ok = false;
      if (eff.periodo === "dia") {
        if (eff.rc > 0 && diffDays % eff.rc === 0) ok = true;
      } else if (eff.periodo === "semana") {
        const diffWeeks = Math.floor(diffDays / 7);
        if (
          eff.dia.includes(getDayName(cand)) &&
          eff.rc > 0 &&
          diffWeeks % eff.rc === 0
        ) {
          ok = true;
        }
      } else if (eff.periodo === "mes") {
        const monthDiff =
          (cand.getFullYear() - baseRef.getFullYear()) * 12 +
          (cand.getMonth() - baseRef.getMonth());
        const dayOfMonth = String(cand.getDate());
        if (eff.dia.includes(dayOfMonth) && eff.rc > 0 && monthDiff % eff.rc === 0) {
          ok = true;
        }
      }
      if (!ok) continue;

      return cand;
    }
    return null;
  };

  // ---------- Predicciones (hasta 100) ----------
  const computePredictedTransfers = () => {
    const today = new Date();
    const events = [];

    // uno-solo
    data.forEach(([id, item]) => {
      if (item.activo && item.solounavez && item.fechaEjecucion) {
        const ymd = item.fechaEjecucion;
        const date = parseYMD(ymd) || new Date(item.fechaEjecucion + "T00:00");
        const minExecDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
        if (!isNaN(date) && date >= minExecDate) {
          events.push({
            id,
            direccion: item.direccion,
            servicio: item.servicio,
            date,
            ymdOriginal: ymd,
            regla: "Solo una vez",
            _meta: { seriesId: null, type: "once" },
          });
        }
      }
    });

    // periódicos
    const periodic = data.filter(([, it]) => it.activo && !it.solounavez);
    const slots = Math.max(100 - events.length, 0);
    const perItem = periodic.length ? Math.ceil(slots / periodic.length) : 0;

    for (let [id, item] of periodic) {
      let baseDate = item.timestamp ? new Date(item.timestamp) : new Date(today);
      const actualBase = new Date(item.timestamp || today);
      let generated = 0;

      while (generated < perItem) {
        const next = nextOccurrence(item, baseDate, actualBase);
        if (!next) break;
        
        // Si la fecha calculada es anterior a pasado mañana, continuar buscando
        const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
        if (next < minDate) {
          baseDate = next;
          continue;
        }
        const ymd = fmtYMD(next);
        
        // Aplicar override si existe para mostrar la fecha real
        let finalDate = next;
        if (item.overrides && typeof item.overrides === "object") {
          const ov = item.overrides[ymd];
          if (ov && ov.ymdNew) {
            const moved = parseYMD(ov.ymdNew);
            if (moved) {
              finalDate = moved;
            }
          }
        }
        
        // Solo incluir si la fecha final es desde pasado mañana
        const minExecDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
        if (finalDate >= minExecDate) {
          const eff = getEffectiveScheduleForDate(item, next);
          let regla = "";
          if (eff.periodo === "dia") {
            regla = `Cada ${eff.rc} día${eff.rc > 1 ? "s" : ""}`;
          } else if (eff.periodo === "semana") {
            regla = `Cada ${eff.rc} semana${eff.rc > 1 ? "s" : ""} (${getDayName(finalDate)})`;
          } else if (eff.periodo === "mes") {
            regla = `Cada ${eff.rc} mes${eff.rc > 1 ? "es" : ""} (día ${finalDate.getDate()})`;
          }
          
          events.push({
            id,
            direccion: item.direccion,
            servicio: item.servicio,
            date: finalDate,
            ymdOriginal: ymd,
            regla,
            _meta: { seriesId: id, type: "periodic" },
          });
          generated++;
        }
        baseDate = next;
      }
    }

    return events
      .sort((a, b) => a.date - b.date)
      .slice(0, 100)
      .map((e) => ({
        ...e,
        fecha: e.date.toLocaleDateString(),
        isRecurring: !e.regla.includes("Solo una vez"),
        originalId: e.id,
        originalItem: data.find(([id]) => id === e.id)?.[1],
      }));
  };

  // ---------- Modificar ocurrencia (B) ----------
  const modifyOccurrence = async (pred) => {
    const { id, ymdOriginal } = pred;
    const itemEntry = data.find(([k]) => k === id);
    if (!itemEntry) {
      await Swal.fire("Error", "No se encontró el registro.", "error");
      return;
    }
    const [, item] = itemEntry;

    const { value: scope } = await Swal.fire({
      title: "Aplicar cambio a",
      input: "radio",
      inputOptions: {
        only: "Solo este evento",
        following: "Este y los siguientes",
        next: "Los siguientes",
      },
      inputValidator: (v) => (!v ? "Selecciona una opción" : undefined),
      confirmButtonText: "Continuar",
      showCancelButton: true,
    });
    if (!scope) return;

    if (scope === "only") {
      const { value: newYmd } = await Swal.fire({
        title: "Nueva fecha para este evento (solo este)",
        html: `
          <style>
            .date-input-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10px;
              margin: 20px 0;
            }
            .date-input-container label {
              font-weight: 600;
              color: #333;
              margin-bottom: 5px;
            }
            .date-input-container input[type="date"] {
              padding: 8px 12px;
              border: 1px solid #ccc;
              border-radius: 4px;
              font-size: 14px;
              width: 200px;
            }
          </style>
          <div class="date-input-container">
            <label for="new-date">Selecciona la nueva fecha:</label>
            <input type="date" id="new-date" value="${ymdOriginal}" min="${minExecDate}" />
          </div>
        `,
        confirmButtonText: "Guardar",
        showCancelButton: true,
        preConfirm: () => {
          const dateInput = document.getElementById('new-date');
          const val = dateInput.value;
          if (!val) {
            Swal.showValidationMessage("Selecciona una fecha válida.");
            return false;
          }
          return val;
        },
      });
      if (!newYmd) return;

      const overrides = { ...(item.overrides || {}) };
      overrides[ymdOriginal] = { ymdNew: newYmd };
      await updateFields(id, { overrides });
      await Swal.fire("Hecho", "Se movió solo esta ocurrencia.", "success");
      return;
    }

    if (scope === "following") {
      const { value: periodo } = await Swal.fire({
        title: "Nueva frecuencia (a partir de esta y las siguientes)",
        input: "select",
        inputOptions: { dia: "Día", semana: "Semana", mes: "Mes" },
        inputPlaceholder: "Selecciona",
        confirmButtonText: "Siguiente",
        showCancelButton: true,
        inputValidator: (v) => (!v ? "Selecciona una frecuencia" : undefined),
      });
      if (!periodo) return;

      const { value: rcStr } = await Swal.fire({
        title: 'Repetir cada… (ej: "1", "2", "3")',
        input: "text",
        inputValue: String(item.rc || 1),
        confirmButtonText: "Siguiente",
        showCancelButton: true,
        preConfirm: (val) => {
          const n = parseInt(val, 10);
          if (!n || n < 1) {
            Swal.showValidationMessage("Ingresa un entero ≥ 1");
            return false;
          }
          return val;
        },
      });
      if (!rcStr) return;
      const rc = parseInt(rcStr, 10);

      let newDia = [];
      let updates = {};
      if (periodo === "semana") {
        const { value: diasTxt } = await Swal.fire({
          title: "Días de la semana (coma separada)",
          input: "text",
          inputPlaceholder: "Lunes,Miércoles,Viernes",
          inputValue:
            (Array.isArray(item.dia) && item.periodo === "semana"
              ? item.dia.join(",")
              : "") || "",
          confirmButtonText: "Guardar",
          showCancelButton: true,
        });
        if (diasTxt === undefined) return;
        newDia = (diasTxt || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        updates = {
          rc,
          periodo,
          dia: newDia,
          semana: `Cada ${rc} semana${rc > 1 ? "s" : ""}`,
          mes: "",
        };
      } else if (periodo === "mes") {
        const { value: diasNum } = await Swal.fire({
          title: "Días del mes (números, coma separada)",
          input: "text",
          inputPlaceholder: "1,15,30",
          inputValue:
            (Array.isArray(item.dia) && item.periodo === "mes"
              ? item.dia.join(",")
              : "") || "",
          confirmButtonText: "Guardar",
          showCancelButton: true,
          preConfirm: (val) => {
            const parts = (val || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            if (parts.some((p) => isNaN(parseInt(p, 10)))) {
              Swal.showValidationMessage("Solo números separados por coma.");
              return false;
            }
            return val;
          },
        });
        if (diasNum === undefined) return;
        newDia = (diasNum || "")
          .split(",")
          .map((s) => String(parseInt(s.trim(), 10)))
          .filter(Boolean);
        updates = {
          rc,
          periodo,
          dia: newDia,
          semana: "",
          mes: `Cada ${rc} ${rc === 1 ? "Mes" : "Meses"}`,
        };
      } else if (periodo === "dia") {
        newDia = ["Cada día"];
        updates = { rc, periodo, dia: newDia, semana: "", mes: "" };
      }

      // Actualizar el registro principal inmediatamente para "Este y los siguientes"
      const cutovers = Array.isArray(item.cutovers) ? [...item.cutovers] : [];
      cutovers.push({ fromYmd: ymdOriginal, rc, periodo, dia: newDia });
      
      await updateFields(id, { ...updates, cutovers });
      await Swal.fire(
        "Hecho",
        "Se actualizó la regla desde esta ocurrencia en adelante.",
        "success"
      );
      return;
    }

    if (scope === "next") {
      const { value: periodo } = await Swal.fire({
        title: "Nueva frecuencia para los siguientes eventos",
        input: "select",
        inputOptions: { dia: "Día", semana: "Semana", mes: "Mes" },
        inputPlaceholder: "Selecciona",
        confirmButtonText: "Siguiente",
        showCancelButton: true,
        inputValidator: (v) => (!v ? "Selecciona una frecuencia" : undefined),
      });
      if (!periodo) return;

      const { value: rcStr } = await Swal.fire({
        title: 'Repetir cada… (ej: "1", "2", "3")',
        input: "text",
        inputValue: String(item.rc || 1),
        confirmButtonText: "Siguiente",
        showCancelButton: true,
        preConfirm: (val) => {
          const n = parseInt(val, 10);
          if (!n || n < 1) {
            Swal.showValidationMessage("Ingresa un entero ≥ 1");
            return false;
          }
          return val;
        },
      });
      if (!rcStr) return;
      const rc = parseInt(rcStr, 10);

      let newDia = [];
      let updates = {};
      if (periodo === "semana") {
        const { value: diasTxt } = await Swal.fire({
          title: "Días de la semana (coma separada)",
          input: "text",
          inputPlaceholder: "Lunes,Miércoles,Viernes",
          inputValue:
            (Array.isArray(item.dia) && item.periodo === "semana"
              ? item.dia.join(",")
              : "") || "",
          confirmButtonText: "Guardar",
          showCancelButton: true,
        });
        if (diasTxt === undefined) return;
        newDia = (diasTxt || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        updates = {
          rc,
          periodo,
          dia: newDia,
          semana: `Cada ${rc} semana${rc > 1 ? "s" : ""}`,
          mes: "",
        };
      } else if (periodo === "mes") {
        const { value: diasNum } = await Swal.fire({
          title: "Días del mes (números, coma separada)",
          input: "text",
          inputPlaceholder: "1,15,30",
          inputValue:
            (Array.isArray(item.dia) && item.periodo === "mes"
              ? item.dia.join(",")
              : "") || "",
          confirmButtonText: "Guardar",
          showCancelButton: true,
          preConfirm: (val) => {
            const parts = (val || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            if (parts.some((p) => isNaN(parseInt(p, 10)))) {
              Swal.showValidationMessage("Solo números separados por coma.");
              return false;
            }
            return val;
          },
        });
        if (diasNum === undefined) return;
        newDia = (diasNum || "")
          .split(",")
          .map((s) => String(parseInt(s.trim(), 10)))
          .filter(Boolean);
        updates = {
          rc,
          periodo,
          dia: newDia,
          semana: "",
          mes: `Cada ${rc} ${rc === 1 ? "Mes" : "Meses"}`,
        };
      } else if (periodo === "dia") {
        newDia = ["Cada día"];
        updates = { rc, periodo, dia: newDia, semana: "", mes: "" };
      }
      
      // Solo agregar cutover para "Los siguientes", NO actualizar registro principal ahora
      const today = new Date();
      const nextEventYmd = fmtYMD(new Date(today.getTime() + 24 * 60 * 60 * 1000)); // mañana
      
      const cutovers = Array.isArray(item.cutovers) ? [...item.cutovers] : [];
      cutovers.push({ fromYmd: nextEventYmd, rc, periodo, dia: newDia });
      
      await updateFields(id, { cutovers });
      await Swal.fire("Hecho", "Se actualizaron los siguientes eventos.", "success");
    }
  };

  // ---------- FUTUROS con FILTROS (A) + Modificar (B) ----------
  const showFutureAppointments = async () => {
    const preds = computePredictedTransfers();
    if (!preds.length) {
      await Swal.fire("Sin registros", "No hay agendamientos activos.", "info");
      return;
    }

    // opciones únicas
    const uniqueDirs = Array.from(new Set(preds.map((p) => p.direccion))).sort();

    const dirOptions = uniqueDirs.map((d) => `<option value="${d}">`).join("");

    const filterSection = `
  <style>
    /* Sección de filtros */
    #filter-section {
      display: none;
      background: #fafafa;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      margin-bottom: 1em;
      padding: 1rem;
    }
    
    /* Layout de filtros */
    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: flex-end;
    }
    
    /* Campos de filtro */
    .filter-field {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 140px;
    }
    .filter-field label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #444;
      margin-bottom: 0.25rem;
    }
    .filter-field input.swal2-input,
    .filter-field select.swal2-input {
      height: 2.4em;
      padding: 0 0.75em;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 0.95rem;
      margin: 0;
      width: 100%;
      box-sizing: border-box;
    }
    
    /* Botones de filtro */
    .filter-buttons {
      display: flex;
      gap: 0.5rem;
      margin-left: auto;
    }
    .filter-btn {
      height: 2em;
      padding: 0 1em;
      font-weight: 600;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
      font-size: 14px;
    }
    #apply-filters {
      background: #556ee6;
      color: #fff;
    }
    #apply-filters:hover {
      background: #4254b5;
    }
    #reset-filters {
      background: rgb(230,85,85);
      color: #fff;
    }
    #reset-filters:hover {
      background: rgb(190,74,74);
    }
  </style>

  <div id="filter-section">
    <div class="filter-row">
      <div class="filter-field">
        <label for="filt-direccion">Dirección</label>
        <input id="filt-direccion" class="swal2-input" list="filt-direccion-list" placeholder="Filtrar…" />
        <datalist id="filt-direccion-list">${dirOptions}</datalist>
      </div>
      <div class="filter-field">
        <label for="filt-servicio">Servicio</label>
        <select id="filt-servicio" class="swal2-input">
          <option value="">Todos</option>
          <option value="Poso">Poso</option>
          <option value="Tuberia">Tuberia</option>
          <option value="Poso + Tuberia">Poso + Tuberia</option>
          <option value="Poso + Grease Trap">Poso + Grease Trap</option>
          <option value="Tuberia + Grease Trap">Tuberia + Grease Trap</option>
          <option value="Grease Trap">Grease Trap</option>
          <option value="Water">Water</option>
          <option value="Pool">Pool</option>
        </select>
      </div>
      <div class="filter-field">
        <label for="filt-fecha-inicio">Desde</label>
        <input id="filt-fecha-inicio" type="date" class="swal2-input" />
      </div>
      <div class="filter-field">
        <label for="filt-fecha-fin">Hasta</label>
        <input id="filt-fecha-fin" type="date" class="swal2-input" />
      </div>
      <div class="filter-buttons">
        <button id="apply-filters" class="filter-btn">Aplicar</button>
        <button id="reset-filters" class="filter-btn">Descartar</button>
      </div>
    </div>
  </div>
`;

    const renderList = (items) => `
      <style>
        /* Lista de agendamientos */
        .appointments-list {
          padding-left: 1em;
          margin: 0;
        }
        .appointment-item {
          margin-bottom: 0.8em;
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          background: #fafafa;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .appointment-info {
          flex: 1;
        }
        .appointment-info strong {
          color: #333;
          font-size: 14px;
        }
        .appointment-info small {
          color: #666;
          font-style: italic;
        }
        .appointment-actions {
          margin-left: 15px;
        }
        .modify-btn {
          padding: 6px 12px;
          border: 1px solid #556ee6;
          background: #556ee6;
          color: white;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .modify-btn:hover {
          background: #4254b5;
          border-color: #4254b5;
        }
      </style>
      <ul class="appointments-list">
        ${items
          .map(
            (p, idx) => `
          <li data-idx="${idx}" class="appointment-item">
            <div class="appointment-info">
              <strong>${p.direccion || ""}</strong> — ${p.servicio || ""} — ${p.fecha}
              <br/><small>${p.regla}</small>
            </div>
            <div class="appointment-actions">
              <button data-action="mod" class="modify-btn">
                Modificar
              </button>
            </div>
          </li>`
          )
          .join("")}
      </ul>
    `;

    const modalHtml = `
      <style>
        /* Botones del header */
        .modal-header {
          text-align: center;
          margin-bottom: 1em;
        }
        .header-btn {
          padding: 0.6em 1.2em;
          border-radius: 4px;
          font-size: 0.95rem;
          font-weight: 600;
          border: 1px solid #ccc;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          margin-right: 0.5em;
        }
        #toggle-filters {
          background: #fff;
          color: #444;
        }
        #toggle-filters:hover {
          background: #f5f5f5;
          border-color: #999;
        }
        #export-btn {
          background: #556ee6;
          color: #fff;
          border-color: #556ee6;
        }
        #export-btn:hover {
          background: #4254b5;
          border-color: #4254b5;
        }
        
        /* Contenedor de lista */
        .list-container {
          max-height: 400px;
          overflow: auto;
          text-align: left;
          margin: 0 1em;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          background: white;
        }
      </style>

      <div class="modal-header">
        <button id="toggle-filters" class="header-btn">Filtros</button>
        <button id="export-btn" class="header-btn">Exportar Excel</button>
      </div>
      ${filterSection}
      <div id="list-container" class="list-container">
        ${renderList(preds)}
      </div>
    `;

    await Swal.fire({
      title: "Agendamientos Futuros",
      width: 650,
      html: modalHtml,
      showConfirmButton: false,
      didOpen: () => {
        const listContainer = document.getElementById("list-container");
        const filtroSec = document.getElementById("filter-section");
        const toggleBtn = document.getElementById("toggle-filters");
        const exportBtn = document.getElementById("export-btn");
        const dirEl = document.getElementById("filt-direccion");
        const srvEl = document.getElementById("filt-servicio");
        const fromEl = document.getElementById("filt-fecha-inicio");
        const toEl = document.getElementById("filt-fecha-fin");
        const applyBtn = document.getElementById("apply-filters");
        const resetBtn = document.getElementById("reset-filters");

        let current = preds.slice(); // estado actual mostrado

        const attachModifyHandlers = () => {
          listContainer
            .querySelectorAll("button[data-action='mod']")
            .forEach((btn) => {
              btn.addEventListener("click", async (e) => {
                const li = e.currentTarget.closest("[data-idx]");
                const idx = parseInt(li.getAttribute("data-idx"), 10);
                const pred = current[idx];
                await modifyOccurrence(pred);
                
                // Actualizar la lista automáticamente
                const newPreds = computePredictedTransfers();
                current = newPreds.slice();
                listContainer.innerHTML = renderList(current);
                attachModifyHandlers();
              });
            });
        };

        toggleBtn.addEventListener("click", () => {
          filtroSec.style.display =
            filtroSec.style.display === "none" ? "block" : "none";
        });

        applyBtn.addEventListener("click", () => {
          const dirVal = dirEl.value.trim();
          const srvVal = srvEl.value;
          const fi = fromEl.value ? new Date(fromEl.value + "T00:00:00") : null;
          const ff = toEl.value ? new Date(toEl.value + "T23:59:59") : null;

          current = preds.filter((p) => {
            const mDir = !dirVal || p.direccion === dirVal;
            const mSrv = !srvVal || p.servicio === srvVal;
            let mDate = true;
            if (fi && p.date < fi) mDate = false;
            if (ff && p.date > ff) mDate = false;
            return mDir && mSrv && mDate;
          });

          listContainer.innerHTML = renderList(current);
          attachModifyHandlers();
        });

        resetBtn.addEventListener("click", () => {
          dirEl.value = "";
          srvEl.value = "";
          fromEl.value = "";
          toEl.value = "";
          current = preds.slice();
          listContainer.innerHTML = renderList(current);
          attachModifyHandlers();
        });

        exportBtn.addEventListener("click", () => {
          const rows = current.map((p) => ({
            Dirección: p.direccion,
            Servicio: p.servicio,
            Fecha: p.fecha,
            Regla: p.regla,
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Agendamientos");
          XLSX.writeFile(wb, "agendamientos_futuros.xlsx");
        });

        // initial
        attachModifyHandlers();
      },
    });
  };

  // ---------- Actualizar en Firebase y estado local ----------
  const updateFields = (id, updates) => {
    const dbRef = ref(database, `reprogramacionautomatica/${id}`);
    update(dbRef, { ...updates, updatedAt: Date.now() }).catch((error) =>
      console.error("Error actualizando en Firebase:", error)
    );
    setData((prev) =>
      prev
        .map(([itemId, item]) =>
          itemId === id ? [itemId, { ...item, ...updates }] : [itemId, item]
        )
        .sort(([, a], [, b]) =>
          (a.direccion || "").localeCompare(b.direccion || "")
        )
    );
  };

  // ---------- Clientes (para datalist de Dirección) ----------
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
      setLoadedClients(true);
    });
    return () => unsubscribe();
  }, []);

  const direccionOptions = Array.from(
    new Set(clients.map((c) => c.direccion).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const direccionFilterOptions = Array.from(
    new Set(data.map(([, item]) => item.direccion).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const servicioFilterOptions = Array.from(
    new Set(data.map(([, item]) => item.servicio).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const dayOptions = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];

  const diaFilterOptions = Array.from(
    new Set(
      data
        .flatMap(([, item]) => (Array.isArray(item.dia) ? item.dia : []))
        .filter(Boolean)
    )
  ).sort((a, b) => {
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
    const numA = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
    const numB = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
    return numA - numB;
  });

  // ---------- Filtro de tabla principal ----------
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

  // ---------- Auto-desactivar "solo una vez" vencidos ----------
  const checkAndDeactivateExecutedOnce = () => {
    const todayYmd = fmtYMD(new Date());
    data.forEach(([id, item]) => {
      if (item.solounavez && item.activo && item.fechaEjecucion) {
        if (item.fechaEjecucion <= todayYmd) {
          updateFields(id, { activo: false });
        }
      }
    });
  };

  const minExecDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 2); // pasado mañana
    return fmtYMD(d);
  })();

  useEffect(() => {
    if (loadedData && loadedClients) {
      setLoading(false);
      checkAndDeactivateExecutedOnce();
    }
  }, [loadedData, loadedClients]);

  // ---------- Alta (A) en un único modal con validaciones y grids ----------
  const showAddSwal = () => {
    let formData = {
      direccion: "",
      servicio: "",
      cubicos: "",
      rc: "",
      periodo: "",
      dia: [],
      semana: "",
      mes: "",
      solounavez: false,
      fechaEjecucion: null,
    };

    const formHtml = `
      <div class="swal-form">
        <div class="form-group">
          <label for="direccion">Dirección:</label>
          <input id="direccion" class="swal2-input" placeholder="Dirección" list="direcciones-list"/>
          <datalist id="direcciones-list">
            ${direccionOptions.map((dir) => `<option value="${dir}"/>`).join("")}
          </datalist>
        </div>

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
            <option value="Pool">Pool</option>
          </select>
        </div>

        <div class="form-group">
          <label for="cubicos">Cúbicos:</label>
          <input id="cubicos" type="number" class="swal2-input" placeholder="Cúbicos"/>
        </div>

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

        <div id="dia-container" class="form-group">
          <label>Día</label>
          <input type="checkbox" id="checkbox-dia"/>
        </div>

        <div id="semanal-container" class="form-group" style="display:none;">
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

        <div id="mes-container" class="form-group" style="display:none;">
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

        <div class="form-group">
          <label for="solounavez">Solo realizarse una vez:</label>
          <input type="checkbox" id="solounavez"/>
        </div>

        <div id="fecha-container" class="form-group" style="display:none;">
          <label for="fechaEjecucion">Fecha de ejecución:</label>
          <input id="fechaEjecucion" type="date" class="swal2-input"/>
        </div>
      </div>
    `;

    const formStyles = `
      <style>
        .swal2-html-container { overflow-x: hidden !important; }
        .swal-form { margin-top: 20px; }
        .form-group { display:flex; align-items:center; margin-bottom:15px; }
        .form-group label { width:50%; margin:0; font-weight:500; }
        .swal-form .swal2-input, .swal-form .swal2-select {
          width:50%; box-sizing:border-box; height:2.5em; padding:.5em .75em; font-size:1rem; margin:0; border:1px solid #ccc;
        }
        .swal-form input[type="checkbox"] { transform: scale(1.5); cursor:pointer; margin:0; }
        #semanal-container.form-group, #mes-container.form-group {
          flex-direction:column; align-items:flex-start;
        }
        #semanal-container label, #mes-container label { width:auto; margin-bottom:8px; }
        .dias-semana {
          display:grid; grid-template-columns: repeat(7, 1fr); gap:8px; width:100% !important; margin:0 0 10px;
        }
        .dias-mes-grid {
          display:grid; grid-template-columns: repeat(7, 1fr); gap:8px; justify-items:center; width:100% !important; margin:0;
        }
        .dia-checkbox, .dia-mes { display:flex; flex-direction:column; align-items:center; }
        .swal-form .swal2-input:disabled, .swal-form .swal2-select:disabled { cursor: not-allowed !important; }
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
        const rcInput = document.getElementById("repetirCada");
        const periodoEl = document.getElementById("tipoRepeticion");
        const solounavezCheckbox = document.getElementById("solounavez");
        const fechaContainer = document.getElementById("fecha-container");
        const diaCtr = document.getElementById("dia-container");
        const semCtr = document.getElementById("semanal-container");
        const mesCtr = document.getElementById("mes-container");
        const fechaInput = document.getElementById("fechaEjecucion");

        // mínimo: pasado mañana
        fechaInput.setAttribute("min", minExecDate);

        const updateContainers = () => {
          const once = solounavezCheckbox.checked;
          diaCtr.style.display = once ? "none" : sel.value === "dia" ? "block" : "none";
          semCtr.style.display = once ? "none" : sel.value === "semana" ? "block" : "none";
          mesCtr.style.display = once ? "none" : sel.value === "mes" ? "block" : "none";
        };

        sel.addEventListener("change", updateContainers);

        solounavezCheckbox.addEventListener("change", () => {
          const once = solounavezCheckbox.checked;
          fechaContainer.style.display = once ? "block" : "none";
          if (!once) fechaInput.value = "";

          if (once) {
            rcInput.value = "";
            periodoEl.value = "";
          }
          rcInput.disabled = once;
          periodoEl.disabled = once;
          rcInput.style.cursor = once ? "not-allowed" : "auto";
          periodoEl.style.cursor = once ? "not-allowed" : "auto";

          // desmarcar / deshabilitar todo
          const allBoxes = [
            ...diaCtr.querySelectorAll("input[type=checkbox]"),
            ...semCtr.querySelectorAll("input[type=checkbox]"),
            ...mesCtr.querySelectorAll("input[type=checkbox]"),
          ];
          allBoxes.forEach((cb) => {
            cb.checked = false;
            cb.disabled = once;
          });

          updateContainers();
        });

        updateContainers();
      },
      preConfirm: () => {
        const direccion = document.getElementById("direccion").value.trim();
        if (!direccion) {
          Swal.showValidationMessage("La dirección es obligatoria");
          return false;
        }

        const servicio = document.getElementById("servicio").value;
        const cubicos = document.getElementById("cubicos").value;
        const rcVal = document.getElementById("repetirCada").value;
        const solounavez = document.getElementById("solounavez").checked;
        const fechaEjecucion = document.getElementById("fechaEjecucion").value;

        if (solounavez && !fechaEjecucion) {
          Swal.showValidationMessage("Selecciona una fecha de ejecución");
          return false;
        }

        let periodo = document.getElementById("tipoRepeticion").value;
        let rc = parseInt(rcVal, 10);
        let dia = [], semana = "", mes = "";

        if (!solounavez) {
          if (!rc || rc < 1) {
            Swal.showValidationMessage('Ingresa un valor válido en "Repetir cada"');
            return false;
          }
          if (!periodo) {
            Swal.showValidationMessage("Selecciona una frecuencia");
            return false;
          }

          if (periodo === "dia") {
            if (!document.getElementById("checkbox-dia").checked) {
              Swal.showValidationMessage("Marca la casilla Día");
              return false;
            }
            dia = ["Cada día"];
          } else if (periodo === "semana") {
            const seleccion = [];
            dayOptions.forEach((day) => {
              if (document.getElementById(`dia-${day}`).checked) seleccion.push(day);
            });
            if (seleccion.length === 0) {
              Swal.showValidationMessage("Selecciona al menos un día de la semana");
              return false;
            }
            semana = `Cada ${rc} semana${rc > 1 ? "s" : ""}`;
            dia = seleccion;
          } else if (periodo === "mes") {
            const diasMes = [];
            for (let i = 1; i <= 31; i++) {
              if (document.getElementById(`dia-mes-${i}`).checked) diasMes.push(String(i));
            }
            if (diasMes.length === 0) {
              Swal.showValidationMessage("Selecciona al menos un día del mes");
              return false;
            }
            dia = diasMes;
            mes = `Cada ${rc} ${rc === 1 ? "Mes" : "Meses"}`;
          }
        } else {
          rc = null;
          periodo = "";
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
          solounavez,
          fechaEjecucion,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        const v = result.value;
        await addData(
          v.direccion,
          v.servicio,
          v.cubicos,
          v.rc,
          v.periodo,
          v.dia,
          v.semana,
          v.mes,
          v.solounavez,
          v.fechaEjecucion
        );
        await Swal.fire({
          title: "¡Guardado!",
          text: "El servicio ha sido programado correctamente",
          icon: "success",
          toast: true,
          position: "center-end",
          showConfirmButton: false,
          timer: 2500,
        });
      }
    });
  };

  // ---------- Alta en Firebase ----------
  const addData = async (
    direccion,
    servicio,
    cubicos,
    rc,
    periodo,
    dia,
    semana,
    mes,
    solounavez = false,
    fechaEjecucion = null,
    activo = true
  ) => {
    const dbRef = ref(database, "reprogramacionautomatica");
    const newRef = push(dbRef);
    const newData = {
      direccion,
      servicio,
      cubicos,
      rc: solounavez ? null : rc,
      periodo: solounavez ? "" : periodo,
      dia,
      semana,
      mes,
      solounavez,
      fechaEjecucion,
      activo,
      timestamp: Date.now(),
      exceptions: [],
      overrides: {},
      cutovers: [],
      updatedAt: Date.now(),
    };
    await set(newRef, newData);
  };

  // ---------- Cambios por celda ----------
  const handleFieldChange = (id, field, value) => {
    const safeValue = value === undefined ? "" : value;
    update(ref(database, `reprogramacionautomatica/${id}`), {
      [field]: safeValue,
      updatedAt: Date.now(),
    }).catch((error) => {
      console.error("Error updating data: ", error);
    });
    const updatedData = data
      .map(([itemId, item]) =>
        itemId === id ? [itemId, { ...item, [field]: safeValue }] : [itemId, item]
      )
      .sort(([, a], [, b]) =>
        (a.direccion || "").localeCompare(b.direccion || "")
      );
    setData(updatedData);
  };

  const deleteData = (id) => {
    const dbRef = ref(database, `reprogramacionautomatica/${id}`);
    remove(dbRef).catch((error) => {
      console.error("Error deleting data: ", error);
    });
    const updatedData = data
      .filter(([itemId]) => itemId !== id)
      .sort(([, a], [, b]) =>
        (a.direccion || "").localeCompare(b.direccion || "")
      );
    setData(updatedData);
  };

  // ---------- UI: Slidebars ----------
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
        <h2 style={{ color: "white" }}>Filtros</h2>
        <br />
        <hr />

        <label>Dirección</label>
        <input
          id="direccion-filter"
          type="text"
          list="direccion-filter-list"
          value={filters.direccion}
          onChange={(e) => setFilters({ ...filters, direccion: e.target.value })}
          placeholder="Todas"
          className="filter-input"
        />
        <datalist id="direccion-filter-list">
          <option value="" />
          {direccionFilterOptions.map((dir, i) => (
            <option key={i} value={dir} />
          ))}
        </datalist>

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

        <label>Día</label>
        <Select
          isClearable
          options={diaFilterOptions.map((day) => ({ value: day, label: day }))}
          value={filters.dia ? { value: filters.dia, label: filters.dia } : null}
          onChange={(opt) => setFilters({ ...filters, dia: opt ? opt.value : "" })}
          placeholder="Todos"
        />

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
          <h1 className="title-page">Reprogramación Automática</h1>
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
                <th>Servicio</th>
                <th>Cúbicos</th>
                <th>Repetir Cada</th>
                <th>Día</th>
                <th>Semana</th>
                <th>Mes</th>
                <th>Solo Una Vez</th>
                <th>Fecha de Ejecución</th>
                <th>Acciones</th>
                <th>Activar / Desactivar</th>
              </tr>
            </thead>
            <tbody>
              {filteredData && filteredData.length > 0 ? (
                filteredData.map(([id, item]) => (
                  <tr key={id}>
                    {/* Dirección */}
                    <td className="direccion-fixed-td">
                      <div className="custom-select-container">
                        <input
                          className="direccion-fixed-input"
                          type="text"
                          style={{ width: "18ch" }}
                          value={
                            localValues[`${id}_direccion`] ?? item.direccion ?? ""
                          }
                          list={`direccion-options-${id}`}
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${id}_direccion`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (item.direccion || "")) {
                              handleFieldChange(id, "direccion", e.target.value);
                            }
                          }}
                        />
                        <datalist id={`direccion-options-${id}`}>
                          {direccionOptions.map((dir, i) => (
                            <option key={i} value={dir} />
                          ))}
                        </datalist>
                      </div>
                    </td>

                    {/* Servicio */}
                    <td>
                      <select
                        value={item.servicio}
                        style={{ width: "22ch" }}
                        onChange={(e) => handleFieldChange(id, "servicio", e.target.value)}
                      >
                        <option value=""></option>
                        <option value="Poso">Poso</option>
                        <option value="Tuberia">Tuberia</option>
                        <option value="Poso + Tuberia">Poso + Tuberia</option>
                        <option value="Poso + Grease Trap">Poso + Grease Trap</option>
                        <option value="Tuberia + Grease Trap">Tuberia + Grease Trap</option>
                        <option value="Grease Trap">Grease Trap</option>
                        <option value="Water">Water</option>
                        <option value="Pool">Pool</option>
                      </select>
                    </td>

                    {/* Cúbicos */}
                    <td>
                      <input
                        type="number"
                        style={{ width: "12ch", textAlign: "center" }}
                        value={localValues[`${id}_cubicos`] ?? item.cubicos ?? ""}
                        onChange={(e) =>
                          setLocalValues((prev) => ({
                            ...prev,
                            [`${id}_cubicos`]: e.target.value,
                          }))
                        }
                        onBlur={(e) => {
                          if (e.target.value !== (item.cubicos || "")) {
                            handleFieldChange(id, "cubicos", e.target.value);
                          }
                        }}
                      />
                    </td>

                    {/* Repetir Cada */}
                    <td>
                      <input
                        type="number"
                        style={{ minWidth: "12ch", textAlign: "center" }}
                        value={
                          localValues[`${id}_rc`] ??
                          (item.solounavez ? "" : item.rc ?? "")
                        }
                        disabled={item.solounavez}
                        onChange={(e) =>
                          setLocalValues((prev) => ({
                            ...prev,
                            [`${id}_rc`]: e.target.value,
                          }))
                        }
                        onBlur={(e) => {
                          const rc = parseInt(e.target.value, 10) || 0;
                          const updates = { rc };
                          if (item.periodo === "mes") {
                            updates.mes = `Cada ${rc} ${rc === 1 ? "Mes" : "Meses"}`;
                          }
                          if (item.periodo === "semana") {
                            updates.semana = `Cada ${rc} semana${rc > 1 ? "s" : ""}`;
                          }
                          updateFields(id, updates);
                        }}
                      />
                    </td>

                    {/* Día (checkbox único) */}
                    <td>
                      <input
                        type="checkbox"
                        style={{ width: "3ch", height: "3ch", marginLeft: "25%" }}
                        checked={item.periodo === "dia"}
                        disabled={
                          item.solounavez ||
                          item.periodo === "semana" ||
                          item.periodo === "mes"
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateFields(id, {
                              periodo: "dia",
                              dia: ["Cada día"],
                              semana: "",
                              mes: "",
                            });
                          } else {
                            updateFields(id, {
                              periodo: "",
                              dia: [],
                              semana: "",
                              mes: "",
                            });
                          }
                        }}
                      />
                    </td>

                    {/* Semana (días de la semana) */}
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
                            <span className="small-text-mobile">
                              {day.substring(0, 1)}
                            </span>
                            <input
                              type="checkbox"
                              style={{ width: "3ch", height: "3ch" }}
                              checked={
                                item.periodo === "semana" && item.dia.includes(day)
                              }
                              disabled={
                                item.periodo === "dia" ||
                                item.periodo === "mes" ||
                                item.solounavez
                              }
                              onChange={(e) => {
                                const dias = e.target.checked
                                  ? [...item.dia, day]
                                  : item.dia.filter((d) => d !== day);
                                updateFields(id, {
                                  periodo: dias.length ? "semana" : "",
                                  dia: dias,
                                  semana: dias.length
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

                    {/* Mes (días del mes) */}
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
                        {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(
                          (day) => (
                            <label key={day} style={{ textAlign: "start" }}>
                              <input
                                style={{ width: "2.8ch", height: "2.8ch" }}
                                type="checkbox"
                                checked={
                                  item.periodo === "mes" && item.dia.includes(day)
                                }
                                disabled={
                                  item.periodo === "dia" ||
                                  item.periodo === "semana" ||
                                  item.solounavez
                                }
                                onChange={(e) => {
                                  const dias = e.target.checked
                                    ? [...item.dia, day]
                                    : item.dia.filter((d) => d !== day);
                                  updateFields(id, {
                                    periodo: dias.length ? "mes" : "",
                                    dia: dias,
                                    semana: "",
                                    mes: dias.length
                                      ? `Cada ${item.rc || 1} ${
                                          (item.rc || 1) === 1 ? "Mes" : "Meses"
                                        }`
                                      : "",
                                  });
                                }}
                              />
                              {day}
                            </label>
                          )
                        )}
                      </div>
                    </td>

                    {/* Solo Una Vez */}
                    <td>
                      <input
                        style={{ width: "3ch", height: "3ch", marginLeft: "40%" }}
                        type="checkbox"
                        checked={!!item.solounavez}
                        disabled={
                          item.periodo === "dia" ||
                          item.periodo === "semana" ||
                          item.periodo === "mes" ||
                          item.periodo === "rc"
                        }
                        onChange={(e) => {
                          const solo = e.target.checked;
                          updateFields(id, {
                            solounavez: solo,
                            ...(solo && {
                              periodo: "",
                              dia: [],
                              semana: "",
                              mes: "",
                              rc: null,
                            }),
                          });
                        }}
                      />
                    </td>

                    {/* Fecha de Ejecución */}
                    <td>
                      <input
                        type="date"
                        style={{ minWidth: "12ch" }}
                        value={item.fechaEjecucion || ""}
                        disabled={!item.solounavez}
                        min={minExecDate}
                        onChange={(e) =>
                          updateFields(id, { fechaEjecucion: e.target.value })
                        }
                      />
                    </td>

                    {/* Acciones */}
                    <td>
                      <button
                        className="delete-button"
                        onClick={() => {
                          Swal.fire({
                            title: "¿Borrar este servicio?",
                            html: `
                              <div>Esta acción no se puede deshacer.</div>
                              <div style="text-align: left; margin-top: 1em; padding: 8px; background-color: #f5f5f5; border-radius: 4px;">
                                <strong>Dirección:</strong> ${item.direccion || "N/A"}<br>
                                <strong>Servicio:</strong> ${item.servicio || "N/A"}
                              </div>
                            `,
                            icon: "warning",
                            showCancelButton: true,
                            confirmButtonText: "Sí, borrar",
                            cancelButtonText: "Cancelar",
                            confirmButtonColor: "#d33",
                            cancelButtonColor: "#3085d6",
                            position: "center",
                            backdrop: "rgba(0,0,0,0.4)",
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                            heightAuto: false,
                          }).then((res) => {
                            if (res.isConfirmed) {
                              deleteData(id);
                              Swal.fire({
                                title: "¡Borrado!",
                                text: "Registro eliminado.",
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

                    {/* Activar / Desactivar */}
                    <td>
                      <input
                        style={{ width: "3ch", height: "3ch", marginLeft: "40%" }}
                        type="checkbox"
                        checked={item.activo === true}
                        onChange={(e) => handleFieldChange(id, "activo", e.target.checked)}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="no-data">
                  <td colSpan="11">No hay datos disponibles.</td>
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
          alt="Agendamientos Futuros"
        />
      </button>

      <button className="create-table-button" onClick={showAddSwal}>
        +
      </button>
    </div>
  );
};

export default React.memo(Reprogramacionautomatica);
