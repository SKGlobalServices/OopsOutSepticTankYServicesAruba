import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, onValue, update } from "firebase/database";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import Clock from "./Clock";
import Swal from "sweetalert2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Helpers de fecha simplificados
const fmtHoy = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const parseDMY = (dmy) => {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(dmy || "")) return null;
  const [dd, mm, yyyy] = dmy.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd);
};

const dmyToInput = (dmy) => {
  const d = parseDMY(dmy);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const inputToDmy = (ymd) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || "")) return "";
  const [yyyy, mm, dd] = ymd.split("-");
  return `${dd}-${mm}-${yyyy}`;
};

const startOfDay = (d) => d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0) : null;
const endOfDay = (d) => d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) : null;

// Helpers de dinero
const formatMoney = (val) => {
  const n = Number(val);
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Permite "1.000,5", "1,000.5", etc. y devuelve número o "".
const parseMoney = (str) => {
  if (str === "" || str == null) return "";
  const s = String(str).trim().replace(/\s+/g, "");
  const normalized = s
    .replace(/\.(?=.*\.)/g, "") // quita puntos intermedios/miles extra
    .replace(/,(?=.*[,])/g, "") // quita comas intermedias/miles extra
    .replace(/,/, "."); // coma decimal final -> punto
  const n = Number(normalized);
  return Number.isFinite(n) ? n : "";
};

const Informedecobranza = () => {
  // LOADER
  const [loading, setLoading] = useState(true);
  const [loadedPendientes, setLoadedPendientes] = useState(false);
  const [loadedConfirmacion, setLoadedConfirmacion] = useState(false);
  const [loadedEfectivo, setLoadedEfectivo] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);
  const [loadedConteoEfectivo, setLoadedConteoEfectivo] = useState(false);
  
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

  const [pendientesRows, setPendientesRows] = useState([]);
  const [confirmacionRows, setConfirmacionRows] = useState([]);
  const [efectivoRows, setEfectivoRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [localValues, setLocalValues] = useState({});
  
  // Estado para conteo de efectivo
  const [conteoEfectivo, setConteoEfectivo] = useState({
    "200": 0, "100": 0, "50": 0, "20": 0, "10": 0, "5": 0, "1": 0, "050": 0, "025": 0, "010": 0
  });

  // === FILTROS ===
  const [dir3Filter, setDir3Filter] = useState("");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [montoFilter, setMontoFilter] = useState("");
  const [notasFilter, setNotasFilter] = useState("");
  
  // === PAGINACIÓN SOLO PARA EFECTIVO ===
  const [currentPageEfectivo, setCurrentPageEfectivo] = useState(1);
  const [itemsPerPageEfectivo, setItemsPerPageEfectivo] = useState(50);

  const handleDateRangeChange = useCallback((dates) => {
    const [start, end] = dates;
    setDateFrom(
      start
        ? new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            0,
            0,
            0
          )
        : null
    );
    setDateTo(
      end
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)
        : null
    );
  }, []);

  const toggleSlidebar = useCallback(() => setShowSlidebar(prev => !prev), []);
  const toggleFilterSlidebar = useCallback(() => setShowFilterSlidebar(prev => !prev), []);

  // ===== Cargar registros de las tres tablas + conteo efectivo
  useEffect(() => {
    const pendientesRef = ref(database, "cobranzapendientes");
    const confirmacionRef = ref(database, "cobranzaconfirmacion");
    const efectivoRef = ref(database, "cobranzaefectivo");
    const conteoRef = ref(database, "cobranzaefectivototal");

    const unsubPendientes = onValue(pendientesRef, (snap) => {
      if (!snap.exists()) {
        setPendientesRows([]);
        setLoadedPendientes(true);
        return;
      }
      const val = snap.val();
      const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return aTime - bTime;
      });
      setPendientesRows(list);
      setLoadedPendientes(true);
    });

    const unsubConfirmacion = onValue(confirmacionRef, (snap) => {
      if (!snap.exists()) {
        setConfirmacionRows([]);
        setLoadedConfirmacion(true);
        return;
      }
      const val = snap.val();
      const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return aTime - bTime;
      });
      setConfirmacionRows(list);
      setLoadedConfirmacion(true);
    });

    const unsubEfectivo = onValue(efectivoRef, (snap) => {
      if (!snap.exists()) {
        setEfectivoRows([]);
        setLoadedEfectivo(true);
        return;
      }
      const val = snap.val();
      const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));
      // No ordenar aquí, se ordenará en filteredEfectivoRows por fecha
      setEfectivoRows(list);
      setLoadedEfectivo(true);
    });

    const unsubConteo = onValue(conteoRef, (snap) => {
      if (!snap.exists()) {
        // Inicializar con valores por defecto si no existe
        const defaultConteo = {
          "200": 0, "100": 0, "50": 0, "20": 0, "10": 0, "5": 0, "1": 0, "050": 0, "025": 0, "010": 0
        };
        setConteoEfectivo(defaultConteo);
        setLoadedConteoEfectivo(true);
        return;
      }
      const val = snap.val();
      setConteoEfectivo(val);
      setLoadedConteoEfectivo(true);
    });

    return () => {
      unsubPendientes();
      unsubConfirmacion();
      unsubEfectivo();
      unsubConteo();
    };
  }, []);

  // ===== Cargar clientes (para datalist de direcciones)
  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsub = onValue(dbRef, (snap) => {
      if (!snap.exists()) {
        setClients([]);
        setLoadedClients(true);
        return;
      }
      const arr = Object.entries(snap.val()).map(([id, c]) => ({
        id,
        direccion: c?.direccion ?? "",
      }));
      setClients(arr);
      setLoadedClients(true);
    });
    return unsub;
  }, []);

  // Cuando todas las fuentes de datos estén listas, oculta el loader
  useEffect(() => {
    if (loadedPendientes && loadedConfirmacion && loadedEfectivo && loadedClients && loadedConteoEfectivo) {
      setLoading(false);
    }
  }, [loadedPendientes, loadedConfirmacion, loadedEfectivo, loadedClients, loadedConteoEfectivo]);

  // Cerrar slidebars al clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        slidebarRef.current &&
        !slidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-slidebar-button")
      ) {
        setShowSlidebar(false);
      }
      if (
        filterSlidebarRef.current &&
        !filterSlidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-filter-slidebar-button")
      ) {
        setShowFilterSlidebar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ======================
  // MOVERS - Mover datos entre tablas (memoizados)
  // ======================
  const move1to2 = useCallback(async (rowId) => {
    try {
      console.log("Moving 1->2, rowId:", rowId);
      const row = pendientesRows.find((r) => r.id === rowId) || {};
      console.log("Found row:", row);
      
      const srcDireccion = (row.direccion || "").trim();
      const srcValor = (row.valor || "").toString().trim();
      const srcNotas = (row.notas || "").trim();

      console.log("Data to move:", { srcDireccion, srcValor, srcNotas });

      const newRef = push(ref(database, "cobranzaconfirmacion"));
      await set(newRef, {
        direccion: srcDireccion,
        valor: srcValor,
        notas: srcNotas,
        timestamp: new Date().toISOString()
      });
      await set(ref(database, `cobranzapendientes/${rowId}`), null);
      console.log("Move 1->2 completed");
    } catch (error) {
      console.error("Error moving 1->2:", error);
    }
  }, [pendientesRows]);

  const move2to3 = useCallback(async (rowId) => {
    try {
      console.log("Moving 2->3, rowId:", rowId);
      const row = confirmacionRows.find((r) => r.id === rowId) || {};
      console.log("Found row:", row);
      
      const srcDireccion = (row.direccion || "").trim();
      const srcValor = (row.valor || "").toString().trim();
      const srcNotas = (row.notas || "").trim();

      console.log("Data to move:", { srcDireccion, srcValor, srcNotas });

      const newRef = push(ref(database, "cobranzaefectivo"));
      await set(newRef, {
        direccion: srcDireccion,
        valor: srcValor,
        notas: srcNotas,
        fecha: fmtHoy(),
        timestamp: new Date().toISOString()
      });
      await set(ref(database, `cobranzaconfirmacion/${rowId}`), null);
      console.log("Move 2->3 completed");
    } catch (error) {
      console.error("Error moving 2->3:", error);
    }
  }, [confirmacionRows]);

  const move2to1 = useCallback(async (rowId) => {
    try {
      console.log("Moving 2->1, rowId:", rowId);
      const row = confirmacionRows.find((r) => r.id === rowId) || {};
      console.log("Found row:", row);
      
      const srcDireccion = (row.direccion || "").trim();
      const srcValor = (row.valor || "").toString().trim();
      const srcNotas = (row.notas || "").trim();

      console.log("Data to move:", { srcDireccion, srcValor, srcNotas });

      const newRef = push(ref(database, "cobranzapendientes"));
      await set(newRef, {
        direccion: srcDireccion,
        valor: srcValor,
        notas: srcNotas,
        timestamp: new Date().toISOString()
      });
      await set(ref(database, `cobranzaconfirmacion/${rowId}`), null);
      console.log("Move 2->1 completed");
    } catch (error) {
      console.error("Error moving 2->1:", error);
    }
  }, [confirmacionRows]);

  const move3to2 = useCallback(async (rowId) => {
    try {
      console.log("Moving 3->2, rowId:", rowId);
      const row = efectivoRows.find((r) => r.id === rowId) || {};
      console.log("Found row:", row);
      
      const srcDireccion = (row.direccion || "").trim();
      const srcValor = (row.valor || "").toString().trim();
      const srcNotas = (row.notas || "").trim();

      console.log("Data to move:", { srcDireccion, srcValor, srcNotas });

      const newRef = push(ref(database, "cobranzaconfirmacion"));
      await set(newRef, {
        direccion: srcDireccion,
        valor: srcValor,
        notas: srcNotas,
        timestamp: new Date().toISOString()
      });
      await set(ref(database, `cobranzaefectivo/${rowId}`), null);
      console.log("Move 3->2 completed");
    } catch (error) {
      console.error("Error moving 3->2:", error);
    }
  }, [efectivoRows]);

  // ======================
  // CRUD / Guardado puntual por campo
  // ======================
  const saveField = async (rowId, field, value, table = "pendientes") => {
    const tableName = table === "pendientes" ? "cobranzapendientes" : 
                     table === "confirmacion" ? "cobranzaconfirmacion" : "cobranzaefectivo";
    const itemRef = ref(database, `${tableName}/${rowId}`);
    await update(itemRef, { [field]: value ?? "" }).catch(console.error);
    
    if (table === "pendientes") {
      setPendientesRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value ?? "" } : r)));
    } else if (table === "confirmacion") {
      setConfirmacionRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value ?? "" } : r)));
    } else {
      setEfectivoRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value ?? "" } : r)));
    }
  };

  // Handlers estandarizados (texto) - memoizados
  const handleTextBlur = useCallback((rowId, field, keyInLocal, table = "pendientes") => (e) => {
    const v = (e.target.value || "").trim();
    if (keyInLocal) {
      setLocalValues((p) => ({ ...p, [keyInLocal]: v }));
    }
    saveField(rowId, field, v, table);
  }, []);

  // Handlers de monto (formateo al perder foco, crudo al enfocar) - memoizados
  const handleMoneyFocus = useCallback((row, field, key) => (e) => {
    const raw =
      row[field] === "" || row[field] == null ? "" : String(Number(row[field]));
    setLocalValues((p) => ({ ...p, [key]: raw }));
    setTimeout(() => {
      e.target.selectionStart = e.target.value.length;
      e.target.selectionEnd = e.target.value.length;
    }, 0);
  }, []);

  const handleMoneyChange = useCallback((key) => (e) => {
    const v = e.target.value;
    if (/^[\d\s,.\-]*$/.test(v)) {
      setLocalValues((p) => ({ ...p, [key]: v }));
    }
  }, []);

  const handleMoneyBlur = useCallback((rowId, field, key, table = "pendientes") => (e) => {
    const parsed = parseMoney(e.target.value);
    saveField(rowId, field, parsed, table);
    setLocalValues((p) => ({
      ...p,
      [key]: parsed === "" ? "" : formatMoney(parsed),
    }));
  }, []);

  // Handler de fecha - memoizado
  const handleDateBlur = useCallback((row, key) => (e) => {
    const oldDmy = row.fecha || "";
    const newYmd = e.target.value;
    const newDmy = inputToDmy(newYmd);
    if (!newDmy) {
      setLocalValues((p) => ({ ...p, [key]: dmyToInput(oldDmy) }));
      alert("Fecha inválida. Usa el selector de fecha o formato dd-mm-aaaa.");
      return;
    }
    if (newDmy === oldDmy) return;
    saveField(row.id, "fecha", newDmy, "efectivo");
  }, []);

  // Crear registro vacío - memoizado
  const addData = useCallback(async () => {
    const dbRef = ref(database, "cobranzapendientes");
    const newRef = push(dbRef);
    await set(newRef, {
      direccion: "",
      valor: "",
      notas: "",
      timestamp: new Date().toISOString()
    });
  }, []);

  // Eliminar registro - memoizado
  const handleDeleteRow = useCallback((rowId, table = "efectivo") => {
    Swal.fire({
      title: "¿Deseas eliminar el registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        const tableName = table === "pendientes" ? "cobranzapendientes" : 
                         table === "confirmacion" ? "cobranzaconfirmacion" : "cobranzaefectivo";
        set(ref(database, `${tableName}/${rowId}`), null)
          .then(() => {
            Swal.fire({
              title: "¡Registro eliminado!",
              text: "El registro ha sido eliminado exitosamente.",
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
          })
          .catch((err) =>
            Swal.fire("Error", "No se pudo eliminar: " + err.message, "error")
          );
      }
    });
  }, []);

  // === OPCIONES ÚNICAS PARA Dirección (filtro) - optimizado
  const dir3Options = useMemo(() => {
    if (efectivoRows.length === 0) return [];
    const setU = new Set(
      efectivoRows.map((r) => (r.direccion || "").trim()).filter((x) => x)
    );
    return Array.from(setU).sort((a, b) => a.localeCompare(b));
  }, [efectivoRows]);

  // === APLICAR FILTROS Y PAGINACIÓN === - optimizado
  const filteredEfectivoRows = useMemo(() => {
    if (efectivoRows.length === 0) return [];
    
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);
    
    const filtered = efectivoRows.filter(r => {
      if (dir3Filter && (r.direccion || "").trim() !== dir3Filter) return false;
      if (montoFilter && !(r.valor || "").toString().includes(montoFilter)) return false;
      if (notasFilter && !(r.notas || "").toLowerCase().includes(notasFilter.toLowerCase())) return false;
      if (from || to) {
        const d = parseDMY(r.fecha);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
    
    return filtered.sort((a, b) => {
      // Ordenar por fecha, más reciente primero
      const dateA = parseDMY(a.fecha || "");
      const dateB = parseDMY(b.fecha || "");
      
      // Si no hay fecha, poner al final
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      // Fecha más reciente primero (orden descendente)
      return dateB.getTime() - dateA.getTime();
    });
  }, [efectivoRows, dir3Filter, dateFrom, dateTo, montoFilter, notasFilter]);

  // Paginación solo para efectivo - optimizado
  const paginatedEfectivo = useMemo(() => {
    if (filteredEfectivoRows.length === 0) return [];
    const start = (currentPageEfectivo - 1) * itemsPerPageEfectivo;
    return filteredEfectivoRows.slice(start, start + itemsPerPageEfectivo);
  }, [filteredEfectivoRows, currentPageEfectivo, itemsPerPageEfectivo]);

  const totalPagesEfectivo = useMemo(() => Math.max(1, Math.ceil(filteredEfectivoRows.length / itemsPerPageEfectivo)), [filteredEfectivoRows.length, itemsPerPageEfectivo]);
  const totalItemsEfectivo = filteredEfectivoRows.length;
  const startIndexEfectivo = useMemo(() => (currentPageEfectivo - 1) * itemsPerPageEfectivo, [currentPageEfectivo, itemsPerPageEfectivo]);
  const endIndexEfectivo = useMemo(() => startIndexEfectivo + itemsPerPageEfectivo, [startIndexEfectivo, itemsPerPageEfectivo]);

  const goToPageEfectivo = useCallback((page) => {
    if (page < 1) page = 1;
    if (page > totalPagesEfectivo) page = totalPagesEfectivo;
    setCurrentPageEfectivo(page);
  }, [totalPagesEfectivo]);
  
  const goToFirstPageEfectivo = useCallback(() => goToPageEfectivo(1), [goToPageEfectivo]);
  const goToLastPageEfectivo = useCallback(() => goToPageEfectivo(totalPagesEfectivo), [goToPageEfectivo, totalPagesEfectivo]);
  const goToPreviousPageEfectivo = useCallback(() => goToPageEfectivo(currentPageEfectivo - 1), [goToPageEfectivo, currentPageEfectivo]);
  const goToNextPageEfectivo = useCallback(() => goToPageEfectivo(currentPageEfectivo + 1), [goToPageEfectivo, currentPageEfectivo]);

  const handleItemsPerPageChangeEfectivo = useCallback((newSize) => {
    setItemsPerPageEfectivo(newSize);
    setCurrentPageEfectivo(1);
  }, []);

  const handleConteoChange = useCallback(async (tipo, cantidad) => {
    const newCantidad = Number(cantidad) || 0;
    
    // Actualizar estado local primero
    setConteoEfectivo(prev => {
      const newConteo = {
        ...prev,
        [tipo]: newCantidad
      };
      
      // Guardar en base de datos de forma asíncrona
      set(ref(database, "cobranzaefectivototal"), newConteo)
        .catch(error => console.error("Error saving conteo efectivo:", error));
      
      return newConteo;
    });
  }, []);

  // Reset página cuando cambien los filtros
  useEffect(() => {
    setCurrentPageEfectivo(1);
  }, [dir3Filter, dateFrom, dateTo, montoFilter, notasFilter]);

  useEffect(() => {
    if (currentPageEfectivo > totalPagesEfectivo && totalPagesEfectivo > 0) {
      setCurrentPageEfectivo(Math.max(1, totalPagesEfectivo));
    }
  }, [totalPagesEfectivo, currentPageEfectivo]);

  // Calcular sumas totales de montos - optimizado
  const totalPendientes = useMemo(() => {
    if (pendientesRows.length === 0) return 0;
    return pendientesRows.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
  }, [pendientesRows]);

  const totalConfirmacion = useMemo(() => {
    if (confirmacionRows.length === 0) return 0;
    return confirmacionRows.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
  }, [confirmacionRows]);

  const totalEfectivo = useMemo(() => {
    if (filteredEfectivoRows.length === 0) return 0;
    return filteredEfectivoRows.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
  }, [filteredEfectivoRows]);

  const totalConteoEfectivo = useMemo(() => {
    return Object.entries(conteoEfectivo).reduce((sum, [tipo, cantidad]) => {
      const valor = tipo === "050" ? 0.50 : tipo === "025" ? 0.25 : tipo === "010" ? 0.10 : Number(tipo);
      return sum + (valor * Number(cantidad));
    }, 0);
  }, [conteoEfectivo]);

  // Función para inicializar conteo si no existe
  const initializeConteoEfectivo = useCallback(async () => {
    const defaultConteo = {
      "200": 0, "100": 0, "50": 0, "20": 0, "10": 0, "5": 0, "1": 0, "050": 0, "025": 0, "010": 0
    };
    try {
      await set(ref(database, "cobranzaefectivototal"), defaultConteo);
    } catch (error) {
      console.error("Error initializing conteo efectivo:", error);
    }
  }, []);

  const clearFilters = useCallback(() => {
    setDir3Filter("");
    setDateFrom(null);
    setDateTo(null);
    setMontoFilter("");
    setNotasFilter("");
    setCurrentPageEfectivo(1);
  }, []);

  // Datalist de direcciones (desde clientes) - optimizado
  const direccionChoices = useMemo(() => {
    if (clients.length === 0) return [];
    return Array.from(
      new Set(clients.map((c) => c.direccion).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [clients]);

  // Early return: mientras loading sea true, muestra el spinner
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

        {/* Fecha (rango) */}
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
            selected={dateFrom}
            onChange={handleDateRangeChange}
            startDate={dateFrom}
            endDate={dateTo}
            selectsRange
            inline
          />
        )}

        {/* Dirección */}
        <label style={{ color: "white" }}>Dirección</label>
        <select
          value={dir3Filter}
          onChange={(e) => setDir3Filter(e.target.value)}
        >
          <option value="">(Todos)</option>
          {dir3Options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        {/* Monto */}
        <label style={{ color: "white" }}>Monto</label>
        <input
          type="text"
          value={montoFilter}
          onChange={(e) => setMontoFilter(e.target.value)}
          placeholder="Filtrar por monto"
          style={{ width: "100%", padding: "5px" }}
        />

        {/* Notas */}
        <label style={{ color: "white" }}>Notas</label>
        <input
          type="text"
          value={notasFilter}
          onChange={(e) => setNotasFilter(e.target.value)}
          placeholder="Filtrar por notas"
          style={{ width: "100%", padding: "5px" }}
        />

        <button className="discard-filter-button" onClick={clearFilters}>
          Descartar Filtros
        </button>
      </div>

      {/* Título */}
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Informe De Cobranza</h1>
          <div className="current-date">
            <div>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="table-container">
          {/* === TABLAS SEPARADAS CON FLEXBOX ROW === */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'row', 
              gap: '20px', 
            }}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.preventDefault();
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            
            {/* ===== TABLA 1: PENDIENTES POR PAGAR ===== */}
            <div>
              <table className="service-table">
                <thead>
                  <tr>
                    <th colSpan={5} style={{ background: "#b90000ff", color: "#fff" }}>
                      PENDIENTES POR PAGAR - Total: {formatMoney(totalPendientes)}
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: '40%' }}>Dirección</th>
                    <th style={{ width: '18%' }}>Monto</th>
                    <th style={{ width: '32%' }}>Notas</th>
                    <th style={{ width: '5%' }}>Avanzar</th>
                    <th style={{ width: '5%' }}>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientesRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "#888" }}>
                        Sin registros
                      </td>
                    </tr>
                  ) : (
                    pendientesRows.map((r) => {
                      const kD1 = `${r.id}_direccion`;
                      const kV1 = `${r.id}_valor`;
                      const kN1 = `${r.id}_notas`;

                      return (
                        <tr key={`t1_${r.id}`}>
                          <td>
                            <div className="custom-select-container">
                              <input
                                type="text"
                                style={{ width: "100%", minWidth: "140px", fontSize: '12px' }}
                                value={localValues[kD1] !== undefined ? localValues[kD1] : r.direccion || ""}
                                onChange={(e) => setLocalValues((p) => ({ ...p, [kD1]: e.target.value }))}
                                onFocus={(e) => e.target.setAttribute("list", `dir-opt-1-${r.id}`)}
                                onBlur={(e) => {
                                  setTimeout(() => e.target.removeAttribute("list"), 200);
                                  if (e.target.value !== (r.direccion || "")) {
                                    saveField(r.id, "direccion", e.target.value, "pendientes");
                                  }
                                }}
                                list={`dir-opt-1-${r.id}`}
                              />
                              <datalist id={`dir-opt-1-${r.id}`}>
                                {direccionChoices.map((d) => <option key={d} value={d} />)}
                              </datalist>
                            </div>
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              style={{ width: "100%", textAlign: "center", fontSize: '12px' }}
                              value={localValues[kV1] !== undefined ? localValues[kV1] : formatMoney(r.valor || 0)}
                              onFocus={handleMoneyFocus(r, "valor", kV1)}
                              onChange={handleMoneyChange(kV1)}
                              onBlur={handleMoneyBlur(r.id, "valor", kV1, "pendientes")}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              style={{ width: "100%", minWidth:"100px", fontSize: '12px' }}
                              value={localValues[kN1] !== undefined ? localValues[kN1] : r.notas || ""}
                              onChange={(e) => setLocalValues((p) => ({ ...p, [kN1]: e.target.value }))}
                              onBlur={handleTextBlur(r.id, "notas", kN1, "pendientes")}
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button className="filter-button" style={{ fontSize: "8px", padding: '4px 16px', margin:"2px"  }} onClick={() => move1to2(r.id)}>→</button>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button className="delete-button" style={{ cursor: "pointer", padding: '2px 4px', margin:"2px" }} onClick={() => handleDeleteRow(r.id, "pendientes")}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

            </div>

            {/* ===== TABLA 2: CONFIRMACIÓN DE PAGOS ===== */}
            <div>
              <table className="service-table">
                <thead>
                  <tr>
                    <th colSpan={6} style={{ background: "#007cb6ff", color: "#fff" }}>
                      CONFIRMACIÓN DE PAGOS - Total: {formatMoney(totalConfirmacion)}
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: '5%' }}>Devolver</th>
                    <th style={{ width: '38%' }}>Dirección</th>
                    <th style={{ width: '17%' }}>Monto</th>
                    <th style={{ width: '30%' }}>Notas</th>
                    <th style={{ width: '5%' }}>Avanzar</th>
                    <th style={{ width: '5%' }}>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmacionRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "#888" }}>
                        Sin registros
                      </td>
                    </tr>
                  ) : (
                    confirmacionRows.map((r) => {
                      const kD2 = `${r.id}_direccion`;
                      const kV2 = `${r.id}_valor`;
                      const kN2 = `${r.id}_notas`;

                      return (
                        <tr key={`t2_${r.id}`}>
                          <td style={{ textAlign: "center" }}>
                            <button className="filter-button" style={{ fontSize: "8px", padding: '4px 16px', margin:"2px" }} onClick={() => move2to1(r.id)}>←</button>
                          </td>
                          <td>
                            <div className="custom-select-container">
                              <input
                                type="text"
                                style={{ width: "100%", minWidth: "140px", fontSize: '12px' }}
                                value={localValues[kD2] !== undefined ? localValues[kD2] : r.direccion || ""}
                                onChange={(e) => setLocalValues((p) => ({ ...p, [kD2]: e.target.value }))}
                                onFocus={(e) => e.target.setAttribute("list", `dir-opt-2-${r.id}`)}
                                onBlur={(e) => {
                                  setTimeout(() => e.target.removeAttribute("list"), 200);
                                  if (e.target.value !== (r.direccion || "")) {
                                    saveField(r.id, "direccion", e.target.value, "confirmacion");
                                  }
                                }}
                                list={`dir-opt-2-${r.id}`}
                              />
                              <datalist id={`dir-opt-2-${r.id}`}>
                                {direccionChoices.map((d) => <option key={d} value={d} />)}
                              </datalist>
                            </div>
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              style={{ width: "100%", textAlign: "center", fontSize: '12px' }}
                              value={localValues[kV2] !== undefined ? localValues[kV2] : formatMoney(r.valor || 0)}
                              onFocus={handleMoneyFocus(r, "valor", kV2)}
                              onChange={handleMoneyChange(kV2)}
                              onBlur={handleMoneyBlur(r.id, "valor", kV2, "confirmacion")}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              style={{ width: "100%", minWidth:"100px", fontSize: '12px' }}
                              value={localValues[kN2] !== undefined ? localValues[kN2] : r.notas || ""}
                              onChange={(e) => setLocalValues((p) => ({ ...p, [kN2]: e.target.value }))}
                              onBlur={handleTextBlur(r.id, "notas", kN2, "confirmacion")}
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button className="filter-button" style={{ fontSize: "8px", padding: '4px 16px', margin:"2px" }} onClick={() => move2to3(r.id)}>→</button>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button className="delete-button" style={{ cursor: "pointer", padding: '2px 4px', margin:"2px" }} onClick={() => handleDeleteRow(r.id, "confirmacion")}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

            </div>

            {/* ===== TABLA 3: EFECTIVO RECIBIDO ===== */}
            <div>
              <table className="service-table">
                <thead>
                  <tr>
                    <th colSpan={6} style={{ background: "#006b04ff", color: "#fff" }}>
                      EFECTIVO RECIBIDO - Total: {formatMoney(totalEfectivo)}
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: '5%' }}>Volver</th>
                    <th style={{ width: '15%' }}>Fecha</th>
                    <th style={{ width: '35%' }}>Dirección</th>
                    <th style={{ width: '15%' }}>Monto</th>
                    <th style={{ width: '25%' }}>Notas</th>
                    <th style={{ width: '5%' }}>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEfectivo.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "#888" }}>
                        Sin registros
                      </td>
                    </tr>
                  ) : (
                    paginatedEfectivo.map((r) => {
                      const kFec = `${r.id}_fecha`;
                      const kD3 = `${r.id}_direccion`;
                      const kV3 = `${r.id}_valor`;
                      const kN3 = `${r.id}_notas`;

                      return (
                        <tr key={`t3_${r.id}`}>
                          <td style={{ textAlign: "center" }}>
                            <button className="filter-button" style={{ fontSize: "8px", padding: '4px 16px', margin:"2px" }} onClick={() => move3to2(r.id)}>←</button>
                          </td>
                          <td>
                            <input
                              type="date"
                              value={localValues[kFec] !== undefined ? localValues[kFec] : dmyToInput(r.fecha)}
                              onChange={(e) => setLocalValues((p) => ({ ...p, [kFec]: e.target.value }))}
                              onBlur={handleDateBlur(r, kFec)}
                              style={{ width: "100%", fontSize: '12px' }}
                            />
                          </td>
                          <td>
                            <div className="custom-select-container">
                              <input
                                type="text"
                                style={{ width: "100%", minWidth: "140px", fontSize: '12px' }}
                                value={localValues[kD3] !== undefined ? localValues[kD3] : r.direccion || ""}
                                onChange={(e) => setLocalValues((p) => ({ ...p, [kD3]: e.target.value }))}
                                onFocus={(e) => e.target.setAttribute("list", `dir-opt-3-${r.id}`)}
                                onBlur={(e) => {
                                  setTimeout(() => e.target.removeAttribute("list"), 200);
                                  if (e.target.value !== (r.direccion || "")) {
                                    saveField(r.id, "direccion", e.target.value, "efectivo");
                                  }
                                }}
                                list={`dir-opt-3-${r.id}`}
                              />
                              <datalist id={`dir-opt-3-${r.id}`}>
                                {direccionChoices.map((d) => <option key={d} value={d} />)}
                              </datalist>
                            </div>
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              style={{ width: "100%", textAlign: "center", fontSize: '12px' }}
                              value={localValues[kV3] !== undefined ? localValues[kV3] : formatMoney(r.valor || 0)}
                              onFocus={handleMoneyFocus(r, "valor", kV3)}
                              onChange={handleMoneyChange(kV3)}
                              onBlur={handleMoneyBlur(r.id, "valor", kV3, "efectivo")}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              style={{ width: "100%", minWidth:"100px", fontSize: '12px' }}
                              value={localValues[kN3] !== undefined ? localValues[kN3] : r.notas || ""}
                              onChange={(e) => setLocalValues((p) => ({ ...p, [kN3]: e.target.value }))}
                              onBlur={handleTextBlur(r.id, "notas", kN3, "efectivo")}
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button className="delete-button" style={{ cursor: "pointer", padding: '2px 4px', margin:"2px" }} onClick={() => handleDeleteRow(r.id, "efectivo")}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {/* Controles de paginación Efectivo */}
              {totalItemsEfectivo > 0 && (
                <div style={{ 
                  marginTop: '15px', 
                  padding: '12px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  {/* Fila superior: Info de registros y selector */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <span style={{ color: '#495057', fontSize: '14px', fontWeight: '500' }}>
                      Mostrando {startIndexEfectivo + 1}-{Math.min(endIndexEfectivo, totalItemsEfectivo)} de {totalItemsEfectivo} registros
                    </span>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      backgroundColor: '#fff',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6'
                    }}>
                      <label style={{ color: '#495057', fontSize: '14px', fontWeight: '500' }}>Mostrar:</label>
                      <select
                        value={itemsPerPageEfectivo}
                        onChange={(e) => handleItemsPerPageChangeEfectivo(Number(e.target.value))}
                        style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          border: '1px solid #ced4da',
                          fontSize: '14px',
                          backgroundColor: '#fff'
                        }}
                      >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                        <option value={500}>500</option>
                      </select>
                      <span style={{ color: '#495057', fontSize: '14px' }}>por página</span>
                    </div>
                  </div>

                  {/* Fila inferior: Controles de navegación */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '6px'
                  }}>
                    <button
                      onClick={goToFirstPageEfectivo}
                      disabled={currentPageEfectivo === 1}
                      title="Primera página"
                      style={{ 
                        padding: '8px 12px', 
                        border: '1px solid #ced4da', 
                        borderRadius: '6px', 
                        backgroundColor: currentPageEfectivo === 1 ? '#f8f9fa' : '#fff',
                        color: currentPageEfectivo === 1 ? '#6c757d' : '#495057',
                        cursor: currentPageEfectivo === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      ««
                    </button>
                    <button
                      onClick={goToPreviousPageEfectivo}
                      disabled={currentPageEfectivo === 1}
                      title="Página anterior"
                      style={{ 
                        padding: '8px 12px', 
                        border: '1px solid #ced4da', 
                        borderRadius: '6px', 
                        backgroundColor: currentPageEfectivo === 1 ? '#f8f9fa' : '#fff',
                        color: currentPageEfectivo === 1 ? '#6c757d' : '#495057',
                        cursor: currentPageEfectivo === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      «
                    </button>
                    <span style={{ 
                      padding: '8px 16px', 
                      backgroundColor: '#007bff', 
                      color: 'white', 
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      minWidth: '120px',
                      textAlign: 'center'
                    }}>
                      Página {currentPageEfectivo} de {totalPagesEfectivo}
                    </span>
                    <button
                      onClick={goToNextPageEfectivo}
                      disabled={currentPageEfectivo === totalPagesEfectivo}
                      title="Página siguiente"
                      style={{ 
                        padding: '8px 12px', 
                        border: '1px solid #ced4da', 
                        borderRadius: '6px', 
                        backgroundColor: currentPageEfectivo === totalPagesEfectivo ? '#f8f9fa' : '#fff',
                        color: currentPageEfectivo === totalPagesEfectivo ? '#6c757d' : '#495057',
                        cursor: currentPageEfectivo === totalPagesEfectivo ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      »
                    </button>
                    <button
                      onClick={goToLastPageEfectivo}
                      disabled={currentPageEfectivo === totalPagesEfectivo}
                      title="Última página"
                      style={{ 
                        padding: '8px 12px', 
                        border: '1px solid #ced4da', 
                        borderRadius: '6px', 
                        backgroundColor: currentPageEfectivo === totalPagesEfectivo ? '#f8f9fa' : '#fff',
                        color: currentPageEfectivo === totalPagesEfectivo ? '#6c757d' : '#495057',
                        cursor: currentPageEfectivo === totalPagesEfectivo ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      »»
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ===== TABLA 4: CONTEO DE EFECTIVO ===== */}
            <div>
              <table className="service-table">
                <thead>
                  <tr>
                    <th colSpan={3} style={{ background: "#6f42c1", color: "#fff" }}>
                      CONTEO DE EFECTIVO - Total: {formatMoney(totalConteoEfectivo)}
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: '40%' }}>Tipo de Efectivo</th>
                    <th style={{ width: '30%' }}>Cantidad</th>
                    <th style={{ width: '30%' }}>Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {["200", "100", "50", "20", "10", "5", "1", "050", "025", "010"].map((tipoKey) => {
                    const cantidad = conteoEfectivo[tipoKey] || 0;
                    const tipoValor = tipoKey === "050" ? 0.50 : tipoKey === "025" ? 0.25 : tipoKey === "010" ? 0.10 : Number(tipoKey);
                    const montoTotal = tipoValor * cantidad;
                    
                    return (
                      <tr key={tipoKey}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {formatMoney(tipoValor)}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={cantidad}
                            onChange={(e) => handleConteoChange(tipoKey, e.target.value)}
                            onBlur={(e) => handleConteoChange(tipoKey, e.target.value)}
                            style={{ 
                              width: '100%', 
                              textAlign: 'center', 
                              fontSize: '12px',
                              padding: '4px'
                            }}
                            placeholder="0"
                          />
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: '500' }}>
                          {formatMoney(montoTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Crear nuevo */}
      <button className="create-table-button" onClick={addData}>
        +
      </button>
    </div>
  );
};

export default React.memo(Informedecobranza);
