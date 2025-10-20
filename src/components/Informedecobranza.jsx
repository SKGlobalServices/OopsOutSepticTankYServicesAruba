import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
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
  return `${String(d.getDate()).padStart(2, "0")}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${d.getFullYear()}`;
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

const startOfDay = (d) =>
  d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0) : null;
const endOfDay = (d) =>
  d
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    : null;

// Helpers de dinero
const formatMoney = (val) => {
  const n = Number(val);
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Helper: claves seguras para Firebase (sin puntos)
const SAFE_DENOMS = [
  "200",
  "100",
  "50",
  "25",
  "10",
  "5",
  "1",
  "050",
  "025",
  "010",
  "005",
];

// Mapea clave segura -> valor numérico
const keyToValue = (k) =>
  k === "050"
    ? 0.5
    : k === "025"
    ? 0.25
    : k === "010"
    ? 0.1
    : k === "005"
    ? 0.05
    : Number(k);

// Mapea clave segura -> etiqueta para mostrar
const keyToLabel = (k) =>
  k === "050"
    ? "0.50"
    : k === "025"
    ? "0.25"
    : k === "010"
    ? "0.10"
    : k === "005"
    ? "0.05"
    : k;

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

  // Estado para conteo de efectivo
  const [conteoEfectivo, setConteoEfectivo] = useState({});

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

  const toggleSlidebar = useCallback(
    () => setShowSlidebar((prev) => !prev),
    []
  );
  const toggleFilterSlidebar = useCallback(
    () => setShowFilterSlidebar((prev) => !prev),
    []
  );

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
      // convierte claves con punto -> seguras
      const toSafe = (k) => {
        if (k === "0.50") return "050";
        if (k === "0.25") return "025";
        if (k === "0.10") return "010";
        if (k === "0.05") return "005";
        return k;
      };

      if (!snap.exists()) {
        const defaultConteo = Object.fromEntries(
          SAFE_DENOMS.map((d) => [d, 0])
        );
        setConteoEfectivo(defaultConteo);
        setLoadedConteoEfectivo(true);
        return;
      }

      const raw = snap.val() || {};
      const safe = {};

      // migra todas las claves a formato seguro
      Object.entries(raw).forEach(([k, v]) => {
        const sk = toSafe(String(k));
        safe[sk] = Number(v) || 0;
      });

      // garantiza todas las denominaciones
      SAFE_DENOMS.forEach((d) => {
        if (safe[d] == null) safe[d] = 0;
      });

      setConteoEfectivo(safe);
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
    if (
      loadedPendientes &&
      loadedConfirmacion &&
      loadedEfectivo &&
      loadedClients &&
      loadedConteoEfectivo
    ) {
      setLoading(false);
    }
  }, [
    loadedPendientes,
    loadedConfirmacion,
    loadedEfectivo,
    loadedClients,
    loadedConteoEfectivo,
  ]);

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
  // MOVERS - Mover datos entre tablas (optimizados)
  // ======================
  const move1to2 = useCallback(
    async (rowId) => {
      const row = pendientesRows.find((r) => r.id === rowId);
      if (!row) return;

      const newRef = push(ref(database, "cobranzaconfirmacion"));
      await Promise.all([
        set(newRef, {
          direccion: (row.direccion || "").trim(),
          valor: (row.valor || "").toString().trim(),
          notas: (row.notas || "").trim(),
          timestamp: new Date().toISOString(),
        }),
        set(ref(database, `cobranzapendientes/${rowId}`), null),
      ]);
    },
    [pendientesRows]
  );

  const move2to3 = useCallback(
    async (rowId) => {
      const row = confirmacionRows.find((r) => r.id === rowId);
      if (!row) return;

      const newRef = push(ref(database, "cobranzaefectivo"));
      await Promise.all([
        set(newRef, {
          direccion: (row.direccion || "").trim(),
          valor: (row.valor || "").toString().trim(),
          notas: (row.notas || "").trim(),
          fecha: fmtHoy(),
          timestamp: new Date().toISOString(),
        }),
        set(ref(database, `cobranzaconfirmacion/${rowId}`), null),
      ]);
    },
    [confirmacionRows]
  );

  const move2to1 = useCallback(
    async (rowId) => {
      const row = confirmacionRows.find((r) => r.id === rowId);
      if (!row) return;

      const newRef = push(ref(database, "cobranzapendientes"));
      await Promise.all([
        set(newRef, {
          direccion: (row.direccion || "").trim(),
          valor: (row.valor || "").toString().trim(),
          notas: (row.notas || "").trim(),
          timestamp: new Date().toISOString(),
        }),
        set(ref(database, `cobranzaconfirmacion/${rowId}`), null),
      ]);
    },
    [confirmacionRows]
  );

  const move3to2 = useCallback(
    async (rowId) => {
      const row = efectivoRows.find((r) => r.id === rowId);
      if (!row) return;

      const newRef = push(ref(database, "cobranzaconfirmacion"));
      await Promise.all([
        set(newRef, {
          direccion: (row.direccion || "").trim(),
          valor: (row.valor || "").toString().trim(),
          notas: (row.notas || "").trim(),
          timestamp: new Date().toISOString(),
        }),
        set(ref(database, `cobranzaefectivo/${rowId}`), null),
      ]);
    },
    [efectivoRows]
  );

  // ======================
  // CRUD / Guardado optimizado
  // ======================
  const saveField = useCallback(
    async (rowId, field, value, table = "pendientes") => {
      const tableName =
        table === "pendientes"
          ? "cobranzapendientes"
          : table === "confirmacion"
          ? "cobranzaconfirmacion"
          : "cobranzaefectivo";

      await update(ref(database, `${tableName}/${rowId}`), {
        [field]: value ?? "",
      });
    },
    []
  );

  // Handlers optimizados
  const handleTextBlur = useCallback(
    (rowId, field, table = "pendientes") =>
      (e) => {
        const v = (e.target.value || "").trim();
        saveField(rowId, field, v, table);
      },
    [saveField]
  );

  const handleMoneyBlur = useCallback(
    (rowId, field, table = "pendientes") =>
      (e) => {
        const parsed = parseMoney(e.target.value);
        saveField(rowId, field, parsed, table);
      },
    [saveField]
  );

  const handleDateBlur = useCallback(
    (rowId) => (e) => {
      const newDmy = inputToDmy(e.target.value);
      if (newDmy) {
        saveField(rowId, "fecha", newDmy, "efectivo");
      }
    },
    [saveField]
  );

  // Crear registro nuevo
  const addData = useCallback(async () => {
    const newRef = push(ref(database, "cobranzaefectivo"));
    await set(newRef, {
      direccion: "",
      valor: "",
      notas: "",
      fecha: fmtHoy(),
      timestamp: new Date().toISOString(),
    });
    setCurrentPageEfectivo(1);
  }, []);

  // Eliminar registro
  const handleDeleteRow = useCallback((rowId, table = "efectivo") => {
    Swal.fire({
      title: "¿Deseas eliminar el registro?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "No",
    }).then((result) => {
      if (result.isConfirmed) {
        const tableName =
          table === "pendientes"
            ? "cobranzapendientes"
            : table === "confirmacion"
            ? "cobranzaconfirmacion"
            : "cobranzaefectivo";
        set(ref(database, `${tableName}/${rowId}`), null);
      }
    });
  }, []);

  // Opciones de dirección para filtro
  const dir3Options = useMemo(() => {
    const dirs = new Set();
    efectivoRows.forEach((r) => {
      const dir = (r.direccion || "").trim();
      if (dir) dirs.add(dir);
    });
    return [...dirs].sort();
  }, [efectivoRows]);

  // Filtros y cálculo de saldo optimizado
  const computedEfectivoRows = useMemo(() => {
    let filtered = efectivoRows;

    // Aplicar filtros
    if (dir3Filter || montoFilter || notasFilter || dateFrom || dateTo) {
      const from = startOfDay(dateFrom);
      const to = endOfDay(dateTo);

      filtered = efectivoRows.filter((r) => {
        if (dir3Filter && (r.direccion || "").trim() !== dir3Filter)
          return false;
        if (montoFilter && !(r.valor || "").toString().includes(montoFilter))
          return false;
        if (
          notasFilter &&
          !(r.notas || "").toLowerCase().includes(notasFilter.toLowerCase())
        )
          return false;
        if (from || to) {
          const d = parseDMY(r.fecha);
          if (!d || (from && d < from) || (to && d > to)) return false;
        }
        return true;
      });
    }

    // Ordenar y calcular saldo
    const sorted = filtered.sort((a, b) => {
      const dateA = parseDMY(a.fecha || "");
      const dateB = parseDMY(b.fecha || "");
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return (
        dateA - dateB || new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
      );
    });

    let balance = 0;
    const withSaldo = sorted.map((r) => {
      balance += parseFloat(r.valor) || 0;
      return { ...r, saldo: balance };
    });

    return withSaldo.reverse();
  }, [efectivoRows, dir3Filter, dateFrom, dateTo, montoFilter, notasFilter]);

  // Paginación solo para efectivo - optimizado
  const paginatedEfectivo = useMemo(() => {
    if (computedEfectivoRows.length === 0) return [];
    const start = (currentPageEfectivo - 1) * itemsPerPageEfectivo;
    return computedEfectivoRows.slice(start, start + itemsPerPageEfectivo);
  }, [computedEfectivoRows, currentPageEfectivo, itemsPerPageEfectivo]);

  const totalPagesEfectivo = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(computedEfectivoRows.length / itemsPerPageEfectivo)
      ),
    [computedEfectivoRows.length, itemsPerPageEfectivo]
  );
  const totalItemsEfectivo = computedEfectivoRows.length;
  const startIndexEfectivo = useMemo(
    () => (currentPageEfectivo - 1) * itemsPerPageEfectivo,
    [currentPageEfectivo, itemsPerPageEfectivo]
  );
  const endIndexEfectivo = useMemo(
    () => startIndexEfectivo + itemsPerPageEfectivo,
    [startIndexEfectivo, itemsPerPageEfectivo]
  );

  const goToPageEfectivo = useCallback(
    (page) => {
      if (page < 1) page = 1;
      if (page > totalPagesEfectivo) page = totalPagesEfectivo;
      setCurrentPageEfectivo(page);
    },
    [totalPagesEfectivo]
  );

  const goToFirstPageEfectivo = useCallback(
    () => goToPageEfectivo(1),
    [goToPageEfectivo]
  );
  const goToLastPageEfectivo = useCallback(
    () => goToPageEfectivo(totalPagesEfectivo),
    [goToPageEfectivo, totalPagesEfectivo]
  );
  const goToPreviousPageEfectivo = useCallback(
    () => goToPageEfectivo(currentPageEfectivo - 1),
    [goToPageEfectivo, currentPageEfectivo]
  );
  const goToNextPageEfectivo = useCallback(
    () => goToPageEfectivo(currentPageEfectivo + 1),
    [goToPageEfectivo, currentPageEfectivo]
  );

  const handleItemsPerPageChangeEfectivo = useCallback((newSize) => {
    setItemsPerPageEfectivo(newSize);
    setCurrentPageEfectivo(1);
  }, []);

  const handleConteoChange = useCallback((tipoSeguro, cantidad) => {
    const newCantidad = Math.max(0, Number(cantidad) || 0); // nunca negativo
    if (!SAFE_DENOMS.includes(tipoSeguro)) return; // solo claves válidas

    setConteoEfectivo((prev) => {
      const sanitized = Object.fromEntries(
        SAFE_DENOMS.map((k) => [k, Number(prev[k]) || 0])
      );
      sanitized[tipoSeguro] = newCantidad;

      set(ref(database, "cobranzaefectivototal"), sanitized);
      return sanitized;
    });
  }, []);

  // Reset página cuando cambien los filtros
  useEffect(() => {
    setCurrentPageEfectivo(1);
  }, [dir3Filter, dateFrom, dateTo, montoFilter, notasFilter]);

  // Totales optimizados
  const totalPendientes = useMemo(
    () => pendientesRows.reduce((sum, r) => sum + (Number(r.valor) || 0), 0),
    [pendientesRows]
  );

  const totalConfirmacion = useMemo(
    () => confirmacionRows.reduce((sum, r) => sum + (Number(r.valor) || 0), 0),
    [confirmacionRows]
  );

  const totalEfectivo = useMemo(
    () =>
      computedEfectivoRows.reduce((sum, r) => sum + (Number(r.valor) || 0), 0),
    [computedEfectivoRows]
  );

  const totalConteoEfectivo = useMemo(() => {
    const cents = SAFE_DENOMS.reduce((acc, k) => {
      const valorCents = Math.round(keyToValue(k) * 100);
      const qty = Number(conteoEfectivo[k]) || 0;
      return acc + valorCents * qty;
    }, 0);
    return cents / 100;
  }, [conteoEfectivo]);

  const clearFilters = useCallback(() => {
    setDir3Filter("");
    setDateFrom(null);
    setDateTo(null);
    setMontoFilter("");
    setNotasFilter("");
    setCurrentPageEfectivo(1);
  }, []);

  // Direcciones para datalist
  const direccionChoices = useMemo(() => {
    const dirs = new Set();
    clients.forEach((c) => {
      if (c.direccion) dirs.add(c.direccion);
    });
    return [...dirs].sort();
  }, [clients]);

  const resetConteoEfectivo = useCallback(() => {
  const zeros = Object.fromEntries(SAFE_DENOMS.map((k) => [k, 0]));

  Swal.fire({
    title: "¿Reiniciar conteo?",
    html: "Esto pondrá todas las cantidades en <b>0</b>.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, reiniciar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    focusCancel: true,
    allowOutsideClick: false,
  }).then(async (result) => {
    if (!result.isConfirmed) return;

    // guardamos el estado actual para poder revertir en caso de error
    const prevState = conteoEfectivo;

    // optimista: actualiza UI
    setConteoEfectivo(zeros);

    try {
      await set(ref(database, "cobranzaefectivototal"), zeros);
      Swal.fire("Listo", "El contador fue reiniciado.", "success");
    } catch (err) {
      console.error("Error reseteando conteo:", err);
      // rollback
      setConteoEfectivo(prevState);
      Swal.fire("Error", "No se pudo reiniciar el contador.", "error");
    }
  });
}, [conteoEfectivo]);


  // CSS embebido (no requiere archivo externo)
  const styles = `
    /* Utils */
    .text-center { text-align: center; }

    /* Row contenedor de tablas */
    .tables-row { 
      display: flex; 
      flex-direction: row; 
      gap: 20px; 
      overflow-x: auto;
      overflow-y: visible;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      min-width: 100%;
    }

    /* Tarjeta de paginación */
    .pagination-card { margin-top: 15px; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef; }
    .pagination-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .page-info { color: #495057; font-size: 14px; font-weight: 500; }
    .page-size { display: flex; align-items: center; gap: 8px; background: #fff; padding: 6px 12px; border-radius: 6px; border: 1px solid #dee2e6; }
    .pagination-bottom { display: flex; justify-content: center; align-items: center; gap: 6px; }
    .page-btn { padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; background: #fff; color: #495057; cursor: pointer; font-size: 14px; font-weight: 500; }
    .page-btn[disabled] { background: #f8f9fa; color: #6c757d; cursor: not-allowed; }
    .page-status { padding: 8px 16px; background: #007bff; color: #fff; border-radius: 6px; font-size: 14px; font-weight: 600; min-width: 120px; text-align: center; }

    /* Inputs / Selects */
    .input, .select { width: 100%; padding: 6px 8px; font-size: 12px; border-radius: 4px; background: #fff; box-sizing: border-box; }
    .input-sm, .select-sm { padding: 4px 6px; font-size: 12px; border: none; }
    .input-center { text-align: center; }
    .input-dir { min-width: 140px; }
    .input-notes { min-width: 100px; }
    .input-date { width: 100%; min-width: 120px; }

    /* Botones (reutilizamos tus clases) */
    .filter-button, .delete-button, .discard-filter-button, .create-table-button {
      border: none; color: #fff; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-weight: 600;
    }
    .filter-button { background: #007bff; }
    .delete-button { background: #dc3545; }
    .discard-filter-button { background: #6c757d; }
    .create-table-button { background: #28a745; width: 48px; height: 48px; font-size: 24px; display: flex; align-items: center; justify-content: center; }
    .btn-xs { font-size: 12px; padding: 0px 10px; margin: 2px; }

    /* Encabezados de tablas por color */
    .thead-danger th { background: #b90000ff; color: #fff; }
    .thead-info th { background: #007cb6ff; color: #fff; }
    .thead-success th { background: #006b04ff; color: #fff; }
    .thead-purple th { background: #6f42c1; color: #fff; }

    /* Ajustes del slidebar de filtros */
    .filter-slidebar h2, .filter-slidebar label { color: #fff; }

    /* Media Queries - Estilos para móviles (768px y menos) */
    @media (max-width: 768px) {
      /* Mantener scroll horizontal en móviles */
      .tables-row {
        overflow-x: auto !important;
        overflow-y: visible !important;
        -webkit-overflow-scrolling: touch !important;
        scroll-behavior: smooth !important;
        padding-bottom: 10px;
      }

      /* Asegurar que las tablas mantengan su ancho mínimo */
      .service-table {
        min-width: 300px;
        flex-shrink: 0;
      }
      /* Inputs y Selects más grandes en móviles */
      .input, .select {
        font-size: 13px !important;
        padding: 6px 8px;
        min-height: 32px;
      }
      
      .input-sm, .select-sm {
        font-size: 13px !important;
        padding: 4px 6px;
        min-height: 30px;
      }

      /* Inputs específicos de las tablas */
      .input-dir, .input-notes, .input-date, .input-center {
        font-size: 13px !important;
        min-height: 30px;
      }

      /* Todos los inputs dentro de las tablas */
      .service-table input[type="text"],
      .service-table input[type="number"],
      .service-table input[type="date"] {
        font-size: 13px !important;
        padding: 4px 6px;
        min-height: 30px;
      }

      /* Botones más grandes en móviles */
      .filter-button, .delete-button, .discard-filter-button {
        font-size: 13px;
        padding: 6px 12px;
        min-height: 32px;
      }

      .btn-xs {
        font-size: 13px !important;
        padding: 4px 8px !important;
        margin: 1px;
        min-height: 30px;
        min-width: 65px;
      }

      .create-table-button {
        width: 60px;
        height: 60px;
        font-size: 28px;
      }

      /* Texto de párrafos más grande */
      p {
        font-size: 13px !important;
      }

      /* Labels más grandes */
      label {
        font-size: 13px;
      }

      /* Headers de tabla más grandes - TODOS los th */
      .service-table th {
        font-size: 13px !important;
        padding: 6px 4px;
      }

      .thead-danger th, .thead-info th, .thead-success th, .thead-purple th {
        font-size: 13px !important;
        padding: 6px 4px;
      }

      /* Controles de paginación más grandes */
      .page-info {
        font-size: 13px;
      }

      .page-btn {
        font-size: 13px;
        padding: 6px 10px;
        min-height: 32px;
      }

      .page-status {
        font-size: 13px;
        padding: 6px 12px;
        min-height: 32px;
      }

      /* Select de items por página */
      .items-per-page-select {
        font-size: 13px;
        padding: 6px 8px;
        min-height: 32px;
      }

      /* Filtros en slidebar */
      .filter-slidebar h2 {
        font-size: 16px;
      }

      .filter-slidebar label {
        font-size: 13px;
      }

      /* Contenido de celdas de tabla */
      .service-table td {
        font-size: 13px;
      }

      /* Pagination info y controls */
      .pagination-info span {
        font-size: 13px;
      }

      .pagination-controls button {
        font-size: 13px;
        padding: 4px 8px;
        min-height: 32px;
      }

      .pagination-controls .page-info {
        font-size: 13px;
        padding: 4px 10px;
      }

      /* Pagination container */
      .pagination-container {
        font-size: 13px;
      }

      .pagination-info {
        font-size: 13px;
      }

      .pagination-controls {
        font-size: 13px;
      }

      /* Datalist options */
      datalist option {
        font-size: 13px;
      }

      /* Asegurar que todos los elementos de tabla sean legibles */
      .service-table {
        font-size: 13px;
      }

      .service-table tbody tr td {
        font-size: 13px !important;
        padding: 4px 3px;
      }
    }
  `;

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
      {/* ===== CSS embebido ===== */}
      <style>{styles}</style>

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
        <h2>Filtros</h2>
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
        <label>Dirección</label>
        <select
          className="select"
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
        <label>Monto</label>
        <input
          className="input"
          type="text"
          value={montoFilter}
          onChange={(e) => setMontoFilter(e.target.value)}
          placeholder="Filtrar por monto"
        />

        {/* Notas */}
        <label>Notas</label>
        <input
          className="input"
          type="text"
          value={notasFilter}
          onChange={(e) => setNotasFilter(e.target.value)}
          placeholder="Filtrar por notas"
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
            <div style={{ cursor: "default" }}>
              {new Date().toLocaleDateString()}
            </div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="table-container">
          {/* === TABLAS SEPARADAS CON FLEXBOX ROW === */}
          <div
            className="tables-row"
            style={{ 
              overflowX: 'auto', 
              overflowY: 'visible',
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch'
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
                  <tr className="thead-danger">
                    <th colSpan={5}>
                      PENDIENTES POR PAGAR - Total:{" "}
                      {formatMoney(totalPendientes)}
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: "40%" }}>Dirección</th>
                    <th style={{ width: "18%" }}>Monto</th>
                    <th style={{ width: "32%" }}>Notas</th>
                    <th style={{ width: "5%" }}>Avanzar</th>
                    <th style={{ width: "5%" }}>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientesRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center"
                        style={{ color: "#888" }}
                      >
                        Sin registros
                      </td>
                    </tr>
                  ) : (
                    pendientesRows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <input
                            type="text"
                            className="input input-sm input-dir"
                            defaultValue={r.direccion || ""}
                            onBlur={handleTextBlur(
                              r.id,
                              "direccion",
                              "pendientes"
                            )}
                            list={`dir-opt-1-${r.id}`}
                          />
                          <datalist id={`dir-opt-1-${r.id}`}>
                            {direccionChoices.map((d) => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input input-sm input-center"
                            defaultValue={formatMoney(r.valor || 0)}
                            onBlur={handleMoneyBlur(
                              r.id,
                              "valor",
                              "pendientes"
                            )}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input input-sm input-notes"
                            defaultValue={r.notas || ""}
                            onBlur={handleTextBlur(r.id, "notas", "pendientes")}
                          />
                        </td>
                        <td className="text-center">
                          <button
                            className="filter-button btn-xs"
                            onClick={() => move1to2(r.id)}
                            title="Mover a Confirmación"
                          >
                            →
                          </button>
                        </td>
                        <td className="text-center">
                          <button
                            className="delete-button btn-xs"
                            onClick={() => handleDeleteRow(r.id, "pendientes")}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ===== TABLA 2: CONFIRMACIÓN DE PAGOS ===== */}
            <div>
              <table className="service-table">
                <thead>
                  <tr className="thead-info">
                    <th colSpan={6}>
                      CONFIRMACIÓN DE PAGOS - Total:{" "}
                      {formatMoney(totalConfirmacion)}
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: "5%" }}>Devolver</th>
                    <th style={{ width: "38%" }}>Dirección</th>
                    <th style={{ width: "17%" }}>Monto</th>
                    <th style={{ width: "30%" }}>Notas</th>
                    <th style={{ width: "5%" }}>Avanzar</th>
                    <th style={{ width: "5%" }}>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmacionRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center"
                        style={{ color: "#888" }}
                      >
                        Sin registros
                      </td>
                    </tr>
                  ) : (
                    confirmacionRows.map((r) => (
                      <tr key={r.id}>
                        <td className="text-center">
                          <button
                            className="filter-button btn-xs"
                            onClick={() => move2to1(r.id)}
                            title="Devolver a Pendientes"
                          >
                            ←
                          </button>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input input-sm input-dir"
                            defaultValue={r.direccion || ""}
                            onBlur={handleTextBlur(
                              r.id,
                              "direccion",
                              "confirmacion"
                            )}
                            list={`dir-opt-2-${r.id}`}
                          />
                          <datalist id={`dir-opt-2-${r.id}`}>
                            {direccionChoices.map((d) => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input input-sm input-center"
                            defaultValue={formatMoney(r.valor || 0)}
                            onBlur={handleMoneyBlur(
                              r.id,
                              "valor",
                              "confirmacion"
                            )}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input input-sm input-notes"
                            defaultValue={r.notas || ""}
                            onBlur={handleTextBlur(
                              r.id,
                              "notas",
                              "confirmacion"
                            )}
                          />
                        </td>
                        <td className="text-center">
                          <button
                            className="filter-button btn-xs"
                            onClick={() => move2to3(r.id)}
                            title="Mover a Efectivo"
                          >
                            →
                          </button>
                        </td>
                        <td className="text-center">
                          <button
                            className="delete-button btn-xs"
                            onClick={() =>
                              handleDeleteRow(r.id, "confirmacion")
                            }
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ===== TABLA 3: EFECTIVO RECIBIDO ===== */}
            <div>
              <table className="service-table">
                <thead>
                  <tr className="thead-success">
                    <th colSpan={7}>
                      EFECTIVO RECIBIDO - Total: {formatMoney(totalEfectivo)}
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: "5%" }}>Volver</th>
                    <th style={{ width: "12%" }}>Fecha</th>
                    <th style={{ width: "30%" }}>Dirección/Nota</th>
                    <th style={{ width: "12%" }}>Monto</th>
                    <th style={{ width: "12%" }}>Saldo</th>
                    <th style={{ width: "24%" }}>Notas</th>
                    <th style={{ width: "5%" }}>Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEfectivo.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center"
                        style={{ color: "#888" }}
                      >
                        Sin registros
                      </td>
                    </tr>
                  ) : (
                    paginatedEfectivo.map((r) => (
                      <tr key={r.id}>
                        <td className="text-center">
                          <button
                            className="filter-button btn-xs"
                            onClick={() => move3to2(r.id)}
                            title="Devolver a Confirmación"
                          >
                            ←
                          </button>
                        </td>
                        <td>
                          <input
                            type="date"
                            className="input input-sm input-date"
                            defaultValue={dmyToInput(r.fecha)}
                            onBlur={handleDateBlur(r.id)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input input-sm input-dir"
                            defaultValue={r.direccion || ""}
                            onBlur={handleTextBlur(
                              r.id,
                              "direccion",
                              "efectivo"
                            )}
                            list={`dir-opt-3-${r.id}`}
                          />
                          <datalist id={`dir-opt-3-${r.id}`}>
                            {direccionChoices.map((d) => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="input input-sm input-center"
                            defaultValue={formatMoney(r.valor || 0)}
                            onBlur={handleMoneyBlur(r.id, "valor", "efectivo")}
                          />
                        </td>
                        <td className="text-center">
                          AWG{" "}
                          {r.saldo !== undefined
                            ? formatMoney(r.saldo)
                            : "0.00"}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input input-sm input-notes"
                            defaultValue={r.notas || ""}
                            onBlur={handleTextBlur(r.id, "notas", "efectivo")}
                          />
                        </td>
                        <td className="text-center">
                          <button
                            className="delete-button btn-xs"
                            onClick={() => handleDeleteRow(r.id, "efectivo")}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Controles de paginación Efectivo */}
              {totalItemsEfectivo > 0 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    <span>
                      Mostrando {startIndexEfectivo + 1} a{" "}
                      {Math.min(endIndexEfectivo, totalItemsEfectivo)} de{" "}
                      {totalItemsEfectivo} registros
                    </span>
                    <select
                      value={itemsPerPageEfectivo}
                      onChange={(e) =>
                        handleItemsPerPageChangeEfectivo(Number(e.target.value))
                      }
                      className="items-per-page-select"
                    >
                      <option value={25}>25 por página</option>
                      <option value={50}>50 por página</option>
                      <option value={100}>100 por página</option>
                    </select>
                  </div>

                  <div className="pagination-controls">
                    <button
                      onClick={goToFirstPageEfectivo}
                      disabled={currentPageEfectivo === 1}
                    >
                      ««
                    </button>
                    <button
                      onClick={goToPreviousPageEfectivo}
                      disabled={currentPageEfectivo === 1}
                    >
                      «
                    </button>
                    <span className="page-info">
                      Página {currentPageEfectivo} de {totalPagesEfectivo}
                    </span>
                    <button
                      onClick={goToNextPageEfectivo}
                      disabled={currentPageEfectivo === totalPagesEfectivo}
                    >
                      »
                    </button>
                    <button
                      onClick={goToLastPageEfectivo}
                      disabled={currentPageEfectivo === totalPagesEfectivo}
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
                  <tr className="thead-purple">
                    <th colSpan={3}>
                      CONTEO DE EFECTIVO - Total:{" "}
                      {formatMoney(totalConteoEfectivo)}
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: "40%" }}>Tipo de Efectivo</th>
                    <th style={{ width: "30%" }}>Cantidad</th>
                    <th style={{ width: "30%" }}>Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {SAFE_DENOMS.map((tipoKey) => {
                    const cantidad = Number(conteoEfectivo[tipoKey]) || 0;
                    const valor = keyToValue(tipoKey);
                    const montoTotal = valor * cantidad;

                    return (
                      <tr key={tipoKey}>
                        <td
                          className="text-center"
                          style={{ fontWeight: "bold" }}
                        >
                          {formatMoney(Number(keyToLabel(tipoKey)))}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="input input-sm input-center"
                            value={cantidad}
                            onChange={(e) =>
                              handleConteoChange(tipoKey, e.target.value)
                            }
                            onBlur={(e) =>
                              handleConteoChange(tipoKey, e.target.value)
                            }
                            placeholder="0"
                          />
                        </td>
                        <td
                          className="text-center"
                          style={{ fontWeight: "bold" }}
                        >
                          <p>
                            AWG {formatMoney(montoTotal)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={3} className="text-center">
                      <button
                        className="delete-button btn-xs"
                        onClick={resetConteoEfectivo}
                        title="Poner todas las cantidades en 0"
                      >
                        Reiniciar Cantidad
                      </button>
                    </td>
                  </tr>
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
