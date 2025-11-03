import React, { useEffect, useMemo, useState, useRef } from "react";
import { ref, push, set, update, remove, onValue } from "firebase/database";
import { database } from "../Database/firebaseConfig.js";
import Swal from "sweetalert2";
import "./Reprogramacion.css";
import Slidebar from "./Slidebar.jsx";
import Clock from "./Clock.jsx";
import ExcelJS from "exceljs";
import excel_icon from "../assets/img/excel_icon.jpg";

// ===================== Utilidades de fecha =====================
const pad2 = (n) => String(n).padStart(2, "0");
const fmt = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parse = (s) => {
  const [y, m, d] = s.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
};
const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
};

const isBetween = (dateStr, startStr, endStr) => {
  const d = parse(dateStr).getTime();
  return d >= parse(startStr).getTime() && d <= parse(endStr).getTime();
};

// ===================== Recurrence engine (FREQ=DAILY/WEEKLY/MONTHLY) =====================
const WD = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function getWeekStart(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay()); // domingo como inicio de semana
  x.setHours(0, 0, 0, 0);
  return x;
}

function expandSeries(series, rangeStart, rangeEnd) {
  const exdates = series.exdates || {};
  const instances = series.instances || {};
  const base = new Set();

  const r = series.rrule;

  if (!r) {
    // Evento único
    if (
      isBetween(series.dtstart, rangeStart, rangeEnd) &&
      !exdates[series.dtstart]
    ) {
      base.add(series.dtstart);
    }
  } else if (r && r.freq === "DAILY") {
    const interval = Math.max(1, Number(r.interval || 1));
    const untilStr = r.until || rangeEnd; // acota

    // empieza en el máximo entre dtstart y rangeStart
    let current = parse(series.dtstart);
    const startBound = parse(rangeStart);
    if (current < startBound) {
      const diffDays = Math.floor((startBound - current) / (24 * 3600 * 1000));
      const steps = Math.ceil(diffDays / interval);
      current.setDate(current.getDate() + steps * interval);
    }

    const until = parse(untilStr);
    const endBound = parse(rangeEnd);
    const hardEnd = until < endBound ? until : endBound;

    while (current <= hardEnd) {
      const day = fmt(current);
      if (!exdates[day]) base.add(day);
      current.setDate(current.getDate() + interval);
    }
  } else if (r && r.freq === "WEEKLY") {
    const interval = Math.max(1, Number(r.interval || 1));
    const untilStr = r.until || rangeEnd;
    const until = parse(untilStr);
    const endBound = parse(rangeEnd);
    const hardEnd = until < endBound ? until : endBound;

    // Días de la semana: por defecto el de dtstart si no vienen
    let byday =
      Array.isArray(r.byday) && r.byday.length
        ? r.byday.map((s) => s.toUpperCase())
        : [WD[parse(series.dtstart).getDay()]];
    byday = byday.filter((d) => WD.includes(d));
    if (!byday.length) byday = [WD[parse(series.dtstart).getDay()]];

    const anchorWeekStart = getWeekStart(parse(series.dtstart));
    let loopWeekStart = getWeekStart(parse(rangeStart));
    if (loopWeekStart < anchorWeekStart)
      loopWeekStart = new Date(anchorWeekStart);

    const weekMs = 7 * 24 * 3600 * 1000;
    let weeksDiff = Math.floor((loopWeekStart - anchorWeekStart) / weekMs);
    let mod = ((weeksDiff % interval) + interval) % interval;
    if (mod !== 0)
      loopWeekStart = new Date(
        loopWeekStart.getTime() + (interval - mod) * weekMs
      );

    while (loopWeekStart <= hardEnd) {
      for (const token of byday) {
        const idx = WD.indexOf(token); // 0..6
        const d = new Date(loopWeekStart);
        d.setDate(d.getDate() + idx);
        if (d < parse(series.dtstart)) continue; // antes del inicio real
        if (d > hardEnd) continue;
        const dayStr = fmt(d);
        if (isBetween(dayStr, rangeStart, rangeEnd) && !exdates[dayStr]) {
          base.add(dayStr);
        }
      }
      loopWeekStart = new Date(loopWeekStart.getTime() + interval * weekMs);
    }
  } else if (r && r.freq === "LAST_WEEK_MONTHLY") {
    const interval = Math.max(1, Number(r.interval || 1));
    const untilStr = r.until || rangeEnd;
    const until = parse(untilStr);
    const endBound = parse(rangeEnd);
    const hardEnd = until < endBound ? until : endBound;

    // Días de la semana seleccionados
    let byday = Array.isArray(r.byday) && r.byday.length
      ? r.byday.map((s) => s.toUpperCase())
      : [WD[parse(series.dtstart).getDay()]];
    byday = byday.filter((d) => WD.includes(d));
    
    // Empezar desde el mes de la fecha inicial
    let currentDate = new Date(parse(series.dtstart));
    currentDate.setDate(1); // Ir al primer día del mes

    while (currentDate <= hardEnd) {
      // Obtener el último día del mes actual
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      // Ir al inicio de la última semana
      const lastWeekStart = new Date(lastDay);
      lastWeekStart.setDate(lastDay.getDate() - lastDay.getDay());

      // Procesar cada día seleccionado de la última semana
      for (const dayToken of byday) {
        const dayIndex = WD.indexOf(dayToken);
        const targetDate = new Date(lastWeekStart);
        targetDate.setDate(lastWeekStart.getDate() + dayIndex);

        // Si el día cae en el siguiente mes, retroceder una semana
        if (targetDate.getMonth() !== lastDay.getMonth()) {
          targetDate.setDate(targetDate.getDate() - 7);
        }

        // Verificar que esté dentro del rango y no sea una exclusión
        const dayStr = fmt(targetDate);
        if (targetDate >= parse(series.dtstart) && 
            targetDate <= hardEnd &&
            isBetween(dayStr, rangeStart, rangeEnd) && 
            !exdates[dayStr]) {
          base.add(dayStr);
        }
      }

      // Avanzar al siguiente mes según el intervalo
      currentDate.setMonth(currentDate.getMonth() + interval);
    }
  } else if (r && r.freq === "LAST_WEEK_MONTHLY") {
    const interval = Math.max(1, Number(r.interval || 1));
    const untilStr = r.until || rangeEnd;
    const until = parse(untilStr);
    const endBound = parse(rangeEnd);
    const hardEnd = until < endBound ? until : endBound;

    // Días de la semana seleccionados
    let byday = Array.isArray(r.byday) && r.byday.length
      ? r.byday.map((s) => s.toUpperCase())
      : [WD[parse(series.dtstart).getDay()]];
    byday = byday.filter((d) => WD.includes(d));
    
    // Empezar desde el mes de la fecha inicial
    let currentDate = new Date(parse(series.dtstart));
    currentDate.setDate(1); // Ir al primer día del mes

    while (currentDate <= hardEnd) {
      // Obtener el último día del mes actual
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      // Ir al inicio de la última semana
      const lastWeekStart = new Date(lastDay);
      lastWeekStart.setDate(lastDay.getDate() - lastDay.getDay());

      // Procesar cada día seleccionado de la última semana
      for (const dayToken of byday) {
        const dayIndex = WD.indexOf(dayToken);
        const targetDate = new Date(lastWeekStart);
        targetDate.setDate(lastWeekStart.getDate() + dayIndex);

        // Si el día cae en el siguiente mes, retroceder una semana
        if (targetDate.getMonth() !== lastDay.getMonth()) {
          targetDate.setDate(targetDate.getDate() - 7);
        }

        // Verificar que esté dentro del rango y no sea una exclusión
        const dayStr = fmt(targetDate);
        if (targetDate >= parse(series.dtstart) && 
            targetDate <= hardEnd &&
            isBetween(dayStr, rangeStart, rangeEnd) && 
            !exdates[dayStr]) {
          base.add(dayStr);
        }
      }

      // Avanzar al siguiente mes según el intervalo
      currentDate.setMonth(currentDate.getMonth() + interval);
    }
  } else if (r && r.freq === "MONTHLY") {
    const interval = Math.max(1, Number(r.interval || 1));
    const untilStr = r.until || rangeEnd;
    const until = parse(untilStr);
    const endBound = parse(rangeEnd);
    const hardEnd = until < endBound ? until : endBound;

    // Días del mes: puede ser un array o un solo número
    const startDate = parse(series.dtstart);
    let monthDays = r.bymonthday || startDate.getDate();

    // Asegurar que monthDays sea un array
    if (!Array.isArray(monthDays)) {
      monthDays = [monthDays];
    }

    // Comenzar desde dtstart
    let current = new Date(startDate);

    // Si estamos fuera del rango, avanzar al primer mes válido
    const startBound = parse(rangeStart);
    if (current < startBound) {
      // Calcular cuántos meses necesitamos avanzar
      const yearDiff = startBound.getFullYear() - current.getFullYear();
      const monthDiff = startBound.getMonth() - current.getMonth();
      const totalMonthDiff = yearDiff * 12 + monthDiff;
      const steps = Math.ceil(totalMonthDiff / interval);

      current.setMonth(current.getMonth() + steps * interval);
    }

    while (current <= hardEnd) {
      // Procesar cada día del mes especificado
      for (const dayOfMonth of monthDays) {
        // Ajustar al día específico del mes
        const targetDate = new Date(
          current.getFullYear(),
          current.getMonth(),
          dayOfMonth
        );

        // Si el día no existe en este mes (ej: 31 en febrero), usar el último día del mes
        if (targetDate.getMonth() !== current.getMonth()) {
          targetDate.setDate(0); // Va al último día del mes anterior
        }

        const dayStr = fmt(targetDate);
        if (isBetween(dayStr, rangeStart, rangeEnd) && !exdates[dayStr]) {
          base.add(dayStr);
        }
      }

      // Avanzar al siguiente intervalo de meses
      current.setMonth(current.getMonth() + interval);
    }
  }

  // Construye ocurrencias base con override de título si existe instancia en ese día
  const occs = [];
  for (const day of base) {
    const inst = instances[day];
    const title = inst && inst.title ? inst.title : series.title;
    occs.push({ date: day, title, seriesId: series.id, recurid: null });
  }

  // Instancias adicionales: solo agregamos si es un movimiento (tiene recurid) o si no existe en base (fecha agregada)
  for (const [instDate, inst] of Object.entries(instances)) {
    const isMove = !!inst.recurid && instDate !== inst.recurid;
    const notInBase = !base.has(instDate);
    if ((isMove || notInBase) && isBetween(instDate, rangeStart, rangeEnd)) {
      const title = inst.title || series.title;
      occs.push({
        date: instDate,
        title,
        seriesId: series.id,
        recurid: null,
      });
    }
  }

  occs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return occs;
}

// ===================== Helper para determinar tipo de evento =====================
function getEventTypeLabel(series) {
  if (!series || !series.rrule) {
    return "Evento único";
  }

  const freq = series.rrule.freq;
  switch (freq) {
    case "DAILY":
      return "Evento diario";
    case "WEEKLY":
      return "Evento semanal";
    case "MONTHLY":
      return "Evento mensual";
    case "LAST_WEEK_MONTHLY":
      return "Evento última semana mensual";
    default:
      return "Evento recurrente";
  }
}

// ===================== RTDB helpers ===================== =====================
const seriesPath = `/reprogramacion`;

async function rtdbCreateSeries(data) {
  const now = Date.now();
  const newRef = push(ref(database, seriesPath));
  const payload = {
    title: data.title,
    dtstart: data.dtstart,
    rrule: data.rrule || null,
    exdates: data.exdates || null,
    instances: data.instances || null,
    direccion: data.direccion || "",
    anombrede: data.anombrede || "",
    servicio: data.servicio || "",
    cubicos: data.cubicos || "",
    valor: data.valor || "",
    notas: data.notas || "",
    createdAt: now,
    updatedAt: now,
  };
  await set(newRef, payload);
}

async function rtdbUpdateSeries(id, partial) {
  partial.updatedAt = Date.now();
  await update(ref(database, `${seriesPath}/${id}`), partial);
}

// ===================== UI principal =====================
const Reprogramacion = () => {
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const tableContainerRef = useRef(null);
  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);
  
  // Estados para la funcionalidad de búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
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
  const today = useMemo(() => fmt(new Date()), []);
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d; // primer día del mes visible
  });

  // Estado para clientes
  const [clientes, setClientes] = useState({});

  const [seriesMap, setSeriesMap] = useState({}); // id -> serie

  // Estados de carga
  const [loading, setLoading] = useState(true);
  const [loadedSeries, setLoadedSeries] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);

  // Suscripción a RTDB de todas las series de este calendario
  useEffect(() => {
    const off = onValue(ref(database, seriesPath), (snap) => {
      const val = snap.val() || {};
      const mapped = {};
      Object.entries(val).forEach(([id, s]) => {
        mapped[id] = { id, ...s };
      });
      setSeriesMap(mapped);
      setLoadedSeries(true);
    });
    return () => off();
  }, []);

  // Cargar clientes desde Firebase
  useEffect(() => {
    const clientesRef = ref(database, "clientes");
    const off = onValue(clientesRef, (snap) => {
      const val = snap.val() || {};
      setClientes(val);
      setLoadedClients(true);
    });
    return () => off();
  }, []);

  // Rango visible del mes (incluye días de la cuadrícula)
  const monthStart = useMemo(() => fmt(monthAnchor), [monthAnchor]);
  const monthEnd = useMemo(() => {
    const d = new Date(
      monthAnchor.getFullYear(),
      monthAnchor.getMonth() + 1,
      0
    );
    return fmt(d);
  }, [monthAnchor]);

  // Para mostrar solo días del mes actual (empezando desde el día 1)
  const gridStart = useMemo(() => {
    return fmt(monthAnchor); // Primer día del mes
  }, [monthAnchor]);
  const gridEnd = useMemo(() => {
    const d = new Date(
      monthAnchor.getFullYear(),
      monthAnchor.getMonth() + 1,
      0
    ); // Último día del mes
    return fmt(d);
  }, [monthAnchor]);

  // Expandir ocurrencias en el rango visible
  const occurrencesByDay = useMemo(() => {
    const byDay = {};
    for (const s of Object.values(seriesMap)) {
      const occs = expandSeries(s, gridStart, gridEnd);
      for (const o of occs) {
        if (!byDay[o.date]) byDay[o.date] = [];
        byDay[o.date].push(o);
      }
    }
    // Ordena dentro del día por título para estabilidad
    Object.values(byDay).forEach((arr) =>
      arr.sort((a, b) => a.title.localeCompare(b.title))
    );
    return byDay;
  }, [seriesMap, gridStart, gridEnd]);

  // Obtener todos los títulos únicos para el datalist
  const uniqueTitles = useMemo(() => {
    const titles = new Set();
    Object.values(seriesMap).forEach((series) => {
      if (series.title) titles.add(series.title);
      if (series.servicio) titles.add(series.servicio);
    });
    return Array.from(titles).sort();
  }, [seriesMap]);

  // Estado para el término de búsqueda activo (separado del input)
  const [activeSearchQuery, setActiveSearchQuery] = useState("");

  // Filtrar las ocurrencias basado en la búsqueda
  const filteredOccurrencesByDay = useMemo(() => {
    if (!isSearchActive || !activeSearchQuery.trim()) {
      return occurrencesByDay;
    }

    const queryLower = activeSearchQuery.toLowerCase().trim();
    const filtered = {};

    Object.entries(occurrencesByDay).forEach(([date, events]) => {
      const matchingEvents = events.filter((event) => {
        const series = seriesMap[event.seriesId];
        if (!series) return false;

        // Buscar solo en título y servicio
        const searchFields = [
          event.title,
          series.servicio,
        ].filter(Boolean);

        return searchFields.some((field) =>
          field.toLowerCase().includes(queryLower)
        );
      });

      // Solo incluir días que tienen eventos que coinciden con la búsqueda
      if (matchingEvents.length > 0) {
        filtered[date] = matchingEvents;
      }
    });

    return filtered;
  }, [occurrencesByDay, activeSearchQuery, isSearchActive, seriesMap]);

  // Función para manejar la búsqueda
  const handleSearch = () => {
    if (searchQuery.trim()) {
      setActiveSearchQuery(searchQuery);
      setIsSearchActive(true);
    }
  };

  // Función para limpiar la búsqueda
  const handleClearSearch = () => {
    setSearchQuery("");
    setActiveSearchQuery("");
    setIsSearchActive(false);
  };

  // Función para manejar Enter en el input de búsqueda
  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Control de estado de carga - cuando todo esté cargado, ocultar loading
  useEffect(() => {
    if (loadedSeries && loadedClients) {
      // Agregar un pequeño delay para que se vea la pantalla de carga
      const timer = setTimeout(() => {
        setLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loadedSeries, loadedClients]);

  // Auto-scroll animado hasta el día de hoy (solo después de que la carga termine)
  useEffect(() => {
    // Solo ejecutar el scroll si ya no está cargando
    if (loading) return;
    console.log("Auto-scroll useEffect ejecutándose...");
    const cont = tableContainerRef.current;
    console.log("Contenedor:", cont);
    if (!cont) {
      console.log("No hay contenedor, saliendo...");
      return;
    }

    const currentMonth = monthAnchor;
    const todayDate = new Date();
    const sameMonth =
      currentMonth.getFullYear() === todayDate.getFullYear() &&
      currentMonth.getMonth() === todayDate.getMonth();

    console.log(
      "Mes actual:",
      currentMonth,
      "Hoy:",
      todayDate,
      "Mismo mes:",
      sameMonth
    );
    if (!sameMonth) {
      console.log("No es el mismo mes, saliendo...");
      return;
    }

    // Usar setTimeout para asegurar que el DOM esté completamente renderizado
    const timeoutId = setTimeout(() => {
      const todayElement = cont.querySelector(".calendar-day-number.today");
      console.log("Elemento de hoy encontrado:", todayElement);
      if (!todayElement) {
        console.log("No se encontró elemento .calendar-day-number.today");
        return;
      }

      const todayCell = todayElement.closest(".calendar-day-cell");
      console.log("Celda de hoy encontrada:", todayCell);
      if (!todayCell) {
        console.log("No se encontró .calendar-day-cell padre");
        return;
      }

      const margin = 100;
      const targetTop = todayCell.offsetTop - margin;
      console.log(
        "Posición objetivo:",
        targetTop,
        "offsetTop:",
        todayCell.offsetTop
      );

      cont.scrollTop = 0;
      const duration = 700;
      const start = performance.now();
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        cont.scrollTop = targetTop * easeOutCubic(p);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      console.log("Animación de scroll iniciada");
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      console.log("Limpiando auto-scroll useEffect");
    };
  }, [loading, monthAnchor, Object.keys(filteredOccurrencesByDay).length]);

  // ===================== Acciones =====================
  async function createEvent(initialDate = today) {
    // Paso 1: Seleccionar tipo de evento con diseño profesional
    const { value: eventType } = await Swal.fire({
      title: "🎯 Crear Nuevo Evento",
      html: `
        <div style="text-align: left; padding: 20px 0;">
          <p style="color: #4a5568; margin-bottom: 20px; font-size: 16px;">
            Selecciona el tipo de evento que deseas crear:
          </p>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <label style="display: flex; align-items: center; padding: 16px; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1a73e8'; this.style.backgroundColor='#f7faff'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='white'">
              <input type="radio" name="eventType" value="single" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #1a202c; font-size: 16px;">📅 Evento Único</div>
                <div style="color: #718096; font-size: 14px; margin-top: 4px;">Un evento que ocurre solo una vez</div>
              </div>
            </label>
            <label style="display: flex; align-items: center; padding: 16px; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1a73e8'; this.style.backgroundColor='#f7faff'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='white'">
              <input type="radio" name="eventType" value="daily" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #1a202c; font-size: 16px;">🔄 Evento Diario</div>
                <div style="color: #718096; font-size: 14px; margin-top: 4px;">Se repite cada cierto número de días</div>
              </div>
            </label>
            <label style="display: flex; align-items: center; padding: 16px; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1a73e8'; this.style.backgroundColor='#f7faff'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='white'">
              <input type="radio" name="eventType" value="weekly" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #1a202c; font-size: 16px;">📅 Evento Semanal</div>
                <div style="color: #718096; font-size: 14px; margin-top: 4px;">Se repite ciertos días de la semana</div>
              </div>
            </label>
            <label style="display: flex; align-items: center; padding: 16px; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1a73e8'; this.style.backgroundColor='#f7faff'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='white'">
              <input type="radio" name="eventType" value="monthly" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #1a202c; font-size: 16px;">🗓️ Evento Mensual</div>
                <div style="color: #718096; font-size: 14px; margin-top: 4px;">Se repite cada cierto número de meses</div>
              </div>
            </label>

            <label style="display: flex; align-items: center; padding: 16px; border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1a73e8'; this.style.backgroundColor='#f7faff'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='white'">
              <input type="radio" name="eventType" value="last_week_monthly" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #1a202c; font-size: 16px;">📅 Última Semana Mensual</div>
                <div style="color: #718096; font-size: 14px; margin-top: 4px;">Se repite en días específicos de la última semana de cada mes</div>
              </div>
            </label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "✨ Continuar",
      cancelButtonText: "❌ Cancelar",
      customClass: {
        popup: "swal2-professional-popup",
        confirmButton: "swal2-professional-confirm",
        cancelButton: "swal2-professional-cancel",
      },
      preConfirm: () => {
        const selected = document.querySelector(
          'input[name="eventType"]:checked'
        );
        if (!selected) {
          Swal.showValidationMessage("Por favor selecciona un tipo de evento");
          return false;
        }
        return selected.value;
      },
    });
    if (!eventType) return;

    // Paso 2: Información básica del evento con diseño profesional
    const { value: formValues } = await Swal.fire({
      title: `📋 Información del ${
        eventType === "single" ? "Evento" : "Evento Recurrente"
      }`,
      html: `
        <div style="max-width: 500px; margin: 0 auto; padding: 20px 0;">
          <div class="swal-form-group">
            <label class="swal-form-label">
              📅 Fecha ${eventType === "single" ? "del evento" : "inicial"}
            </label>
            <input id="swal-date" type="date" class="swal2-input" value="${initialDate}">
          </div>
          
          <div class="swal-form-group">
            <label class="swal-form-label">
              🏠 Dirección del servicio
            </label>
            <input id="swal-direccion" class="swal2-input" placeholder="Selecciona o escribe la dirección" list="direcciones-list" autocomplete="off">
            <datalist id="direcciones-list">
              ${Object.entries(clientes)
                .map(
                  ([id, cliente]) =>
                    `<option value="${
                      cliente.direccion || ""
                    }" data-cliente-id="${id}">${
                      cliente.direccion || ""
                    }</option>`
                )
                .join("")}
            </datalist>
            <div class="swal-form-help">💡 Selecciona de la lista para auto-completar los demás campos</div>
          </div>
          
          <div class="swal-form-group">
            <label class="swal-form-label">
              👤 A nombre de
            </label>
            <input id="swal-anombrede" class="swal2-input" placeholder="Nombre del cliente">
            <div class="swal-form-help">Se completará automáticamente al seleccionar dirección</div>
          </div>
          
          <div class="swal-form-group">
            <label class="swal-form-label">
              📄 Título del evento
            </label>
            <input id="swal-title" class="swal2-input" placeholder="Se generará automáticamente o ingresa uno personalizado">
            <div class="swal-form-help">✨ Se genera automáticamente: "Cliente - Dirección" o puedes escribir uno personalizado</div>
          </div>
          
          <div class="swal-form-group">
            <label class="swal-form-label">
              🛠️ Servicio
            </label>
            <select id="swal-servicio" class="swal2-input" style="width: 100%; height: auto;">
              <option value="">Selecciona un servicio</option>
              <option value="Poso">Poso</option>
              <option value="Tuberia">Tuberia</option>
              <option value="Poso + Tuberia">Poso + Tuberia</option>
              <option value="Poso + Grease Trap">Poso + Grease Trap</option>
              <option value="Tuberia + Grease Trap">Tuberia + Grease Trap</option>
              <option value="Grease Trap">Grease Trap</option>
              <option value="Water">Water</option>
              <option value="Pool">Pool</option>
            </select>
            <div class="swal-form-help">Selecciona el tipo de servicio a realizar</div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="swal-form-group">
              <label class="swal-form-label">
                📦 Cúbicos
              </label>
              <input id="swal-cubicos" type="number" class="swal2-input" placeholder="0" min="0" step="0.1">
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                💰 Valor (AWG)
              </label>
              <input id="swal-valor" type="number" class="swal2-input" placeholder="0.00" min="0" step="0.01">
            </div>
          </div>

          <div class="swal-form-group">
            <label class="swal-form-label">
              📝 Notas
            </label>
            <textarea 
              id="swal-notas" 
              class="swal2-textarea" 
              placeholder="Añade notas adicionales sobre el servicio..." 
              style="
                min-width: 80%;
                min-height: 60px; 
                padding: 12px; 
                border: 2px solid #e2e8f0;
                border-radius: 8px; 
                margin-top: 4px;
                font-size: 14px;
                line-height: 1.5;
                resize: vertical;
                transition: all 0.3s ease;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                background: linear-gradient(to bottom, #ffffff, #fafafa);
              "
              onFocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
              onBlur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.05)'"
            ></textarea>
            <div class="swal-form-help" style="color: #64748b; font-size: 12px; margin-top: 6px;">💡 Información adicional relevante para el servicio</div>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "🚀 Continuar",
      cancelButtonText: "❌ Cancelar",
      width: "600px",
      customClass: {
        popup: "swal2-professional-popup",
        confirmButton: "swal2-professional-confirm",
        cancelButton: "swal2-professional-cancel",
      },
      didOpen: () => {
        // Auto-rellenar campos cuando se selecciona una dirección
        const direccionInput = document.getElementById("swal-direccion");
        const anombredeInput = document.getElementById("swal-anombrede");
        const cubicosInput = document.getElementById("swal-cubicos");
        const valorInput = document.getElementById("swal-valor");
        const titleInput = document.getElementById("swal-title");

        const updateTitle = () => {
          const anombrede = anombredeInput.value.trim();
          const direccion = direccionInput.value.trim();
          if (anombrede && direccion) {
            titleInput.value = `${anombrede} - ${direccion}`;
          } else if (anombrede) {
            titleInput.value = anombrede;
          } else if (direccion) {
            titleInput.value = direccion;
          } else {
            titleInput.value = "";
          }
        };

        direccionInput.addEventListener("input", (e) => {
          const selectedAddress = e.target.value;
          const cliente = Object.values(clientes).find(
            (c) => c.direccion === selectedAddress
          );
          if (cliente) {
            anombredeInput.value = cliente.anombrede || "";
            cubicosInput.value = cliente.cubicos || "";
            valorInput.value = cliente.valor || "";
          }
          updateTitle();
        });

        anombredeInput.addEventListener("input", updateTitle);
      },
      preConfirm: () => {
        const title = document.getElementById("swal-title").value;
        const date = document.getElementById("swal-date").value;
        const direccion = document.getElementById("swal-direccion").value;
        const anombrede = document.getElementById("swal-anombrede").value;
        const servicio = document.getElementById("swal-servicio").value;
        const cubicos = document.getElementById("swal-cubicos").value;
        const valor = document.getElementById("swal-valor").value;
        const notas = document.getElementById("swal-notas").value;

        // Si no hay título generado, crear uno básico
        const finalTitle =
          title.trim() || direccion.trim() || anombrede.trim() || "Evento";

        return {
          title: finalTitle,
          date: date || new Date().toISOString().split("T")[0],
          direccion,
          anombrede,
          servicio,
          cubicos,
          valor,
          notas,
        };
      },
    });

    if (!formValues) return;

    // Paso 3: Configuración específica según el tipo de evento
    let rrule = null;

    if (eventType === "daily") {
      const { value: dailyConfig } = await Swal.fire({
        title: "🔄 Configuración de Repetición Diaria",
        html: `
          <div style="max-width: 400px; margin: 0 auto; padding: 20px 0;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; color: white; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 8px;">📅</div>
              <div style="font-size: 18px; font-weight: 600;">Evento Recurrente Diario</div>
              <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Se repetirá automáticamente</div>
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                ⏱️ Intervalo de repetición
              </label>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="color: #4a5568; font-weight: 500;">Cada</span>
                <input id="swal-interval" type="number" class="swal2-input" value="1" min="1" max="365" style="width: 80px; text-align: center; margin: 0;">
                <span style="color: #4a5568; font-weight: 500;">días</span>
              </div>
              <div class="swal-form-help">💡 Por ejemplo: 1 = diario, 7 = semanal, 15 = quincenal</div>
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                🏁 Fecha de finalización (opcional)
              </label>
              <input id="swal-until" type="date" class="swal2-input">
              <div class="swal-form-help">🔄 Deja vacío para que se repita indefinidamente</div>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "✨ Crear Evento Recurrente",
        cancelButtonText: "⬅️ Volver",
        width: "500px",
        customClass: {
          popup: "swal2-professional-popup",
          confirmButton: "swal2-professional-confirm",
          cancelButton: "swal2-professional-cancel",
        },
        preConfirm: () => {
          const interval =
            parseInt(document.getElementById("swal-interval").value) || 1;
          const until = document.getElementById("swal-until").value;

          if (interval < 1) {
            Swal.showValidationMessage("El intervalo debe ser al menos 1 día");
            return false;
          }

          return { interval, until };
        },
      });

      if (!dailyConfig) return;

      rrule = { freq: "DAILY", interval: Math.max(1, dailyConfig.interval) };
      if (dailyConfig.until && /^\d{4}-\d{2}-\d{2}$/.test(dailyConfig.until)) {
        rrule.until = dailyConfig.until;
      }
    } else if (eventType === "weekly") {
      const { value: weeklyConfig } = await Swal.fire({
        title: "📅 Configuración de Repetición Semanal",
        html: `
          <div style="max-width: 500px; margin: 0 auto; padding: 20px 0;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; color: white; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 8px;">📅</div>
              <div style="font-size: 18px; font-weight: 600;">Evento Recurrente Semanal</div>
              <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Selecciona los días específicos</div>
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                📋 Días de la semana
              </label>
              <div style="display: flex; gap: 8px; justify-content: center; margin: 16px 0; padding: 12px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border: 1px solid #dee2e6;">
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'" onchange="this.style.borderColor = this.querySelector('input').checked ? '#1a73e8' : 'transparent'">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">DO</span>
                  <input type="checkbox" value="SU" style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'" onchange="this.style.borderColor = this.querySelector('input').checked ? '#1a73e8' : 'transparent'">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">LU</span>
                  <input type="checkbox" value="MO" style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'" onchange="this.style.borderColor = this.querySelector('input').checked ? '#1a73e8' : 'transparent'">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MA</span>
                  <input type="checkbox" value="TU" style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'" onchange="this.style.borderColor = this.querySelector('input').checked ? '#1a73e8' : 'transparent'">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MI</span>
                  <input type="checkbox" value="WE" style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'" onchange="this.style.borderColor = this.querySelector('input').checked ? '#1a73e8' : 'transparent'">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">JU</span>
                  <input type="checkbox" value="TH" style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'" onchange="this.style.borderColor = this.querySelector('input').checked ? '#1a73e8' : 'transparent'">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">VI</span>
                  <input type="checkbox" value="FR" style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'" onchange="this.style.borderColor = this.querySelector('input').checked ? '#1a73e8' : 'transparent'">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">SA</span>
                  <input type="checkbox" value="SA" style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
                </label>
              </div>
              <div class="swal-form-help">💡 Si no seleccionas ningún día, usará el día de la fecha inicial</div>
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                ⏱️ Intervalo de repetición
              </label>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="color: #4a5568; font-weight: 500;">Cada</span>
                <input id="swal-interval" type="number" class="swal2-input" value="1" min="1" max="52" style="width: 80px; text-align: center; margin: 0;">
                <span style="color: #4a5568; font-weight: 500;">semanas</span>
              </div>
              <div class="swal-form-help">📅 Por ejemplo: 1 = cada semana, 2 = cada dos semanas</div>
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                🏁 Fecha de finalización (opcional)
              </label>
              <input id="swal-until" type="date" class="swal2-input">
              <div class="swal-form-help">🔄 Deja vacío para que se repita indefinidamente</div>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "✨ Crear Evento Recurrente",
        cancelButtonText: "⬅️ Volver",
        width: "600px",
        customClass: {
          popup: "swal2-professional-popup",
          confirmButton: "swal2-professional-confirm",
          cancelButton: "swal2-professional-cancel",
        },
        preConfirm: () => {
          const selectedDays = Array.from(
            document.querySelectorAll('input[type="checkbox"]:checked')
          ).map((cb) => cb.value);
          const interval =
            parseInt(document.getElementById("swal-interval").value) || 1;
          const until = document.getElementById("swal-until").value;

          if (interval < 1) {
            Swal.showValidationMessage(
              "El intervalo debe ser al menos 1 semana"
            );
            return false;
          }

          return { days: selectedDays, interval, until };
        },
      });

      if (!weeklyConfig) return;

      let byday = weeklyConfig.days || [];
      const wd = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      byday = byday.filter((d) => wd.includes(d));

      rrule = { freq: "WEEKLY", interval: Math.max(1, weeklyConfig.interval) };
      if (byday.length) rrule.byday = byday;
      if (
        weeklyConfig.until &&
        /^\d{4}-\d{2}-\d{2}$/.test(weeklyConfig.until)
      ) {
        rrule.until = weeklyConfig.until;
      }
    } else if (eventType === "monthly") {
      const { value: monthlyConfig } = await Swal.fire({
        title: "🗓️ Configuración de Repetición Mensual",
        html: `
          <style>
            .swal2-html-container { overflow-x: hidden !important; }
            .swal-form { margin-top: 20px; }
            .form-group { display:flex; align-items:center; margin-bottom:15px; }
            .form-group label { width:50%; margin:0; font-weight:500; }
            .swal-form .swal2-input, .swal-form .swal2-select {
              width:50%; box-sizing:border-box; height:2.5em; padding:.5em .75em; font-size:1rem; margin:0; border:1px solid #ccc;
            }
            .swal-form input[type="checkbox"] { transform: scale(1.5); cursor:pointer; margin:0; }
            #mes-container.form-group {
              flex-direction:column; align-items:flex-start;
            }
            #mes-container label { width:auto; margin-bottom:8px; }
            .dias-mes-grid {
              display: grid; 
              grid-template-columns: repeat(7, 1fr); 
              gap: 10px; 
              justify-items: center; 
              width: 100% !important; 
              margin: 15px 0;
              padding: 15px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              backdrop-filter: blur(10px);
            }
            .dia-mes { 
              display: flex; 
              flex-direction: column-reverse; 
              align-items: center; 
              position: relative;
              cursor: pointer;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              padding: 8px;
              border-radius: 10px;
              min-height: 50px;
              justify-content: center;
            }
            .dia-mes:hover {
              transform: translateY(-2px);
              background: rgba(26, 115, 232, 0.15);
              box-shadow: 0 8px 25px rgba(26, 115, 232, 0.2);
            }
            .dia-mes label {
              font-size: 13px !important;
              font-weight: 700 !important;
              color: #1a202c !important;
              margin: 0 !important;
              cursor: pointer !important;
              transition: all 0.2s ease !important;
              text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
              user-select: none;
            }
            .dia-mes input[type="checkbox"] {
              appearance: none !important;
              width: 20px !important;
              height: 20px !important;
              border: 2px solid #e2e8f0 !important;
              border-radius: 6px !important;
              background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
              cursor: pointer !important;
              position: relative !important;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
              margin-top: 6px !important;
            }
            .dia-mes input[type="checkbox"]:hover {
              border-color: #1a73e8 !important;
              box-shadow: 0 4px 12px rgba(26, 115, 232, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
              transform: scale(1.05) !important;
            }
            .dia-mes input[type="checkbox"]:checked {
              background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%) !important;
              border-color: #1a73e8 !important;
              box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
            }
            .dia-mes input[type="checkbox"]:checked::after {
              content: "✓" !important;
              position: absolute !important;
              top: 50% !important;
              left: 50% !important;
              transform: translate(-50%, -50%) !important;
              color: white !important;
              font-size: 12px !important;
              font-weight: bold !important;
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
            }
            .dia-mes:has(input:checked) label {
              color: #1a73e8 !important;
              font-weight: 800 !important;
              text-shadow: 0 1px 2px rgba(26, 115, 232, 0.2) !important;
            }
          </style>
          <div style="max-width: 500px; margin: 0 auto; padding: 20px 0;">
            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; color: white; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 8px;">🗓️</div>
              <div style="font-size: 18px; font-weight: 600;">Evento Recurrente Mensual</div>
              <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Se repetirá cada mes en los días especificados</div>
            </div>
            
            <div id="mes-container" class="form-group">
              <label>Selecciona días del mes:</label>
              <div class="dias-mes-grid">
                ${Array.from({ length: 31 }, (_, i) => i + 1)
                  .map(
                    (day) => `
                  <div class="dia-mes">
                    <input type="checkbox" id="dia-mes-${day}" value="${day}" ${
                      day === new Date(formValues.date).getDate()
                        ? "checked"
                        : ""
                    }/>
                    <label for="dia-mes-${day}">${day}</label>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                ⏱️ Intervalo de repetición
              </label>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="color: #4a5568; font-weight: 500;">Cada</span>
                <input id="swal-interval" type="number" class="swal2-input" value="1" min="1" max="12" style="width: 80px; text-align: center; margin: 0;">
                <span style="color: #4a5568; font-weight: 500;">meses</span>
              </div>
              <div class="swal-form-help">🗓️ Por ejemplo: 1 = mensual, 2 = bimensual, 3 = trimestral</div>
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                🏁 Fecha de finalización (opcional)
              </label>
              <input id="swal-until" type="date" class="swal2-input">
              <div class="swal-form-help">🔄 Deja vacío para que se repita indefinidamente</div>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "✨ Crear Evento Recurrente",
        cancelButtonText: "⬅️ Volver",
        width: "600px",
        customClass: {
          popup: "swal2-professional-popup",
          confirmButton: "swal2-professional-confirm",
          cancelButton: "swal2-professional-cancel",
        },
        preConfirm: () => {
          const selectedDays = [];
          for (let day = 1; day <= 31; day++) {
            const checkbox = document.getElementById(`dia-mes-${day}`);
            if (checkbox && checkbox.checked) {
              selectedDays.push(day);
            }
          }

          const interval =
            parseInt(document.getElementById("swal-interval").value) || 1;
          const until = document.getElementById("swal-until").value;

          if (selectedDays.length === 0) {
            Swal.showValidationMessage(
              "Por favor selecciona al menos un día del mes"
            );
            return false;
          }

          if (interval < 1) {
            Swal.showValidationMessage("El intervalo debe ser al menos 1 mes");
            return false;
          }

          return { monthDays: selectedDays, interval, until };
        },
      });

      if (!monthlyConfig) return;

      rrule = {
        freq: "MONTHLY",
        interval: Math.max(1, monthlyConfig.interval),
        bymonthday: monthlyConfig.monthDays,
      };
      if (
        monthlyConfig.until &&
        /^\d{4}-\d{2}-\d{2}$/.test(monthlyConfig.until)
      ) {
        rrule.until = monthlyConfig.until;
      }
    } else if (eventType === "last_week_monthly") {
      const { value: weeklyConfig } = await Swal.fire({
        title: "📅 Configuración de Última Semana Mensual",
        html: `
          <div style="max-width: 500px; margin: 0 auto; padding: 20px 0;">
            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; color: white; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 8px;">📅</div>
              <div style="font-size: 18px; font-weight: 600;">Evento Última Semana Mensual</div>
              <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Se repetirá en los días seleccionados de la última semana de cada mes</div>
            </div>
            
            <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border: 1px solid #dee2e6;">
              <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #374151;">
                📅 Días de la semana
              </label>
              <div style="display: flex; gap: 8px; justify-content: center;">
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">DO</span>
                  <input type="checkbox" value="SU" style="width: 18px; height: 18px; cursor: pointer;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">LU</span>
                  <input type="checkbox" value="MO" style="width: 18px; height: 18px; cursor: pointer;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MA</span>
                  <input type="checkbox" value="TU" style="width: 18px; height: 18px; cursor: pointer;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MI</span>
                  <input type="checkbox" value="WE" style="width: 18px; height: 18px; cursor: pointer;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">JU</span>
                  <input type="checkbox" value="TH" style="width: 18px; height: 18px; cursor: pointer;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">VI</span>
                  <input type="checkbox" value="FR" style="width: 18px; height: 18px; cursor: pointer;">
                </label>
                <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                  <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">SA</span>
                  <input type="checkbox" value="SA" style="width: 18px; height: 18px; cursor: pointer;">
                </label>
              </div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 8px; text-align: center;">
                💡 Selecciona los días de la última semana del mes en los que se repetirá el evento
              </div>
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                ⏱️ Intervalo de repetición
              </label>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="color: #4a5568; font-weight: 500;">Cada</span>
                <input id="swal-interval" type="number" class="swal2-input" value="1" min="1" max="12" style="width: 80px; text-align: center; margin: 0;">
                <span style="color: #4a5568; font-weight: 500;">meses</span>
              </div>
              <div class="swal-form-help">🗓️ Por ejemplo: 1 = mensual, 2 = bimensual, 3 = trimestral</div>
            </div>
            
            <div class="swal-form-group">
              <label class="swal-form-label">
                🏁 Fecha de finalización (opcional)
              </label>
              <input id="swal-until" type="date" class="swal2-input">
              <div class="swal-form-help">🔄 Deja vacío para que se repita indefinidamente</div>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "✨ Crear Evento Recurrente",
        cancelButtonText: "⬅️ Volver",
        width: "600px",
        customClass: {
          popup: "swal2-professional-popup",
          confirmButton: "swal2-professional-confirm",
          cancelButton: "swal2-professional-cancel",
        },
        preConfirm: () => {
          const selectedDays = Array.from(
            document.querySelectorAll('input[type="checkbox"]:checked')
          ).map((cb) => cb.value);
          const interval = parseInt(document.getElementById("swal-interval").value) || 1;
          const until = document.getElementById("swal-until").value;

          if (selectedDays.length === 0) {
            Swal.showValidationMessage("Por favor selecciona al menos un día de la semana");
            return false;
          }

          if (interval < 1) {
            Swal.showValidationMessage("El intervalo debe ser al menos 1 mes");
            return false;
          }

          return { days: selectedDays, interval, until };
        },
      });

      if (!weeklyConfig) return;

      rrule = { 
        freq: "LAST_WEEK_MONTHLY", 
        interval: Math.max(1, weeklyConfig.interval),
        byday: weeklyConfig.days
      };
      
      if (weeklyConfig.until && /^\d{4}-\d{2}-\d{2}$/.test(weeklyConfig.until)) {
        rrule.until = weeklyConfig.until;
      }
    }

    // Crear el evento
    await rtdbCreateSeries({
      title: formValues.title,
      dtstart: formValues.date,
      direccion: formValues.direccion,
      anombrede: formValues.anombrede,
      servicio: formValues.servicio,
      cubicos: formValues.cubicos,
      valor: formValues.valor,
      notas: formValues.notas,
      rrule,
    });

    // Mensaje de éxito profesional
    const eventTypeText =
      eventType === "single"
        ? "único"
        : eventType === "daily"
        ? "recurrente diario"
        : eventType === "weekly"
        ? "recurrente semanal"
        : "recurrente mensual";

    await Swal.fire({
      icon: "success",
      title: "🎉 ¡Evento creado exitosamente!",
      html: `
        <div style="text-align: center; padding: 20px 0;">
          <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">✅</div>
            <div style="font-size: 18px; font-weight: 600;">Evento ${eventTypeText} creado</div>
          </div>
          
          <div style="text-align: left; background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <div style="font-weight: 600; color: #1a202c; margin-bottom: 8px;">📋 Detalles del evento:</div>
            <div style="margin: 4px 0;"><strong>📄 Título:</strong> ${
              formValues.title
            }</div>
            <div style="margin: 4px 0;"><strong>📅 Fecha:</strong> ${
              formValues.date
            }</div>
            ${
              formValues.direccion
                ? `<div style="margin: 4px 0;"><strong>🏠 Dirección:</strong> ${formValues.direccion}</div>`
                : ""
            }
            ${
              formValues.anombrede
                ? `<div style="margin: 4px 0;"><strong>👤 Cliente:</strong> ${formValues.anombrede}</div>`
                : ""
            }
            ${
              formValues.cubicos
                ? `<div style="margin: 4px 0;"><strong>📦 Cúbicos:</strong> ${formValues.cubicos}</div>`
                : ""
            }
            ${
              formValues.valor
                ? `<div style="margin: 4px 0;"><strong>💰 Valor:</strong> $${formValues.valor}</div>`
                : ""
            }
          </div>
          
          <div style="color: #4a5568; font-size: 14px;">
            ${
              eventType !== "single"
                ? "🔄 El evento se repetirá automáticamente según la configuración establecida"
                : ""
            }
          </div>
        </div>
      `,
      confirmButtonText: "🎯 ¡Perfecto!",
      customClass: {
        popup: "swal2-professional-popup",
        confirmButton: "swal2-professional-confirm",
      },
      width: "500px",
    });
  }

  // Funciones auxiliares para eliminar eventos
  async function deleteSingleEvent(o) {
    const seriesRef = ref(database, `/reprogramacion/${o.seriesId}`);
    const s = seriesMap[o.seriesId];

    if (s?.rrule) {
      // Es evento recurrente, agregar a exdates
      const exdatesRef = ref(
        database,
        `/reprogramacion/${o.seriesId}/exdates/${o.date}`
      );
      await set(exdatesRef, true);
    } else {
      // Es evento único, eliminar toda la serie
      await remove(seriesRef);
    }
  }

  async function deleteEntireSeries(seriesId) {
    // Obtener la serie que queremos eliminar
    const targetSeries = seriesMap[seriesId];
    if (!targetSeries) return;

    // Función helper para comparar tipos de recurrencia
    const isSameRecurrenceType = (series1, series2) => {
      // Si ambas no tienen rrule (eventos únicos)
      if (!series1.rrule && !series2.rrule) return true;

      // Si una tiene rrule y la otra no
      if (!series1.rrule || !series2.rrule) return false;

      // Comparar el tipo de frecuencia
      return series1.rrule.freq === series2.rrule.freq;
    };

    // Buscar todas las series que puedan estar relacionadas
    // (mismos datos básicos + mismo tipo de recurrencia)
    const seriesToDelete = [];

    Object.values(seriesMap).forEach((series) => {
      if (
        series.title === targetSeries.title &&
        series.direccion === targetSeries.direccion &&
        series.anombrede === targetSeries.anombrede &&
        series.servicio === targetSeries.servicio &&
        isSameRecurrenceType(series, targetSeries)
      ) {
        seriesToDelete.push(series.id);
      }
    });

    // Eliminar todas las series relacionadas del mismo tipo
    const deletePromises = seriesToDelete.map((id) => {
      const seriesRef = ref(database, `/reprogramacion/${id}`);
      return remove(seriesRef);
    });

    await Promise.all(deletePromises);
  }

  // Función para eliminar eventos con SweetAlert
  async function handleDeleteEvent(o) {
    const s = seriesMap[o.seriesId];
    const isRecurring = s?.rrule;

    const { value: choice } = await Swal.fire({
      title: "🗑️ Eliminar Evento",
      html: `
        <div style="text-align: left; padding: 30px 40px; max-width: 550px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px; border-radius: 16px; color: white; margin-bottom: 30px; text-align: center; box-shadow: 0 8px 32px rgba(239, 68, 68, 0.3);">
            <div style="font-size: 1.3rem; font-weight: 700; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${
              o.title
            }</div>
            <div style="font-size: 15px; opacity: 0.95; margin-bottom: 4px;">📅 ${
              o.date
            }</div>
            ${
              isRecurring
                ? `<div style="font-size: 13px; opacity: 0.85; margin-top: 8px; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-block;">🔄 ${getEventTypeLabel(
                    s
                  )}</div>`
                : '<div style="font-size: 13px; opacity: 0.85; margin-top: 8px; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-block;">📅 Evento único</div>'
            }
          </div>
          
          <div style="display: grid; gap: 16px; padding: 0 8px;">
            <label style="display: flex; align-items: center; padding: 18px 20px; border: 2px solid #fed7d7; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);" onmouseover="this.style.borderColor='#e53e3e'; this.style.backgroundColor='#fef5f5'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'" onmouseout="this.style.borderColor='#fed7d7'; this.style.backgroundColor='#ffffff'; this.style.transform='translateY(0px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'">
              <input type="radio" name="deleteChoice" value="single" style="margin-right: 16px; transform: scale(1.3); cursor: pointer; accent-color: #e53e3e;">
              <div style="flex: 1;">
                <div style="font-weight: 600; color: #e53e3e; font-size: 16px; margin-bottom: 4px;">🗑️ Eliminar solo este evento</div>
                <div style="color: #6b7280; font-size: 14px; line-height: 1.4;">Elimina únicamente esta ocurrencia del ${
                  o.date
                }</div>
              </div>
            </label>
            
            ${
              isRecurring
                ? `
            <label style="display: flex; align-items: center; padding: 18px 20px; border: 2px solid #fed7d7; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);" onmouseover="this.style.borderColor='#e53e3e'; this.style.backgroundColor='#fef5f5'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'" onmouseout="this.style.borderColor='#fed7d7'; this.style.backgroundColor='#ffffff'; this.style.transform='translateY(0px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'">
              <input type="radio" name="deleteChoice" value="series" style="margin-right: 16px; transform: scale(1.3); cursor: pointer; accent-color: #e53e3e;">
              <div style="flex: 1;">
                <div style="font-weight: 600; color: #e53e3e; font-size: 16px; margin-bottom: 4px;">💥 Eliminar toda la serie</div>
                <div style="color: #6b7280; font-size: 14px; line-height: 1.4;">Elimina todos los eventos de la serie recurrente</div>
              </div>
            </label>
            `
                : ""
            }
          </div>
          
          <div style="margin-top: 24px; padding: 16px 20px; background: #fef3cd; border: 1px solid #f59e0b; border-radius: 12px; text-align: center;">
            <div style="color: #92400e; font-size: 14px; font-weight: 500;">
              ⚠️ Esta acción no se puede deshacer
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "🗑️ Eliminar",
      cancelButtonText: "❌ Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      width: "650px",
      padding: "20px",
      customClass: {
        popup: "swal2-popup-custom",
        title: "swal2-title-custom",
        htmlContainer: "swal2-html-custom",
        confirmButton: "swal2-professional-confirm",
        cancelButton: "swal2-professional-cancel",
      },
      preConfirm: () => {
        const selected = document.querySelector(
          'input[name="deleteChoice"]:checked'
        );
        if (!selected) {
          Swal.showValidationMessage("Por favor selecciona una opción");
          return false;
        }
        return selected.value;
      },
    });

    if (choice) {
      try {
        if (choice === "single") {
          await deleteSingleEvent(o);
        } else if (choice === "series") {
          await deleteEntireSeries(o.seriesId);
        }

        await Swal.fire({
          title: "✅ Eliminado",
          text:
            choice === "single"
              ? "Evento eliminado correctamente"
              : "Serie eliminada correctamente",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: "swal2-popup-custom",
          },
        });
      } catch (error) {
        console.error("Error al eliminar:", error);
        await Swal.fire({
          title: "❌ Error",
          text: "Hubo un problema al eliminar el evento",
          icon: "error",
          customClass: {
            popup: "swal2-popup-custom",
          },
        });
      }
    }
  }

  // Función principal para manejar edición de eventos
  async function handleEditEvent(o) {
    const s = seriesMap[o.seriesId];
    const isRecurring = s?.rrule;

    const { value: choice } = await Swal.fire({
      title: "✏️ Editar Evento",
      html: `
        <div style="text-align: left; padding: 20px 30px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 25px; text-align: center; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
            <div style="font-size: 1.3rem; font-weight: 700; margin-bottom: 6px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${
              o.title
            }</div>
            <div style="font-size: 15px; opacity: 0.95; margin-bottom: 4px;">📅 ${
              o.date
            }</div>
            ${
              isRecurring
                ? `<div style="font-size: 13px; opacity: 0.9; margin-top: 8px; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-block;">🔄 ${getEventTypeLabel(
                    s
                  )}</div>`
                : '<div style="font-size: 13px; opacity: 0.9; margin-top: 8px; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-block;">📅 Evento único</div>'
            }
          </div>
          
          <div style="display: grid; gap: 16px; padding: 0 10px;">
            <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1a73e8'; this.style.backgroundColor='#f7faff'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='white'">
              <input type="radio" name="editChoice" value="1" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #1a202c;">✏️ Editar solo este evento</div>
                <div style="color: #718096; font-size: 14px;">Modifica únicamente esta ocurrencia</div>
              </div>
            </label>
            
            ${
              isRecurring
                ? `
            <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1a73e8'; this.style.backgroundColor='#f7faff'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='white'">
              <input type="radio" name="editChoice" value="2" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #1a202c;">📅 Editar este y los siguientes</div>
                <div style="color: #718096; font-size: 14px;">Modifica desde este evento en adelante</div>
              </div>
            </label>
            
            <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1a73e8'; this.style.backgroundColor='#f7faff'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='white'">
              <input type="radio" name="editChoice" value="3" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #1a202c;">🔄 Editar toda la serie</div>
                <div style="color: #718096; font-size: 14px;">Modifica todos los eventos de la serie</div>
              </div>
            </label>
            `
                : ""
            }
            
            <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #bee3f8; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#3182ce'; this.style.backgroundColor='#ebf8ff'" onmouseout="this.style.borderColor='#bee3f8'; this.style.backgroundColor='white'">
              <input type="radio" name="editChoice" value="6" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #3182ce;">📅 Posponer 1 día</div>
                <div style="color: #718096; font-size: 14px;">Mueve este evento al día siguiente</div>
              </div>
            </label>
            
            <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #bee3f8; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#3182ce'; this.style.backgroundColor='#ebf8ff'" onmouseout="this.style.borderColor='#bee3f8'; this.style.backgroundColor='white'">
              <input type="radio" name="editChoice" value="7" style="margin-right: 12px; transform: scale(1.2); cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #3182ce;">📅 Posponer 1 semana</div>
                <div style="color: #718096; font-size: 14px;">Mueve este evento a la próxima semana</div>
              </div>
            </label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Continuar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#1a73e8",
      cancelButtonColor: "#6b7280",
      customClass: {
        popup: "swal2-popup-custom",
        title: "swal2-title-custom",
        htmlContainer: "swal2-html-custom",
      },
      preConfirm: () => {
        const selected = document.querySelector(
          'input[name="editChoice"]:checked'
        );
        if (!selected) {
          Swal.showValidationMessage("Por favor selecciona una opción");
          return false;
        }
        return selected.value;
      },
    });

    if (choice) {
      await handleEditChoice(o, choice);
    }
  }

  async function handleEditChoice(o, choice) {
    const s = seriesMap[o.seriesId];

    switch (choice) {
      case "1": // Editar solo este evento
        await editSingleEvent(o);
        break;
      case "2": // Editar este y los siguientes
        await editFromThisEvent(o);
        break;
      case "3": // Editar toda la serie
        await editEntireSeries(o);
        break;
      case "6": // Posponer 1 día
        await postponeEvent(o, 1);
        break;
      case "7": // Posponer 1 semana
        await postponeEvent(o, 7);
        break;
      case "last_week_monthly": // Evento última semana mensual
        if (s.rrule && s.rrule.freq === "LAST_WEEK_MONTHLY") {
          const { value: weeklyConfig } = await Swal.fire({
            title: "📅 Configuración de Última Semana Mensual",
            html: `
              <div style="max-width: 500px; margin: 0 auto; padding: 20px 0;">
                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; color: white; text-align: center;">
                  <div style="font-size: 2rem; margin-bottom: 8px;">📅</div>
                  <div style="font-size: 18px; font-weight: 600;">Evento Última Semana Mensual</div>
                  <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Se repetirá en los días seleccionados de la última semana de cada mes</div>
                </div>
                
                <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border: 1px solid #dee2e6;">
                  <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #374151;">
                    📅 Días de la semana
                  </label>
                  <div style="display: flex; gap: 8px; justify-content: center;">
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">DO</span>
                      <input type="checkbox" value="SU" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">LU</span>
                      <input type="checkbox" value="MO" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MA</span>
                      <input type="checkbox" value="TU" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MI</span>
                      <input type="checkbox" value="WE" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">JU</span>
                      <input type="checkbox" value="TH" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">VI</span>
                      <input type="checkbox" value="FR" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">SA</span>
                      <input type="checkbox" value="SA" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                  </div>
                  <div style="font-size: 12px; color: #6b7280; margin-top: 8px; text-align: center;">
                    💡 Selecciona los días de la última semana del mes en los que se repetirá el evento
                  </div>
                </div>
                
                <div class="swal-form-group">
                  <label class="swal-form-label">
                    ⏱️ Intervalo de repetición
                  </label>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="color: #4a5568; font-weight: 500;">Cada</span>
                    <input id="swal-interval" type="number" class="swal2-input" value="${s.rrule.interval || 1}" min="1" max="12" style="width: 80px; text-align: center; margin: 0;">
                    <span style="color: #4a5568; font-weight: 500;">meses</span>
                  </div>
                  <div class="swal-form-help">🗓️ Por ejemplo: 1 = mensual, 2 = bimensual, 3 = trimestral</div>
                </div>
                
                <div class="swal-form-group">
                  <label class="swal-form-label">
                    🏁 Fecha de finalización (opcional)
                  </label>
                  <input id="swal-until" type="date" class="swal2-input" value="${s.rrule.until || ''}">
                  <div class="swal-form-help">🔄 Deja vacío para que se repita indefinidamente</div>
                </div>
              </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "✨ Actualizar Evento Recurrente",
            cancelButtonText: "⬅️ Volver",
            width: "600px",
            customClass: {
              popup: "swal2-professional-popup",
              confirmButton: "swal2-professional-confirm",
              cancelButton: "swal2-professional-cancel",
            },
            preConfirm: () => {
              const selectedDays = Array.from(
                document.querySelectorAll('input[type="checkbox"]:checked')
              ).map((cb) => cb.value);
              const interval = parseInt(document.getElementById("swal-interval").value) || 1;
              const until = document.getElementById("swal-until").value;

              if (selectedDays.length === 0) {
                Swal.showValidationMessage("Por favor selecciona al menos un día de la semana");
                return false;
              }

              if (interval < 1) {
                Swal.showValidationMessage("El intervalo debe ser al menos 1 mes");
                return false;
              }

              return { days: selectedDays, interval, until };
            },
          });

          if (weeklyConfig) {
            const updatedRrule = { 
              ...s.rrule,
              interval: Math.max(1, weeklyConfig.interval),
              byday: weeklyConfig.days
            };
            
            if (weeklyConfig.until && /^\d{4}-\d{2}-\d{2}$/.test(weeklyConfig.until)) {
              updatedRrule.until = weeklyConfig.until;
            } else {
              delete updatedRrule.until;
            }
            
            await rtdbUpdateSeries(o.seriesId, {
              ...s,
              rrule: updatedRrule
            });
          }
        }
        break;
      case "last_week_monthly": // Evento última semana mensual
        const eventTypeVar = choice;
        if (eventTypeVar === "last_week_monthly") {
          const { value: weeklyConfig } = await Swal.fire({
            title: "📅 Configuración de Última Semana Mensual",
            html: `
              <div style="max-width: 500px; margin: 0 auto; padding: 20px 0;">
                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; color: white; text-align: center;">
                  <div style="font-size: 2rem; margin-bottom: 8px;">📅</div>
                  <div style="font-size: 18px; font-weight: 600;">Evento Última Semana Mensual</div>
                  <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Se repetirá en los días seleccionados de la última semana de cada mes</div>
                </div>
                
                <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border: 1px solid #dee2e6;">
                  <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #374151;">
                    📅 Días de la semana
                  </label>
                  <div style="display: flex; gap: 8px; justify-content: center;">
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">DO</span>
                      <input type="checkbox" value="SU" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">LU</span>
                      <input type="checkbox" value="MO" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MA</span>
                      <input type="checkbox" value="TU" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MI</span>
                      <input type="checkbox" value="WE" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">JU</span>
                      <input type="checkbox" value="TH" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">VI</span>
                      <input type="checkbox" value="FR" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer;">
                      <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">SA</span>
                      <input type="checkbox" value="SA" style="width: 18px; height: 18px; cursor: pointer;">
                    </label>
                  </div>
                  <div style="font-size: 12px; color: #6b7280; margin-top: 8px; text-align: center;">
                    💡 Selecciona los días de la última semana del mes en los que se repetirá el evento
                  </div>
                </div>
                
                <div class="swal-form-group">
                  <label class="swal-form-label">
                    ⏱️ Intervalo de repetición
                  </label>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="color: #4a5568; font-weight: 500;">Cada</span>
                    <input id="swal-interval" type="number" class="swal2-input" value="1" min="1" max="12" style="width: 80px; text-align: center; margin: 0;">
                    <span style="color: #4a5568; font-weight: 500;">meses</span>
                  </div>
                  <div class="swal-form-help">🗓️ Por ejemplo: 1 = mensual, 2 = bimensual, 3 = trimestral</div>
                </div>
                
                <div class="swal-form-group">
                  <label class="swal-form-label">
                    🏁 Fecha de finalización (opcional)
                  </label>
                  <input id="swal-until" type="date" class="swal2-input">
                  <div class="swal-form-help">🔄 Deja vacío para que se repita indefinidamente</div>
                </div>
              </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "✨ Crear Evento Recurrente",
            cancelButtonText: "⬅️ Volver",
            width: "600px",
            customClass: {
              popup: "swal2-professional-popup",
              confirmButton: "swal2-professional-confirm",
              cancelButton: "swal2-professional-cancel",
            },
            preConfirm: () => {
              const selectedDays = Array.from(
                document.querySelectorAll('input[type="checkbox"]:checked')
              ).map((cb) => cb.value);
              const interval = parseInt(document.getElementById("swal-interval").value) || 1;
              const until = document.getElementById("swal-until").value;

              if (selectedDays.length === 0) {
                Swal.showValidationMessage("Por favor selecciona al menos un día de la semana");
                return false;
              }

              if (interval < 1) {
                Swal.showValidationMessage("El intervalo debe ser al menos 1 mes");
                return false;
              }

              return { days: selectedDays, interval, until };
            },
          });

          if (weeklyConfig) {
            const rrule = { 
              freq: "LAST_WEEK_MONTHLY", 
              interval: Math.max(1, weeklyConfig.interval),
              byday: weeklyConfig.days
            };
            
            if (weeklyConfig.until && /^\d{4}-\d{2}-\d{2}$/.test(weeklyConfig.until)) {
              rrule.until = weeklyConfig.until;
            }
            
            // Crear el evento con la configuración
            await rtdbCreateSeries({
              title: s.title,
              dtstart: s.dtstart,
              direccion: s.direccion || "",
              anombrede: s.anombrede || "",
              servicio: s.servicio || "",
              cubicos: s.cubicos || "",
              valor: s.valor || "",
              rrule
            });
          }
        }
        break;
    }
  }

  async function editSingleEvent(o) {
    // Editar evento único
    await editEvent(o, "single");
  }

  async function editFromThisEvent(o) {
    // Editar desde este evento
    await editEvent(o, "fromThis");
  }

  async function editEntireSeries(o) {
    // Editar toda la serie
    await editEvent(o, "entire");
  }

  async function editEvent(o, editType) {
    const s = seriesMap[o.seriesId];
    if (!s) return;

    // Mostrar información actual del evento en el formulario de edición
    const { value: formValues } = await Swal.fire({
      title: `✏️ Editar Evento - ${
        editType === "single"
          ? "Solo este evento"
          : editType === "fromThis"
          ? "Este y siguientes"
          : "Toda la serie"
      }`,
      html: `
        <style>
          .dias-mes-grid {
            display: grid !important;
            grid-template-columns: repeat(7, 1fr) !important;
            gap: 10px !important;
            justify-items: center !important;
            width: 100% !important;
            margin: 15px 0 !important;
            padding: 15px !important;
            background: rgba(248, 250, 252, 0.8) !important;
            border-radius: 12px !important;
            backdrop-filter: blur(10px) !important;
            border: 1px solid rgba(226, 232, 240, 0.6) !important;
          }
          .dia-mes { 
            display: flex !important;
            flex-direction: column-reverse !important;
            align-items: center !important;
            position: relative !important;
            cursor: pointer !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            padding: 8px !important;
            border-radius: 10px !important;
            min-height: 50px !important;
            justify-content: center !important;
          }
          .dia-mes:hover {
            transform: translateY(-2px) !important;
            background: rgba(26, 115, 232, 0.15) !important;
            box-shadow: 0 8px 25px rgba(26, 115, 232, 0.2) !important;
          }
          .dia-mes label {
            font-size: 13px !important;
            font-weight: 700 !important;
            color: #1a202c !important;
            margin: 0 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8) !important;
            user-select: none !important;
          }
          .monthly-day-checkbox {
            appearance: none !important;
            width: 20px !important;
            height: 20px !important;
            border: 2px solid #e2e8f0 !important;
            border-radius: 6px !important;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
            cursor: pointer !important;
            position: relative !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
            margin-top: 6px !important;
          }
          .monthly-day-checkbox:hover {
            border-color: #1a73e8 !important;
            box-shadow: 0 4px 12px rgba(26, 115, 232, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
            transform: scale(1.05) !important;
          }
          .monthly-day-checkbox:checked {
            background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%) !important;
            border-color: #1a73e8 !important;
            box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
          }
          .monthly-day-checkbox:checked::after {
            content: "✓" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            color: white !important;
            font-size: 12px !important;
            font-weight: bold !important;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
          }
          .dia-mes:has(.monthly-day-checkbox:checked) label {
            color: #1a73e8 !important;
            font-weight: 800 !important;
            text-shadow: 0 1px 2px rgba(26, 115, 232, 0.2) !important;
          }
        </style>
        <div style="max-width: 500px; margin: 0 auto; padding: 20px 0;">
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
              📅 Fecha del evento
            </label>
            <input id="swal-date" type="date" class="swal2-input" value="${
              o.date
            }" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
              🏠 Dirección del servicio
            </label>
            <input id="swal-direccion" class="swal2-input" placeholder="Selecciona o escribe la dirección" list="direcciones-list" autocomplete="off" value="${
              s.direccion || ""
            }" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
            <datalist id="direcciones-list">
              ${Object.entries(clientes)
                .map(
                  ([id, cliente]) =>
                    `<option value="${
                      cliente.direccion || ""
                    }" data-cliente-id="${id}">${
                      cliente.direccion || ""
                    }</option>`
                )
                .join("")}
            </datalist>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">💡 Selecciona de la lista para auto-completar los demás campos</div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
              👤 A nombre de
            </label>
            <input id="swal-anombrede" class="swal2-input" placeholder="Nombre del cliente" value="${
              s.anombrede || ""
            }" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Se completará automáticamente al seleccionar dirección</div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
              📄 Título del evento
            </label>
            <input id="swal-title" class="swal2-input" placeholder="Título del evento" value="${
              s.title || ""
            }" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">✨ Se puede generar automáticamente: "Cliente - Dirección"</div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
              🛠️ Servicio
            </label>
            <select id="swal-servicio" class="swal2-input" style="width: 100%; height: auto; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
              <option value="">Selecciona un servicio</option>
              <option value="Poso" ${
                (s.servicio || "") === "Poso" ? "selected" : ""
              }>Poso</option>
              <option value="Tuberia" ${
                (s.servicio || "") === "Tuberia" ? "selected" : ""
              }>Tuberia</option>
              <option value="Poso + Tuberia" ${
                (s.servicio || "") === "Poso + Tuberia" ? "selected" : ""
              }>Poso + Tuberia</option>
              <option value="Poso + Grease Trap" ${
                (s.servicio || "") === "Poso + Grease Trap" ? "selected" : ""
              }>Poso + Grease Trap</option>
              <option value="Tuberia + Grease Trap" ${
                (s.servicio || "") === "Tuberia + Grease Trap" ? "selected" : ""
              }>Tuberia + Grease Trap</option>
              <option value="Grease Trap" ${
                (s.servicio || "") === "Grease Trap" ? "selected" : ""
              }>Grease Trap</option>
              <option value="Water" ${
                (s.servicio || "") === "Water" ? "selected" : ""
              }>Water</option>
              <option value="Pool" ${
                (s.servicio || "") === "Pool" ? "selected" : ""
              }>Pool</option>
            </select>
          </div>
          
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                📦 Cúbicos
              </label>
              <input id="swal-cubicos" type="number" class="swal2-input" placeholder="0" min="0" step="0.1" value="${
                s.cubicos || ""
              }" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                💰 Valor (AWG)
              </label>
              <input id="swal-valor" type="number" class="swal2-input" placeholder="0.00" min="0" step="0.01" value="${
                s.valor || ""
              }" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
              📝 Notas
            </label>
            <textarea 
              id="swal-notas" 
              class="swal2-textarea" 
              placeholder="Añade notas adicionales sobre el servicio..." 
              style="
                width: 100%; 
                min-height: 80px; 
                padding: 12px; 
                border: 2px solid #e2e8f0;
                border-radius: 8px; 
                margin-top: 4px;
                font-size: 14px;
                line-height: 1.5;
                resize: vertical;
                transition: all 0.3s ease;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                background: linear-gradient(to bottom, #ffffff, #fafafa);
              "
              onFocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
              onBlur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.05)'"
            >${s.notas || ""}</textarea>
            <div style="
              font-size: 12px; 
              color: #64748b; 
              margin-top: 6px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span style="color: #3b82f6">💡</span> 
              Información adicional relevante para el servicio
            </div>
          </div>          ${
            s.rrule && s.rrule.freq === "WEEKLY"
              ? `
          <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border: 1px solid #dee2e6;">
            <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #374151;">
              📅 Días de la semana
            </label>
            <div style="display: flex; gap: 8px; justify-content: center;">
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">DO</span>
                <input type="checkbox" value="SU" ${
                  s.rrule.byday && s.rrule.byday.includes("SU") ? "checked" : ""
                } style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">LU</span>
                <input type="checkbox" value="MO" ${
                  s.rrule.byday && s.rrule.byday.includes("MO") ? "checked" : ""
                } style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MA</span>
                <input type="checkbox" value="TU" ${
                  s.rrule.byday && s.rrule.byday.includes("TU") ? "checked" : ""
                } style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">MI</span>
                <input type="checkbox" value="WE" ${
                  s.rrule.byday && s.rrule.byday.includes("WE") ? "checked" : ""
                } style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">JU</span>
                <input type="checkbox" value="TH" ${
                  s.rrule.byday && s.rrule.byday.includes("TH") ? "checked" : ""
                } style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">VI</span>
                <input type="checkbox" value="FR" ${
                  s.rrule.byday && s.rrule.byday.includes("FR") ? "checked" : ""
                } style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; min-width: 40px;" onmouseover="this.style.backgroundColor='rgba(26,115,232,0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                <span style="font-size: 12px; font-weight: 600; color: #495057; margin-bottom: 6px;">SA</span>
                <input type="checkbox" value="SA" ${
                  s.rrule.byday && s.rrule.byday.includes("SA") ? "checked" : ""
                } style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a73e8;">
              </label>
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 8px; text-align: center;">💡 Selecciona los días en los que se debe repetir el evento</div>
          </div>
          `
              : ""
          }
          
          ${
            s.rrule && s.rrule.freq === "MONTHLY"
              ? `
          <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border: 1px solid #dee2e6;">
            <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #374151;">
              🗓️ Días del mes
            </label>
            <div class="dias-mes-grid">
              ${Array.from({ length: 31 }, (_, i) => i + 1)
                .map((day) => {
                  const isChecked = Array.isArray(s.rrule.bymonthday)
                    ? s.rrule.bymonthday.includes(day)
                    : s.rrule.bymonthday === day;
                  return `
                  <div class="dia-mes">
                    <input type="checkbox" id="edit-dia-mes-${day}" value="${day}" ${
                    isChecked ? "checked" : ""
                  } class="monthly-day-checkbox"/>
                    <label for="edit-dia-mes-${day}">${day}</label>
                  </div>
                `;
                })
                .join("")}
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 8px; text-align: center;">💡 Selecciona los días del mes en los que se debe repetir el evento</div>
          </div>
          `
              : ""
          }
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "💾 Guardar Cambios",
      cancelButtonText: "❌ Cancelar",
      width: "600px",
      customClass: {
        popup: "swal2-professional-popup",
        confirmButton: "swal2-professional-confirm",
        cancelButton: "swal2-professional-cancel",
      },
      didOpen: () => {
        // Auto-rellenar campos cuando se selecciona una dirección
        const direccionInput = document.getElementById("swal-direccion");
        const anombredeInput = document.getElementById("swal-anombrede");
        const cubicosInput = document.getElementById("swal-cubicos");
        const valorInput = document.getElementById("swal-valor");
        const titleInput = document.getElementById("swal-title");

        const updateTitle = () => {
          const anombrede = anombredeInput.value.trim();
          const direccion = direccionInput.value.trim();
          if (anombrede && direccion) {
            titleInput.value = `${anombrede} - ${direccion}`;
          } else if (anombrede) {
            titleInput.value = anombrede;
          } else if (direccion) {
            titleInput.value = direccion;
          }
        };

        direccionInput.addEventListener("input", (e) => {
          const selectedAddress = e.target.value;
          const cliente = Object.values(clientes).find(
            (c) => c.direccion === selectedAddress
          );
          if (cliente) {
            anombredeInput.value = cliente.anombrede || "";
            cubicosInput.value = cliente.cubicos || "";
            valorInput.value = cliente.valor || "";
            updateTitle();
          }
        });

        anombredeInput.addEventListener("input", updateTitle);
      },
      preConfirm: () => {
        const title = document.getElementById("swal-title").value;
        const date = document.getElementById("swal-date").value;
        const direccion = document.getElementById("swal-direccion").value;
        const anombrede = document.getElementById("swal-anombrede").value;
        const servicio = document.getElementById("swal-servicio").value;
        const cubicos = document.getElementById("swal-cubicos").value;
        const valor = document.getElementById("swal-valor").value;
        const notas = document.getElementById("swal-notas").value;

        // Capturar días de la semana si es evento semanal
        let weeklyDays = null;
        if (s.rrule && s.rrule.freq === "WEEKLY") {
          const dayCheckboxes = document.querySelectorAll(
            'input[type="checkbox"][value]:not(.monthly-day-checkbox)'
          );
          weeklyDays = Array.from(dayCheckboxes)
            .filter((cb) => cb.checked)
            .map((cb) => cb.value);
        }

        // Capturar días del mes si es evento mensual
        let monthlyDays = null;
        if (s.rrule && s.rrule.freq === "MONTHLY") {
          const monthlyCheckboxes = document.querySelectorAll(
            ".monthly-day-checkbox"
          );
          monthlyDays = Array.from(monthlyCheckboxes)
            .filter((cb) => cb.checked)
            .map((cb) => parseInt(cb.value, 10));

          // Validar que se haya seleccionado al menos un día
          if (monthlyDays.length === 0) {
            Swal.showValidationMessage(
              "Por favor selecciona al menos un día del mes"
            );
            return false;
          }
        }

        // Si no hay título, crear uno básico
        const finalTitle =
          title.trim() || `${anombrede.trim() || direccion.trim() || "Evento"}`;

        return {
          title: finalTitle,
          date: date || new Date().toISOString().split("T")[0],
          direccion,
          anombrede,
          servicio,
          cubicos,
          valor,
          notas,
          weeklyDays,
          monthlyDays,
        };
      },
    });

    if (!formValues) return;

    // Aplicar los cambios según el tipo de edición
    try {
          const updatedData = {
            title: formValues.title,
            dtstart: formValues.date,
            direccion: formValues.direccion || "",
            anombrede: formValues.anombrede || "",
            servicio: formValues.servicio || "",
            cubicos: formValues.cubicos ? parseFloat(formValues.cubicos) : "",
            valor: formValues.valor ? parseFloat(formValues.valor) : "",
            notas: formValues.notas || "",
          };      if (editType === "single") {
        // Editar solo este evento
        if (s.rrule) {
          // Es un evento recurrente, crear una instancia específica
          const exdatesRef = ref(
            database,
            `/reprogramacion/${o.seriesId}/exdates/${o.date}`
          );
          await set(exdatesRef, true);

          // Obtener el valor actual de las notas (ya sea de la instancia o del evento principal)
          const currentNotes = s.instances?.[o.date]?.notas !== undefined ? s.instances[o.date].notas : s.notas;

          const instancesRef = ref(
            database,
            `/reprogramacion/${o.seriesId}/instances/${formValues.date}`
          );
          await set(instancesRef, {
            ...updatedData,
            recurid: o.date,
            notas: formValues.notas || currentNotes || "",
          });
        } else {
          // Es un evento único, actualizar directamente
          const seriesRef = ref(database, `/reprogramacion/${o.seriesId}`);
          await update(seriesRef, updatedData);
        }
      } else if (editType === "fromThis") {
        // Editar desde este evento en adelante
        // Terminar la serie actual en la fecha anterior
        const previousDate = addDays(o.date, -1);
        const seriesRef = ref(database, `/reprogramacion/${o.seriesId}`);
        await update(seriesRef, {
          rrule: s.rrule ? { ...s.rrule, until: previousDate } : null,
        });

        // Crear nueva serie desde esta fecha
        let newRrule = s.rrule;

        // Para eventos mensuales, actualizar el bymonthday
        if (s.rrule && s.rrule.freq === "MONTHLY") {
          if (formValues.monthlyDays && formValues.monthlyDays.length > 0) {
            // Usar los días seleccionados por el usuario
            newRrule = {
              ...s.rrule,
              bymonthday: formValues.monthlyDays,
            };
          } else if (formValues.date !== o.date) {
            // Si cambió la fecha pero no se especificaron días, usar el día de la nueva fecha
            const newDate = parse(formValues.date);
            newRrule = {
              ...s.rrule,
              bymonthday: newDate.getDate(),
            };
          }
        }

        // Para eventos semanales, actualizar los días de la semana
        if (
          s.rrule &&
          s.rrule.freq === "WEEKLY" &&
          formValues.weeklyDays &&
          formValues.weeklyDays.length > 0
        ) {
          newRrule = {
            ...s.rrule,
            byday: formValues.weeklyDays,
          };
        }

        const newSeriesRef = push(ref(database, "reprogramacion"));
        await set(newSeriesRef, {
          ...updatedData,
          rrule: newRrule,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else if (editType === "entire") {
        // Editar toda la serie
        let updateData = { ...updatedData };

        // Para eventos mensuales, actualizar el bymonthday
        if (s.rrule && s.rrule.freq === "MONTHLY") {
          if (formValues.monthlyDays && formValues.monthlyDays.length > 0) {
            // Usar los días seleccionados por el usuario
            updateData.rrule = {
              ...s.rrule,
              bymonthday: formValues.monthlyDays,
            };
          } else if (formValues.date !== s.dtstart) {
            // Si cambió la fecha pero no se especificaron días, usar el día de la nueva fecha
            const newDate = parse(formValues.date);
            updateData.rrule = {
              ...s.rrule,
              bymonthday: newDate.getDate(),
            };
          }
        }

        // Para eventos semanales, actualizar los días de la semana
        if (
          s.rrule &&
          s.rrule.freq === "WEEKLY" &&
          formValues.weeklyDays &&
          formValues.weeklyDays.length > 0
        ) {
          updateData.rrule = {
            ...s.rrule,
            byday: formValues.weeklyDays,
          };
        }

        const seriesRef = ref(database, `/reprogramacion/${o.seriesId}`);
        await update(seriesRef, updateData);
      }

      Swal.fire({
        icon: "success",
        title: "✅ Evento actualizado",
        text: "Los cambios se han guardado correctamente",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error actualizando evento:", error);
      Swal.fire({
        icon: "error",
        title: "❌ Error",
        text: "No se pudieron guardar los cambios",
      });
    }
  }

  async function postponeEvent(o, days) {
    const newDate = addDays(o.date, days);
    const s = seriesMap[o.seriesId];

    if (s?.rrule) {
      // Marcar fecha original como excluida
      const exdatesRef = ref(
        database,
        `/reprogramacion/${o.seriesId}/exdates/${o.date}`
      );
      await set(exdatesRef, true);

      // Crear instancia movida
      const instancesRef = ref(
        database,
        `/reprogramacion/${o.seriesId}/instances/${newDate}`
      );
      await set(instancesRef, {
        dtstart: newDate,
        recurid: o.date,
      });
    } else {
      // Actualizar fecha del evento único
      const seriesRef = ref(database, `/reprogramacion/${o.seriesId}`);
      await update(seriesRef, { dtstart: newDate });
    }

    Swal.fire({
      icon: "success",
      title: "📅 Evento pospuesto",
      text: `El evento se movió al ${newDate}`,
      timer: 2000,
      showConfirmButton: false,
    });
  }

  // ===================== Render =====================
  const monthLabel = useMemo(() => {
    return monthAnchor.toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [monthAnchor]);

  const days = useMemo(() => {
    const arr = [];
    const startDate = new Date(monthAnchor);
    const endDate = new Date(
      monthAnchor.getFullYear(),
      monthAnchor.getMonth() + 1,
      0
    );

    for (let day = 1; day <= endDate.getDate(); day++) {
      const currentDate = new Date(
        monthAnchor.getFullYear(),
        monthAnchor.getMonth(),
        day
      );
      arr.push(fmt(currentDate));
    }
    return arr;
  }, [monthAnchor]);

  // Filtrar días para mostrar solo aquellos que tienen eventos cuando hay búsqueda activa
  const daysToShow = useMemo(() => {
    if (!isSearchActive) {
      return days;
    }
    // Solo mostrar días que tienen eventos filtrados
    return days.filter((day) => filteredOccurrencesByDay[day]?.length > 0);
  }, [days, isSearchActive, filteredOccurrencesByDay]);

  // Mostrar pantalla de carga mientras se cargan los datos
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
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Reprogramación</h1>
          <div className="current-date">
            <div style={{ cursor: "default" }}>
              {new Date().toLocaleDateString()}
            </div>
            <Clock />
          </div>
        </div>
      </div>
      <div className="homepage-card">
        <div className="calendar-header calendar-header-sticky">
          <div className="calendar-nav">
            <button
              className="calendar-nav-btn"
              onClick={() => {
                const d = new Date(monthAnchor);
                d.setMonth(d.getMonth() - 1);
                setMonthAnchor(d);
              }}
            >
              ◀
            </button>
            <h2 className="calendar-month-title">{monthLabel}</h2>
            <button
              className="calendar-nav-btn"
              onClick={() => {
                const d = new Date(monthAnchor);
                d.setMonth(d.getMonth() + 1);
                setMonthAnchor(d);
              }}
            >
              ▶
            </button>
            <button
              className="calendar-today-btn"
              onClick={() =>
                setMonthAnchor(() => {
                  const d = new Date();
                  d.setDate(1);
                  d.setHours(0, 0, 0, 0);
                  return d;
                })
              }
            >
              Hoy
            </button>
          </div>

          <div className="calendar-search-container">
            <div className="search-input-container">
              <input
                type="text"
                id="search-input"
                className="search-input"
                placeholder="Buscar por título o servicio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                list="search-suggestions"
                autoComplete="off"
              />
              <datalist id="search-suggestions">
                {uniqueTitles.map((title, index) => (
                  <option key={index} value={title}>
                    {title}
                  </option>
                ))}
              </datalist>
              {isSearchActive && (
                <div className="search-status">
                  🔍 Mostrando resultados para: "{activeSearchQuery}"
                </div>
              )}
            </div>
            <div className="search-buttons">
              <button 
                className="search-btn"
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
              >
                🔍 Buscar
              </button>
              <button 
                className="clear-btn"
                onClick={handleClearSearch}
                disabled={!isSearchActive}
              >
                🗑️ Limpiar
              </button>
            </div>
          </div>
        </div>

        <div className="table-container" ref={tableContainerRef}>
          <div className="calendar-grid">
            {isSearchActive && daysToShow.length === 0 ? (
              <div className="no-results-message">
                <div className="no-results-icon">🔍</div>
                <div className="no-results-title">No se encontraron resultados</div>
                <div className="no-results-subtitle">
                  No hay eventos que coincidan con "{activeSearchQuery}"
                </div>
                <button 
                  className="clear-search-btn"
                  onClick={handleClearSearch}
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              daysToShow.map((d) => {
                const inMonth = d.slice(0, 7) === fmt(monthAnchor).slice(0, 7);
                const isToday = d === today;
                const dayNum = parse(d).getDate();
                const dayDate = parse(d);
                const dayOfWeek = dayDate.toLocaleDateString("es-ES", {
                  weekday: "short",
                });
                const occs = filteredOccurrencesByDay[d] || [];
                return (
                  <div
                    key={d}
                    className={`calendar-day-cell ${
                      !inMonth ? "other-month" : ""
                    }`}
                  >
                    <div className="calendar-day-header">
                      <div
                        className={`calendar-day-number ${
                          isToday ? "today" : ""
                        }`}
                      >
                        <div className="day-number">{dayNum}</div>
                        <div className="day-name">{dayOfWeek}</div>
                      </div>
                      <button
                        className="calendar-add-event-btn"
                        onClick={() => createEvent(d)}
                      >
                        Añadir
                      </button>
                    </div>
                    <div className="calendar-events-container">
                      {occs.map((o, i) => {
                        const eventClass = o.recurid
                          ? "moved"
                          : seriesMap[o.seriesId]?.rrule
                          ? "recurring"
                          : "";
                        return (
                          <div
                            key={`${o.seriesId}-${i}-${o.date}`}
                            className={`calendar-event ${eventClass} ${
                              isSearchActive ? "search-highlight" : ""
                            }`}
                            title="Información del evento"
                          >
                            <div className="calendar-event-content">
                              <div className="calendar-event-title">
                                {o.title}
                              </div>
                              {(seriesMap[o.seriesId]?.instances?.[o.date]?.direccion || seriesMap[o.seriesId]?.direccion) && (
                                <div className="calendar-event-info">
                                  📍 {seriesMap[o.seriesId]?.instances?.[o.date]?.direccion || seriesMap[o.seriesId].direccion}
                                </div>
                              )}
                              {(seriesMap[o.seriesId]?.instances?.[o.date]?.anombrede || seriesMap[o.seriesId]?.anombrede) && (
                                <div className="calendar-event-info">
                                  👤 {seriesMap[o.seriesId]?.instances?.[o.date]?.anombrede || seriesMap[o.seriesId].anombrede}
                                </div>
                              )}
                              {(seriesMap[o.seriesId]?.instances?.[o.date]?.servicio || seriesMap[o.seriesId]?.servicio) && (
                                <div className="calendar-event-info">
                                  🛠️ {seriesMap[o.seriesId]?.instances?.[o.date]?.servicio || seriesMap[o.seriesId].servicio}
                                </div>
                              )}
                              <div className="calendar-event-details">
                                {(seriesMap[o.seriesId]?.instances?.[o.date]?.cubicos || seriesMap[o.seriesId]?.cubicos) && (
                                  <span className="calendar-event-cubicos">
                                    📦 {seriesMap[o.seriesId]?.instances?.[o.date]?.cubicos || seriesMap[o.seriesId].cubicos} cúbicos
                                  </span>
                                )}
                                {(seriesMap[o.seriesId]?.instances?.[o.date]?.valor || seriesMap[o.seriesId]?.valor) && (
                                  <span className="calendar-event-valor">
                                    💰 ${seriesMap[o.seriesId]?.instances?.[o.date]?.valor || seriesMap[o.seriesId].valor}
                                  </span>
                                )}
                              </div>
                              {(seriesMap[o.seriesId]?.instances?.[o.date]?.notas || seriesMap[o.seriesId]?.notas) && (
                                <div className="calendar-event-notas" style={{ 
                                  fontSize: '0.9em',
                                  color: '#4b5563',
                                  marginTop: '8px',
                                  padding: '8px 12px',
                                  backgroundColor: 'rgba(249, 250, 251, 0.9)',
                                  borderRadius: '6px',
                                  borderLeft: '3px solid #3b82f6',
                                  lineHeight: '1.4',
                                  position: 'relative',
                                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                                  maxWidth: '100%',
                                  wordBreak: 'break-word'
                                }}>
                                  <span style={{ marginRight: '4px', color: '#3b82f6' }}>📝</span>
                                  {seriesMap[o.seriesId]?.instances?.[o.date]?.notas || seriesMap[o.seriesId].notas}
                                </div>
                              )}
                            </div>
                            <div className="calendar-event-actions">
                              <button
                                className="calendar-event-btn calendar-event-edit-btn"
                                title="Editar evento"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditEvent(o);
                                }}
                              >
                                ✏️
                              </button>
                              <button
                                className="calendar-event-btn calendar-event-delete-btn"
                                title="Eliminar evento"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEvent(o);
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <button className="create-table-button" onClick={() => createEvent()}>
        +
      </button>
      <button 
        className="generate-button2"
        onClick={() => generateExcel()}
      >
        <img className="generate-button-imagen1" src={excel_icon} alt="Excel" />
      </button>
    </div>
  );

  // Función para exportar a Excel
  async function generateExcel() {
    // Crear un nuevo workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Eventos');

    // Configurar encabezados
    const headers = ['Fecha', 'Cliente', 'Dirección', 'Servicio', 'Cúbicos', 'Valor'];
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Obtener eventos del mes actual o según los filtros
    const currentEvents = Object.keys(filteredOccurrencesByDay).reduce((acc, date) => {
      const events = filteredOccurrencesByDay[date].map(event => {
        const series = seriesMap[event.seriesId];
        return {
          date,
          title: event.title,
          direccion: series.instances?.[date]?.direccion || series.direccion,
          anombrede: series.instances?.[date]?.anombrede || series.anombrede,
          servicio: series.instances?.[date]?.servicio || series.servicio,
          cubicos: series.instances?.[date]?.cubicos || series.cubicos,
          valor: series.instances?.[date]?.valor || series.valor
        };
      });
      return [...acc, ...events];
    }, []);

    // Ordenar eventos por fecha
    currentEvents.sort((a, b) => {
      const [d1, m1, y1] = a.date.split('-').map(Number);
      const [d2, m2, y2] = b.date.split('-').map(Number);
      return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
    });

    // Agregar datos
    currentEvents.forEach(event => {
      const row = worksheet.addRow([
        event.date,
        event.anombrede || '',
        event.direccion || '',
        event.servicio || '',
        event.cubicos || '',
        event.valor || ''
      ]);

      // Alinear el contenido
      row.alignment = { vertical: 'middle' };
      row.getCell(1).alignment = { horizontal: 'center' }; // Fecha
      row.getCell(5).alignment = { horizontal: 'center' }; // Cúbicos
      row.getCell(6).alignment = { horizontal: 'right' }; // Valor

      // Formatear valores numéricos
      if (event.cubicos) {
        row.getCell(5).numFmt = '0.0';
      }
      if (event.valor) {
        row.getCell(6).numFmt = '$#,##0.00';
      }
    });

    // Ajustar ancho de columnas
    worksheet.columns.forEach((column, i) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Agregar bordes a todas las celdas
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Obtener la fecha actual y el mes actual para el nombre del archivo
    const currentDate = new Date();
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentMonth = monthNames[monthAnchor.getMonth()];
    const currentYear = monthAnchor.getFullYear();

    // Generar el archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Eventos_${currentMonth}_${currentYear}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);

    // Mostrar mensaje de éxito
    await Swal.fire({
      icon: 'success',
      title: '¡Exportación completada!',
      text: `Se ha generado el archivo Excel con los eventos de ${currentMonth} ${currentYear}`,
      confirmButtonText: '¡Perfecto!',
      timer: 3000,
      timerProgressBar: true
    });
  }
};

export default React.memo(Reprogramacion);
