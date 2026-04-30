import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import {
  ref,
  set,
  push,
  onValue,
  runTransaction,
  get,
} from "firebase/database";
import { auditUpdate, auditSet, auditCreate } from "../utils/auditLogger";
import { sanitizeForLog } from "../utils/security";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { jsPDF } from "jspdf";
import Swal from "sweetalert2";
import autoTable from "jspdf-autotable";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import filtericon from "../assets/img/filters_icon.jpg";
import Select from "react-select";
import { isOperativeRole } from "../utils/roleUtils";
import logotipo from "../assets/img/logo.png";
import CotizacionViewEdit from "./CotizacionViewEdit";

// Función auxiliar para formatear números con formato 0,000.00
const formatCurrency = (amount) => {
  return Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const ITEM_RATES = {
  "Septic Tank": 80.0,
  "Pipes Cleaning": 125.0,
  Services: 0.0,
  "Grease Trap": 135.0,
  "Grease Trap & Pipe Cleanings": 135.0,
  "Septic Tank & Grease Trap": 135.0,
  "Dow Temporal": 25.0,
  "Water Truck": 160.0,
  Pool: 0.0,
};

const Cotizacion = () => {
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [loadedUsers, setLoadedUsers] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);
  const [loadedCotizaciones, setLoadedCotizaciones] = useState(false);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);
  const [editingRate, setEditingRate] = useState({});
  const [sortConfig, setSortConfig] = useState({
    key: "fecha",
    direction: "desc",
  });
  const [cotizacionesData, setCotizacionesData] = useState({});

  // Estado para el modal de vista/edición de cotización
  const [selectedCotizacion, setSelectedCotizacion] = useState(null);
  const [showCotizacionModal, setShowCotizacionModal] = useState(false);

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const getBase64ImageFromUrl = async (url) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const calculateDaysDelay = (timestamp, pagoStatus) => {
    if (pagoStatus === "Pago") return 0;
    const days = Math.floor((currentTime - timestamp) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  };

  const [invoiceConfig, setInvoiceConfig] = useState({
    companyName: "",
    city: "",
    country: "",
    postalCode: "",
    phone: "",
    email: "",
    bankInfo: "",
    footer: "",
  });

  const [filters, setFilters] = useState({
    numerodecotizacion: "",
    anombrede: [],
    direccion: [],
    fechaEmision: [null, null],
    diasdemora: [],
    cotizacion: "",
    personalizado: "",
    pago: [],
    fechaPago: [null, null],
    sinFechaPago: false,
  });

  // Estados locales para campos editables (onBlur)
  const [localValues, setLocalValues] = useState({});

  // Estados para fila activa donde el usuario está trabajando
  const [activeRow, setActiveRow] = useState(null);

  // Cargar "users" (excluyendo administradores y contadores)
  useEffect(() => {
    const dbRef = ref(database, "users");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedUsers = Object.entries(snapshot.val())
            .filter(([_, user]) => isOperativeRole(user.role))
          .map(([id, user]) => ({ id, name: user.name }));
        fetchedUsers.sort((a, b) => a.name.localeCompare(b.name));
        setUsers(fetchedUsers);
        setLoadedUsers(true);
      } else {
        setUsers([]);
      }
    });
    // limpia el listener al desmontar
    return unsubscribe;
  }, []);

  // Cargar clientes
  useEffect(() => {
    const clientsRef = ref(database, "clientes");
    const unsubscribe = onValue(clientsRef, (snap) => {
      if (snap.exists()) {
        const list = Object.entries(snap.val()).map(([id, c]) => ({
          id,
          direccion: c.direccion,
          cubicos: c.cubicos,
        }));
        setClients(list);
        setDirections([...new Set(list.map((c) => c.direccion))]);
      } else {
        setClients([]);
        setDirections([]);
      }
      setLoadedClients(true);
    });
    return unsubscribe;
  }, []);

  // ② Carga desde Firebase ("configuraciondecotizacion")
  useEffect(() => {
    const configRef = ref(database, "configuraciondecotizacion");
    return onValue(configRef, (snap) => {
      if (snap.exists()) setInvoiceConfig(snap.val());
    });
  }, []);

  // Cargar cotizaciones
  useEffect(() => {
    const cotizacionesRef = ref(database, "cotizaciones");
    const unsubscribe = onValue(cotizacionesRef, (snapshot) => {
      if (snapshot.exists()) {
        setCotizacionesData(snapshot.val());
      } else {
        setCotizacionesData({});
      }
      setLoadedCotizaciones(true);
    });
    return unsubscribe;
  }, []);

  // Cuando todas las fuentes de datos estén listas, oculta el loader
  useEffect(() => {
    if (loadedCotizaciones && loadedUsers && loadedClients) {
      setLoading(false);
    }
  }, [loadedCotizaciones, loadedUsers, loadedClients]);

  // Convertir cotizaciones a array plano
  const todos = Object.entries(cotizacionesData).map(([id, cotizacion]) => {
    // Generar fecha en formato DD-MM-YYYY desde timestamp o fechaEmision
    let fecha = "";
    if (cotizacion.fechaEmision) {
      // Si fechaEmision ya está en formato DD/MM/YYYY, convertir a DD-MM-YYYY
      if (cotizacion.fechaEmision.includes("/")) {
        fecha = cotizacion.fechaEmision.replace(/\//g, "-");
      } else if (cotizacion.fechaEmision.includes("-")) {
        // Si está en formato YYYY-MM-DD, convertir a DD-MM-YYYY
        const [y, m, d] = cotizacion.fechaEmision.split("-");
        fecha = `${d}-${m}-${y}`;
      }
    } else if (cotizacion.timestamp) {
      // Si no hay fechaEmision, usar timestamp
      const d = new Date(cotizacion.timestamp);
      fecha = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    }

    return {
      id,
      ...cotizacion,
      fecha, // Agregar campo fecha calculado
      origin: "cotizaciones",
    };
  });

  const anombredeOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(todos.map((r) => r.anombrede).filter(Boolean))
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const direccionOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(todos.map((r) => r.direccion).filter(Boolean))
    )
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  // 1) FILTRA ESE ARRAY
  const filtrados = todos.filter((r) => {
    // 0) Si activo “Sin fecha de pago”, sólo pasen registros SIN fechapago
    if (filters.sinFechaPago) {
      const fechaPagoStr = r.numerodecotizacion
        ? cotizacionesData[r.numerodecotizacion]?.fechapago
        : r.fechapago;
      if (fechaPagoStr) return false;
    }

    // 1) Filtrar por Fecha de Emisión (timestamp)
    const [emiStart, emiEnd] = filters.fechaEmision;
    if (emiStart && emiEnd) {
      const fechaEmi = new Date(r.timestamp);
      if (fechaEmi < emiStart || fechaEmi > emiEnd) return false;
    }

    // 3) Subcadena: número de cotizacion
    if (
      filters.numerodecotizacion &&
      !r.numerodecotizacion?.toString().includes(filters.numerodecotizacion)
    )
      return false;


    // 4) Multi-select: A Nombre De
    if (filters.anombrede.length > 0) {
      const matchAnombrede = filters.anombrede.some((valorFiltro) => {
        if (valorFiltro === "__EMPTY__") {
          return !r.anombrede || r.anombrede === "";
        }
        return r.anombrede === valorFiltro;
      });
      if (!matchAnombrede) return false;
    }

    // 5) Multi-select: Dirección
    if (filters.direccion.length > 0) {
      const matchDireccion = filters.direccion.some((valorFiltro) => {
        if (valorFiltro === "__EMPTY__") {
          return !r.direccion || r.direccion === "";
        }
        return r.direccion === valorFiltro;
      });
      if (!matchDireccion) return false;
    }

    // 6) Días de Mora
    if (filters.diasdemora.length > 0) {
      const dias = calculateDaysDelay(r.timestamp, r.pago);
      const matchDias = filters.diasdemora.some((valorFiltro) => {
        if (valorFiltro === "10+") {
          return dias >= 10;
        }
        return dias === parseInt(valorFiltro, 10);
      });
      if (!matchDias) return false;
    }

    // 7) Cotizacion sí/no
    if (filters.cotizacion !== "" && r.cotizacion !== (filters.cotizacion === "true"))
      return false;

    // 8) Subcadena: Personalizado
    if (
      filters.personalizado &&
      !r.personalizado
        ?.toLowerCase()
        .includes(filters.personalizado.toLowerCase())
    )
      return false;

    // 9) Multi-select: Pago
    if (filters.pago.length > 0) {
      const pagoValue = r.pago === "Pago" || r.pago === true; // Normalizar: "Pago" = true, otros = false
      if (!filters.pago.includes(pagoValue)) return false;
    }

    // 10) Filtrar por Fecha de Pago (r.fechapago formato "YYYY-MM-DD")
    const [pagoStart, pagoEnd] = filters.fechaPago;
    if (pagoStart && pagoEnd) {
      // Usar fecha de pago de la cotizacion si está ligado a una cotizacion, sino usar la fecha del servicio
      const fechaPagoStr = r.numerodecotizacion
        ? cotizacionesData[r.numerodecotizacion]?.fechapago
        : r.fechapago;

      if (!fechaPagoStr) return false;
      const [y, m, d] = fechaPagoStr.split("-");
      const fechaPago = new Date(+y, m - 1, +d);
      if (fechaPago < pagoStart || fechaPago > pagoEnd) return false;
    }

    return true;
  });

  // 2b) ORDENA el array plano según la configuración
  const sortedRecords = [...filtrados].sort((a, b) => {
    if (sortConfig.key === "numerodecotizacion") {
      // Obtener el número de cotizacion, considerando ambos campos
      const getCotizacionNumber = (registro) => {
        // Prioriza numerodecotizacion si existe, sino referenciaCotizacion, sino vacío
        return registro.numerodecotizacion || registro.referenciaCotizacion || "";
      };
      
      const numA = getCotizacionNumber(a);
      const numB = getCotizacionNumber(b);
      
      // Use localeCompare with numeric: true for proper number sorting
      // If numA or numB are empty, they will be treated as less than any number
      if (sortConfig.direction === "asc") {
        return numA.localeCompare(numB, undefined, { numeric: true });
      } else {
        return numB.localeCompare(numA, undefined, { numeric: true });
      }
    }
    
    // Default sort (by date)
    // Assuming 'fecha' is 'DD-MM-YYYY'
    const parseDate = (dateString) => {
      const [day, month, year] = dateString.split("-");
      return new Date(year, month - 1, day);
    };

    const dateA = parseDate(a.fecha);
    const dateB = parseDate(b.fecha);

    if (sortConfig.direction === "asc") {
      return dateA - dateB;
    } else {
      return dateB - dateA; // Descending by default for date
    }
  });

  // Cálculos de paginación
  const allRecords = sortedRecords;
  const totalItems = allRecords.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageRecords = allRecords.slice(startIndex, endIndex);

  // IMPORTANT: Only group by date for display if NOT sorting by invoice number
  const paginatedData = [];
  if (sortConfig.key === "numerodecotizacion") {
    // If sorting by invoice number, treat each record as its own "group"
    // to maintain a flat, sorted list for rendering.
    currentPageRecords.forEach((record) => {
      paginatedData.push({
        // Use a unique key for each record group
        fecha: `${record.origin}_${record.id}`,
        registros: [record],
      });
    });
  } else {
    // Reagrupar los registros paginados por fecha (original logic)
    const paginatedGrouped = currentPageRecords.reduce((acc, r) => {
      (acc[r.fecha] = acc[r.fecha] || []).push(r);
      return acc;
    }, {});
    Object.entries(paginatedGrouped)
      .map(([fecha, registros]) => ({ fecha, registros }))
      .sort((a, b) => {
        const [d1, m1, y1] = a.fecha.split("-");
        const [d2, m2, y2] = b.fecha.split("-");
        return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
      })
      .forEach((item) => paginatedData.push(item));
  }

  // Funciones de navegación
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setSelectedRows([]); // Limpiar selección al cambiar página
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
    setSelectedRows([]); // Limpiar selección
  };

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows([]);
  }, [filters]);

  // A partir de aquí utiliza paginatedData para mapear tu tabla…

  const handleRowSelection = (fecha, registroId, checked) => {
    const key = `${fecha}_${registroId}`;
    setSelectedRows((prev) => {
      const newSelections = { ...prev, [key]: checked };
      let totalRecords = 0;
      let selectedCount = 0;
      paginatedData.forEach((item) => {
        item.registros.forEach((registro) => {
          totalRecords++;
          if (newSelections[`${item.fecha}_${registro.id}`]) {
            selectedCount++;
          }
        });
      });
      setSelectAll(totalRecords === selectedCount);
      return newSelections;
    });
  };

  // Solo agrega una nueva dirección al cambiar el servicio
  const syncWithClients = (direccion, cubicos) => {
    const exists = clients.some((c) => c.direccion === direccion);
    if (!exists) {
      addClient(direccion, cubicos);
    }
  };

  const addClient = (direccion, cubicos) => {
    auditCreate("clientes", { direccion, cubicos }, {
      modulo: "Cotización",
      extra: `Cliente: ${direccion}`,
    }).catch((error) => {
      console.error("Error adding client: ", error);
    });
  };

  // Función para actualizar campos en cotizaciones
  function handleFieldChange(fecha, registroId, field, value, origin) {
    const safeValue = value ?? "";
    const updates = { [field]: safeValue };
    const prevData = cotizacionesData[registroId] || {};
    auditUpdate(`cotizaciones/${registroId}`, updates, {
      modulo: "Cotización",
      registroId,
      prevData,
    }).catch(console.error);
  }

  // Mostrar/ocultar slidebars
  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);

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

  // Función para actualizar estado de pago
  const handlePagoToggle = async (fecha, id, origin, checked) => {
    const newPagoValue = checked ? "Pago" : "Debe";
    const cotizacion = cotizacionesData[id];

    if (!cotizacion) return;

    const confirmTitle = checked
      ? `¿Deseas marcar la cotizacion #${cotizacion.numerodecotizacion} como pagada?`
      : `¿Deseas desmarcar el pago de la cotizacion #${cotizacion.numerodecotizacion}?`;

    const result = await Swal.fire({
      title: confirmTitle,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "No",
    });

    if (!result.isConfirmed) return;

    try {
      if (checked) {
        const fechaPagoFinal = new Date().toISOString().split("T")[0];
        await auditUpdate(`cotizaciones/${id}`, {
          payment: cotizacion.totalAmount,
          deuda: 0,
          pago: "Pago",
          fechapago: fechaPagoFinal,
        }, {
          modulo: "Cotización",
          registroId: id,
          prevData: cotizacion,
          extra: `Cotización #${cotizacion.numerodecotizacion} pagada`,
        });

        Swal.fire({
          icon: "success",
          title: "¡Cotizacion Pagada Completamente!",
          text: `Cotizacion #${cotizacion.numerodecotizacion} marcada como PAGADA`,
          timer: 2000,
        });
      } else {
        await auditUpdate(`cotizaciones/${id}`, {
          payment: 0,
          deuda: cotizacion.totalAmount,
          pago: "Debe",
          fechapago: null,
        }, {
          modulo: "Cotización",
          registroId: id,
          prevData: cotizacion,
          extra: `Cotización #${cotizacion.numerodecotizacion} desmarcada`,
        });

        Swal.fire({
          icon: "success",
          title: "Pago Desmarcado",
          text: `Cotizacion #${cotizacion.numerodecotizacion} marcada como DEBE`,
          timer: 2000,
        });
      }
    } catch (error) {
      console.error("Error actualizando pago:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el estado de pago",
      });
    }
  };

  // Manejo del DatePicker para rango de fechas
  const [showEmisionPicker, setShowEmisionPicker] = useState(false);

  const [showPagoPicker, setShowPagoPicker] = useState(false);

  const handleEmisionChange = (dates) => {
    const [start, end] = dates;
    setFilters((prev) => ({
      ...prev,
      fechaEmision: [
        start
          ? new Date(
              start.getFullYear(),
              start.getMonth(),
              start.getDate(),
              0,
              0,
              0
            )
          : null,
        end
          ? new Date(
              end.getFullYear(),
              end.getMonth(),
              end.getDate(),
              23,
              59,
              59
            )
          : null,
      ],
    }));
  };

  const handlePagoChange = (dates) => {
    const [start, end] = dates;
    setFilters((prev) => ({
      ...prev,
      fechaPago: [
        start
          ? new Date(
              start.getFullYear(),
              start.getMonth(),
              start.getDate(),
              0,
              0,
              0
            )
          : null,
        end
          ? new Date(
              end.getFullYear(),
              end.getMonth(),
              end.getDate(),
              23,
              59,
              59
            )
          : null,
      ],
    }));
  };

  // FILTRADO
  const toggleFilterSlidebar = () => setShowFilterSlidebar((v) => !v);

  useEffect(() => {
    const handler = (e) => {
      if (
        filterSlidebarRef.current &&
        !filterSlidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-filter-slidebar-button")
      ) {
        setShowFilterSlidebar(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // …tras anombredeOptions y direccionOptions…
  const nameOptions = anombredeOptions;
  const directionOptions = direccionOptions;

  const moraOptions = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => ({ value: n.toString(), label: n.toString() }))
    .concat({ value: "10+", label: "10+" });

  // SELECCIÓN - Mantener orden de selección
  const handleSelectRow = (id) => {
    setSelectedRows((prev) => {
      if (prev.includes(id)) {
        // Si ya está seleccionado, quitarlo
        return prev.filter((x) => x !== id);
      } else {
        // Si no está seleccionado, agregarlo al final (mantiene orden)
        return [...prev, id];
      }
    });
  };

  // Funciones para manejar la fila activa donde el usuario está trabajando
  const handleRowEdit = (rowId) => {
    setActiveRow(rowId);
  };

  const handleRowEditEnd = () => {
    setActiveRow(null);
  };

  // Función para abrir el modal de vista/edición de cotizacion
  const openCotizacionModal = (numeroCotizacion) => {
    setSelectedCotizacion(numeroCotizacion);
    setShowCotizacionModal(true);
  };

  const closeCotizacionModal = () => {
    setSelectedCotizacion(null);
    setShowCotizacionModal(false);
  };

  // Función para payment rápido desde la tabla
  const paymentRapido = async (numeroCotizacion) => {
    if (!numeroCotizacion) {
      Swal.fire({
        icon: "warning",
        title: "Sin cotización",
        text: "Este registro no tiene una cotizacion asociada",
      });
      return;
    }

    // Obtener datos de la cotizacion
    const cotizacionRef = ref(database, `cotizaciones/${numeroCotizacion}`);
    const cotizacionSnapshot = await get(cotizacionRef);

    if (!cotizacionSnapshot.exists()) {
      Swal.fire({
        icon: "error",
        title: "Cotizacion no encontrada",
        text: "No se pudo encontrar la información de la cotizacion",
      });
      return;
    }

    const cotizacionData = cotizacionSnapshot.val();

    if (cotizacionData.deuda <= 0) {
      Swal.fire({
        icon: "info",
        title: "Cotizacion ya pagada",
        text: "Esta cotizacion ya está completamente pagada",
      });
      return;
    }

    const { value: montoPayment } = await Swal.fire({
      title: "Payment Rápido",
      html: `
        <div style="text-align: left; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Cotizacion:</strong></span>
            <span style="color: #2196F3; font-weight: bold;">#${numeroCotizacion}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Total:</strong></span>
            <span>AWG ${formatCurrency(cotizacionData.totalAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Payments:</strong></span>
            <span style="color: #28a745;">AWG ${formatCurrency(
              cotizacionData.payment || 0
            )}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-top: 8px; border-top: 1px solid #dee2e6;">
            <span><strong>Deuda:</strong></span>
            <span style="color: #dc3545; font-weight: bold;">AWG ${formatCurrency(
              cotizacionData.deuda
            )}</span>
          </div>
        </div>
        <div style="margin-bottom: 10px;">
          <input id="monto-payment-rapido" type="number" class="swal2-input" placeholder="Monto del payment" min="0" step="0.01" style="margin: 0;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button type="button" id="mitad-rapido" class="swal2-confirm swal2-styled" style="background-color: #17a2b8;">50%</button>
          <button type="button" id="total-rapido" class="swal2-confirm swal2-styled" style="background-color: #28a745;">Total</button>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Registrar Payment",
      cancelButtonText: "Cancelar",
      didOpen: () => {
        const montoInput = document.getElementById("monto-payment-rapido");
        const mitadBtn = document.getElementById("mitad-rapido");
        const totalBtn = document.getElementById("total-rapido");

        mitadBtn.onclick = () => {
          montoInput.value = (cotizacionData.deuda / 2).toFixed(2);
        };

        totalBtn.onclick = () => {
          montoInput.value = cotizacionData.deuda.toFixed(2);
        };

        montoInput.focus();
      },
      preConfirm: () => {
        const value = document.getElementById("monto-payment-rapido").value;
        if (!value || parseFloat(value) <= 0) {
          Swal.showValidationMessage("Debe ingresar un monto válido mayor a 0");
          return false;
        }
        if (parseFloat(value) > cotizacionData.deuda) {
          Swal.showValidationMessage(
            "El payment no puede ser mayor que la deuda actual"
          );
          return false;
        }
        return parseFloat(value);
      },
    });

    if (!montoPayment) return;

    try {
      const payment = parseFloat(montoPayment);
      const nuevosPayments = (cotizacionData.payment || 0) + payment;
      const nuevaDeuda = Math.max(0, cotizacionData.totalAmount - nuevosPayments);
      const cotizacionCompletamentePagada = nuevaDeuda === 0;

      // Actualizar la cotizacion
      const cotizacionUpdates = {
        payment: parseFloat(nuevosPayments.toFixed(2)),
        deuda: parseFloat(nuevaDeuda.toFixed(2)),
      };

      const fechaPagoFinal =
        cotizacionData.fechapago || new Date().toISOString().split("T")[0];
      if (cotizacionCompletamentePagada) {
        cotizacionUpdates.pago = "Pago";
        cotizacionUpdates.fechapago = fechaPagoFinal;
      }

      await auditUpdate(`cotizaciones/${numeroCotizacion}`, cotizacionUpdates, {
        modulo: "Cotización",
        registroId: numeroCotizacion,
        prevData: cotizacionData,
        extra: `Payment rápido AWG ${payment} en Cotización #${numeroCotizacion}`,
      });

      // Solo actualiza la cotizacion, sin propagarse a otros servicios

      // Mostrar mensaje de éxito
      if (cotizacionCompletamentePagada) {
        Swal.fire({
          icon: "success",
          title: "¡Cotizacion Pagada Completamente!",
          html: `
            <div style="text-align: center;">
              <p>Se registró un payment de <strong>AWG ${formatCurrency(
                payment
              )}</strong></p>
              <p style="color: #28a745; font-weight: bold;">✅ Cotizacion #${numeroCotizacion} marcada como PAGADA</p>
              <p style="font-size: 14px; color: #6c757d;">Todos los servicios asociados fueron actualizados</p>
            </div>
          `,
          timer: 3000,
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "Payment Registrado",
          text: `Payment de AWG ${formatCurrency(
            payment
          )} registrado. Deuda restante: AWG ${formatCurrency(nuevaDeuda)}`,
          timer: 2000,
        });
      }
    } catch (error) {
      console.error("Error registrando payment:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo registrar el payment",
      });
    }
  };

  const openConfigModal = () => {
    Swal.fire({
      title: "Configuración de la cotizacion",
      html:
        // Campo para "Nombre de la empresa"
        `<input
         id="swal-company"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Nombre de la empresa"
         value="${invoiceConfig.companyName || ""}"
       >` +
        // Campo para "Direccion"
        `<input
         id="swal-address"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Dirección"
         value="${invoiceConfig.address || ""}"
       >` +
        // Campo para "País"
        `<input
         id="swal-country"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="País"
         value="${invoiceConfig.country || ""}"
       >` +
        // Campo para "Ciudad"
        `<input
         id="swal-city"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Ciudad"
         value="${invoiceConfig.city || ""}"
       >` +
        // Campo para "Código Postal"
        `<input
         id="swal-postal"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Código Postal"
         value="${invoiceConfig.postalCode || ""}"
       >` +
        // Campo para "Teléfono"
        `<input
         id="swal-phone"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Teléfono"
         value="${invoiceConfig.phone || ""}"
       >` +
        // Campo para "Correo electrónico"
        `<input
         id="swal-email"
         type="email"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Correo electrónico"
         value="${invoiceConfig.email || ""}"
       >` +
        // Campo para "Bank Info"
        `<textarea
         id="swal-bank"
         class="swal2-textarea"
         style="width: 80%;"
         placeholder="Bank Info"
       >${invoiceConfig.bankInfo || ""}</textarea>` +
        // Campo para "Pie de página"
        `<textarea
         id="swal-footer"
         class="swal2-textarea"
         style="width: 80%;"
         placeholder="Pie de página"
       >${invoiceConfig.footer || ""}</textarea>`,
      focusConfirm: false,
      preConfirm: () => {
        // Simplemente recogemos todos los valores, sin validarlos
        const companyName = document
          .getElementById("swal-company")
          .value.trim();
        const address = document.getElementById("swal-address").value.trim();
        const country = document.getElementById("swal-country").value.trim();
        const city = document.getElementById("swal-city").value.trim();
        const postalCode = document.getElementById("swal-postal").value.trim();
        const phone = document.getElementById("swal-phone").value.trim();
        const email = document.getElementById("swal-email").value.trim();
        const bankInfo = document.getElementById("swal-bank").value.trim();
        const footer = document.getElementById("swal-footer").value.trim();

        return {
          companyName,
          address,
          country,
          city,
          postalCode,
          phone,
          email,
          bankInfo,
          footer,
        };
      },
    }).then((res) => {
      if (res.isConfirmed) {
        // Actualizamos el estado local
        setInvoiceConfig(res.value);

        auditSet("configuraciondecotizacion", res.value, {
          modulo: "Cotización",
          accion: "editar",
          registroId: "configuraciondecotizacion",
          extra: "Configuración de cotización actualizada",
        }).catch(console.error);

        Swal.fire({
          title: "¡Configuración guardada!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Toggle direction if same key is clicked
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      // Set new key with default 'asc' direction
      return { key, direction: "asc" };
    });
  };



  // Generar cotizacion usando datos de la cotizacion asociada
  const generatePDF = async () => {
    // 1) Validar selección
    if (selectedRows.length === 0) {
      return Swal.fire({
        title: "No hay registros seleccionados",
        text: "Seleccione al menos uno para generar la cotizacion.",
        icon: "warning",
        confirmButtonText: "Aceptar",
      });
    }

    // 2) Obtener datos seleccionados y usar el PRIMER registro seleccionado como base
    const allRecs = sortedRecords || sortedRecords.flatMap((g) => g.registros);
    const selectedData = allRecs.filter((r) => selectedRows.includes(r.id));

    // ✅ Usar el primer ID de selectedRows (mantiene orden de selección)
    const firstSelectedId = selectedRows[0];
    const base = allRecs.find((r) => r.id === firstSelectedId);

    if (!base) {
      return Swal.fire({
        title: "Error",
        text: "No se pudo encontrar el primer registro seleccionado.",
        icon: "error",
        confirmButtonText: "Aceptar",
      });
    }

    // 3) Validar que la cotizacion existe
    if (!base.numerodecotizacion && !base.referenciaCotizacion) {
      return Swal.fire({
        title: "Sin cotización asociada",
        text: "El primer registro seleccionado no tiene una cotizacion asociada.",
        icon: "warning",
        confirmButtonText: "Aceptar",
      });
    }

    // 4) Preguntar por el To
    const { value: billToResult } = await Swal.fire({
      title: "To:",
      html: `
        <select id="bill-to-type" class="swal2-select" style="width:75%;">
          <option value="" disabled selected>Elija…</option>
          <option value="anombrede">A Nombre De</option>
          <option value="direccion">Dirección</option>
          <option value="personalizado">Personalizado</option>
        </select>
        <input id="bill-to-custom" class="swal2-input"
               placeholder="Texto personalizado"
               style="display:none; width:70%; margin:0.5em auto 0;"
        />`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const type = document.getElementById("bill-to-type").value;
        const custom = document.getElementById("bill-to-custom").value.trim();
        if (!type) {
          Swal.showValidationMessage("Seleccione un tipo");
          return false;
        }
        if (type === "personalizado" && !custom) {
          Swal.showValidationMessage("Escriba el texto personalizado");
          return false;
        }

        // etiquetas legibles para el error
        const labels = {
          anombrede: "A Nombre De",
          direccion: "Dirección",
        };

        // Validar que hay datos para el tipo seleccionado
        if (
          (type === "anombrede" && !base?.anombrede) ||
          (type === "direccion" && !base?.direccion)
        ) {
          Swal.showValidationMessage(
            `No hay datos para generar cotizacion con '${labels[type]}'.`
          );
          return false;
        }

        return { billToType: type, customValue: custom };
      },
      didOpen: () => {
        const sel = document.getElementById("bill-to-type");
        const inp = document.getElementById("bill-to-custom");
        sel.addEventListener("change", (e) => {
          inp.style.display =
            e.target.value === "personalizado" ? "block" : "none";
        });
      },
    });

    if (!billToResult) return; // canceló o no pasó validación

    // 5) Calcular To
    let billToValue = "";
    switch (billToResult.billToType) {
      case "anombrede":
        billToValue = base.anombrede;
        break;
      case "direccion":
        billToValue = base.direccion;
        break;
      case "personalizado":
        billToValue = billToResult.customValue;
        break;
    }

    try {
      // 6) Obtener datos de la cotizacion desde el nodo /cotizaciones/
      const cotizacionRef = ref(database, `cotizaciones/${base.numerodecotizacion}`);
      const cotizacionSnapshot = await get(cotizacionRef);

      if (!cotizacionSnapshot.exists()) {
        return Swal.fire({
          title: "Cotizacion no encontrada",
          text: `No se encontró la cotizacion #${base.numerodecotizacion}`,
          icon: "error",
          confirmButtonText: "Aceptar",
        });
      }

      const cotizacionData = cotizacionSnapshot.val();

      // 7) Usar datos del primer registro para información básica
      const pagoStatus = base.pago === "Pago" ? "Pago" : "Debe";

      // 8) Preparar filas usando los items de la cotizacion
      const filas = [];
      if (cotizacionData.invoiceItems) {
        Object.entries(cotizacionData.invoiceItems).forEach(([key, item]) => {
          filas.push([
            item.fechaServicioItem || base.fecha,
            item.item || "",
            item.descripcion || "",
            item.qty != null ? item.qty.toString() : "",
            item.rate != null ? (parseFloat(item.rate) || 0).toFixed(2) : "",
            item.amount != null ? formatCurrency(item.amount) : "",
          ]);
        });
      } else {
        // Si no hay items en la cotizacion, mostrar mensaje
        return Swal.fire({
          title: "Cotizacion sin items",
          text: "La cotizacion no tiene items para mostrar.",
          icon: "warning",
          confirmButtonText: "Aceptar",
        });
      }

      const totalAmount = cotizacionData.totalAmount || 0;
      const invoiceId = base.numerodecotizacion;

      // 9) Generar PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const mL = 10,
        mT = 10;

      // Obtener logo en base64 y sus dimensiones originales
      const logo = await getBase64ImageFromUrl(logotipo);
      const img = new Image();
      img.src = logo;
      await new Promise((r) => (img.onload = r));

      // Ajustar altura fija y calcular ancho proporcional
      const logoHeight = 18; // por ejemplo 18 mm de alto
      const logoWidth = (img.width / img.height) * logoHeight;

      // Insertar logo
      pdf.addImage(logo, "PNG", mL, mT, logoWidth, logoHeight);

      // — Información de la empresa —
      const textX = mL + logoWidth + 5;
      pdf
        .setFontSize(16)
        .text(invoiceConfig.companyName || "Company Name", textX, mT + 5);
      pdf
        .setFontSize(10)
        .text(`Address: ${invoiceConfig.address || "Address"}`, textX, mT + 11)
        .text(
          `${invoiceConfig.city || "City"}, ${
            invoiceConfig.country || "Country"
          }, ${invoiceConfig.postalCode || "Postal Code"}`,
          textX,
          mT + 16
        )
        .text(`Tel: ${invoiceConfig.phone || "Phone"}`, textX, mT + 21)
        .text(`Email: ${invoiceConfig.email || "Email"}`, textX, mT + 26);

      // — Número y fecha —
      const today = new Date();
      pdf
        .setFontSize(12)
        .text(`QUOTATION: ${invoiceId}`, 152, mT + 35)
        .text(
          `DATE: ${
            cotizacionData.fechaEmision ||
            new Date(cotizacionData.timestamp).toLocaleDateString()
          }`,
          152,
          mT + 40
        );

      // — Bill To —
      const yBill = mT + logoHeight + 21;
      pdf.setFontSize(12).text("TO:", mL, yBill);

      const labelW = pdf.getTextWidth("TO:");
      pdf.setFontSize(10).text(billToValue, mL + labelW + 5, yBill);

      // — Tabla de ítems —
      autoTable(pdf, {
        head: [["DATE", "ITEM", "Descripción", "QTY", "RATE", "AMOUNT"]],
        body: filas,
        startY: yBill + 8,
        margin: { left: mL, right: 10 },
        theme: "grid",
        headStyles: { fillColor: [0, 164, 189], textColor: 255 },
        styles: {
          fontSize: 9,
          overflow: "linebreak",
        },
        columnStyles: {
          0: {
            // DATE
            cellWidth: 20,
            halign: "left",
          },
          1: {
            // ITEM
            cellWidth: 48,
            halign: "left",
          },
          2: {
            // Descripción
            cellWidth: 75,
            overflow: "linebreak",
          },
          3: {
            // QTY
            cellWidth: 12,
            halign: "center",
          },
          4: {
            // RATE
            cellWidth: 15,
            halign: "right",
          },
          5: {
            // AMOUNT
            cellWidth: 20,
            halign: "right",
          },
        },
      });

      // — Total y balance —
      const afterY = pdf.lastAutoTable.finalY;

      // Mostrar información financiera
      const hasPayment = cotizacionData && cotizacionData.payment > 0;

      pdf.setFontSize(10);

      if (hasPayment) {
        pdf.text(
          `PAYMENT: AWG ${formatCurrency(cotizacionData.payment)}`,
          152,
          afterY + 6
        );

        const balance = pagoStatus === "Pago" ? 0 : cotizacionData.deuda || 0;
        pdf.text(
          `TOTAL: AWG ${formatCurrency(balance)}`,
          152,
          afterY + 11
        );
      } else {
        const balance = pagoStatus === "Pago" ? 0 : cotizacionData.deuda || 0;
        pdf.text(
          `TOTAL: AWG ${formatCurrency(balance)}`,
          152,
          afterY + 6
        );
      }

      // — Bank Info y footer —
      const bankY = afterY + 6;
      pdf.setFontSize(10).text("Bank Info:", mL, bankY);
      pdf
        .setFontSize(9)
        .text(
          pdf.splitTextToSize(invoiceConfig.bankInfo || "Bank Info", 80),
          mL,
          bankY + 6
        );
      const footerText = (invoiceConfig.footer || "").replace(/\r?\n/g, " ");
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      pdf
        .setFontSize(10)
        .text(footerText, (w - pdf.getTextWidth(footerText)) / 2, h - 10);

      // — Marca de agua PAID y fecha de pago —
      if (pagoStatus === "Pago") {
        const wPt = pdf.internal.pageSize.getWidth();
        const hPt = pdf.internal.pageSize.getHeight();
        const SCALE = 3;
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(wPt * SCALE);
        canvas.height = Math.floor(hPt * SCALE);
        const ctx = canvas.getContext("2d");

        ctx.scale(SCALE, SCALE);
        ctx.translate(wPt / 2, hPt / 2);
        ctx.rotate(Math.PI / 6);
        ctx.globalAlpha = 0.3;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "16px Arial";
        ctx.fillStyle = "green";
        ctx.fillText("PAID", 0, 0);

        const fechaPagoDisplay =
          base.fechapago || cotizacionData.fechapago || today.toLocaleDateString();
        ctx.globalAlpha = 0.4;
        ctx.font = "5px Arial";
        ctx.fillStyle = "green";
        ctx.fillText(fechaPagoDisplay, 0, 10);

        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, wPt, hPt);
      }

      // — Guarda el PDF —
      pdf.save(`Quotation-${invoiceId}.pdf`);

      // Mostrar mensaje de éxito
      Swal.fire({
        icon: "success",
        title: "PDF Generado",
        text: `La cotizacion #${invoiceId} se ha generado correctamente.`,
        timer: 2000,
      });
    } catch (error) {
      console.error("Error generando PDF:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo generar el PDF de la cotizacion. Inténtelo nuevamente.",
      });
    }
  };

  const addEmptyInvoice = async () => {
    // 1. Calcular número de cotizacion estimado
    const availableNumsRef = ref(database, "contadorCotizacion");
    let invoiceIdEstimado = null;
    let usedAvailableKey = null;

    const availableSnapshot = await get(availableNumsRef);

    if (availableSnapshot.exists()) {
      // Hay números disponibles, usar el menor para mostrar
      const availableData = availableSnapshot.val();
      const sortedAvailable = Object.entries(availableData).sort(
        ([, a], [, b]) => a.numeroCotizacion.localeCompare(b.numeroCotizacion)
      );
      if (sortedAvailable.length > 0) {
        const [key, numeroData] = sortedAvailable[0];
        invoiceIdEstimado = numeroData.numeroCotizacion;
        usedAvailableKey = key;
      }
    }
    
    if (!invoiceIdEstimado) {
      // No hay números disponibles, calcular el siguiente número secuencial
      const contadorRef = ref(database, "contadorCotizacion");
      const contadorSnapshot = await get(contadorRef);
      const numeroEstimado = (contadorSnapshot.val() || 0) + 1;

      // Formatear número de cotizacion estimado
      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const seq = String(numeroEstimado).padStart(5, "0");
      invoiceIdEstimado = `${yy}${mm}${seq}`;
    }

    const today = new Date();

    const direccionesOptions = directions
      .sort()
      .map((dir) => `<option value="${dir}">${dir}</option>`)
      .join("");

    // 2. Mostrar modal para ingresar datos de la cotizacion manual
    const { value: res } = await Swal.fire({
      title: "Crear Cotizacion Manual",
      html:
        `<div style="margin-bottom:15px;padding:12px;border:1px solid #ddd;border-radius:5px;background-color:#f9f9f9;">
          <h4 style="margin:0 0 10px 0;color:#333;">Nueva Cotizacion Manual</h4>
          <div style="text-align: center; margin-top: 8px;">
            <span style="padding:8px 16px;border-radius:20px;font-weight:bold;font-size:16px;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
              Cotizacion #${invoiceIdEstimado}
            </span>
          </div>
        </div>` +
        `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
          <label style="min-width:100px;font-size:14px;">Fecha Emisión:</label>
          <input id="fecha-emision" type="date" class="swal2-input" value="${
            today.toISOString().split("T")[0]
          }" style="width:150px;margin:0;font-size:12px;padding:4px 8px;" />
        </div>` +
        `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
          <label style="min-width:100px;font-size:14px;">A Nombre De:</label>
          <input id="anombrede" type="text" class="swal2-input" placeholder="Opcional" style="width:200px;margin:0;font-size:12px;padding:4px 8px;" />
        </div>` +
        `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
          <label style="min-width:100px;font-size:14px;">Dirección:</label>
          <input id="direccion" type="text" class="swal2-input" placeholder="Opcional" list="direcciones-list" style="width:200px;margin:0;font-size:12px;padding:4px 8px;" />
          <datalist id="direcciones-list">
            ${direccionesOptions}
          </datalist>
        </div>` +
        `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
          <label style="min-width:100px;font-size:14px;">Personalizado:</label>
          <input id="personalizado" type="text" class="swal2-input" placeholder="Opcional" style="width:200px;margin:0;font-size:12px;padding:4px 8px;" />
        </div>` +
        `<hr style="color:transparent;"/>` +
        `<label>To:</label>` +
        `<select id="bill-to-type" class="swal2-select" style="width:75%;">
         <option value="" disabled>Elija...</option>
         <option value="anombrede">A Nombre De</option>
         <option value="direccion" selected>Dirección</option>
         <option value="personalizado">Personalizado</option>
       </select>` +
        `<input id="bill-to-custom" class="swal2-input" placeholder="Texto personalizado" style="display:none; width:70%; margin:0.5em auto 0;" />` +
        `<hr/>` +
        `<label style="font-weight:bold; display:block; margin-bottom:10px;">Agregar Items:</label>` +
        `<div style="display: flex; align-items: center; gap: 10px; justify-content: center; margin-bottom: 15px;">
           <select id="swal-item-select" class="swal2-select" style="flex: 1;">
             <option value="" disabled selected>Seleccione un item...</option>
             ${Object.keys(ITEM_RATES)
               .map(
                 (i) =>
                   `<option value="${i}" ${
                     i === "Septic Tank" ? "selected" : ""
                   }>${i}</option>`
               )
               .join("")}
           </select>
           <button type="button" id="add-selected-item" class="swal2-confirm swal2-styled" style="flex-shrink: 0;">Agregar Item</button>
         </div>` +
        `<hr/>` +
        `<label style="font-weight:bold; display:block; margin-bottom:10px;">Items Agregados:</label>` +
        `<div id="added-items-summary" style="max-height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px; background: #f9f9f9;"></div>` +
        `<div style="text-align: right; font-weight: bold; font-size: 1.2em; margin-top: 10px;">
          Total: <span id="invoice-total">AWG 0.00</span>
         </div>`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const fechaEmision = document.getElementById("fecha-emision").value;
        const anombrede = document.getElementById("anombrede").value.trim();
        const direccion = document.getElementById("direccion").value.trim();
        const personalizado = document
          .getElementById("personalizado")
          .value.trim();
        const billToType = document.getElementById("bill-to-type").value;
        const customValue = document
          .getElementById("bill-to-custom")
          .value.trim();

        // Los items se recogen de la variable 'addedItems' que está en el scope de didOpen
        if (!window.addedItems || window.addedItems.length === 0) {
          Swal.showValidationMessage(
            "Debe agregar al menos un item a la cotizacion."
          );
          return false;
        }

        // Validaciones básicas (solo fecha de emisión es obligatoria)
        if (!fechaEmision) {
          Swal.showValidationMessage("Seleccione la fecha de emisión");
          return false;
        }
        if (!billToType) {
          Swal.showValidationMessage("Seleccione un tipo de To");
          return false;
        }
        if (billToType === "personalizado" && !customValue) {
          Swal.showValidationMessage(
            "Ingrese texto personalizado para To"
          );
          return false;
        }

        return {
          fechaEmision,
          anombrede,
          direccion,
          personalizado,
          cotizacionNumero: invoiceIdEstimado,
          billToType,
          customValue,
          items: window.addedItems,
        };
      },
      didOpen: () => {
        window.addedItems = []; // Almacenar items en un scope más accesible

        const sel = document.getElementById("bill-to-type");
        const inp = document.getElementById("bill-to-custom");
        sel.addEventListener("change", (e) => {
          inp.style.display =
            e.target.value === "personalizado" ? "block" : "none";
        });

        const summaryContainer = document.getElementById("added-items-summary");
        const totalEl = document.getElementById("invoice-total");

        const updateTotal = () => {
          const total = window.addedItems.reduce(
            (sum, item) => sum + item.amount,
            0
          );
          totalEl.textContent = `AWG ${formatCurrency(total)}`;
        };

        const renderSummary = () => {
          summaryContainer.innerHTML = "";
          if (window.addedItems.length === 0) {
            summaryContainer.innerHTML =
              '<p style="color: #888; text-align:center;">No hay items todavía.</p>';
          } else {
            window.addedItems.forEach((item, index) => {
              const itemDiv = document.createElement("div");
              itemDiv.style.cssText =
                "display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: 1px solid #eee;";
              itemDiv.innerHTML = `
                        <span><strong>${item.item}</strong> (x${
                item.qty
              }) - ${formatCurrency(
                item.amount
              )}<br><small style="color: #666;">Fecha: ${
                item.fechaServicioItem || "No especificada"
              }</small></span>
                        <div>
                          <button type="button" class="edit-summary-item" data-index="${index}" style="background-color: #3085d6; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; margin-right: 5px;">Editar</button>
                          <button type="button" class="remove-summary-item" data-index="${index}" style="background-color: #f27474; color: white; border: none; width: 25px; height: 25px; border-radius: 50%; font-weight: bold; cursor: pointer;">X</button>
                        </div>
                    `;
              summaryContainer.appendChild(itemDiv);
            });
          }
          updateTotal();
        };

        summaryContainer.addEventListener("click", (e) => {
          if (e.target.classList.contains("remove-summary-item")) {
            const indexToRemove = parseInt(
              e.target.getAttribute("data-index"),
              10
            );
            window.addedItems.splice(indexToRemove, 1);
            renderSummary();
          }
          if (e.target.classList.contains("edit-summary-item")) {
            const indexToEdit = parseInt(
              e.target.getAttribute("data-index"),
              10
            );
            const itemToEdit = window.addedItems[indexToEdit];

            showCustomItemModal(
              itemToEdit.item,
              (newDetails) => {
                const updatedItem = {
                  ...itemToEdit,
                  description: newDetails.description,
                  qty: newDetails.qty,
                  rate: newDetails.rate,
                  amount: newDetails.qty * newDetails.rate,
                  fechaServicioItem: newDetails.fechaServicioItem,
                };
                window.addedItems[indexToEdit] = updatedItem;
                renderSummary();
              },
              itemToEdit // Pass existing details
            );
          }
        });

        const showCustomItemModal = (
          itemType,
          callback,
          existingDetails = null
        ) => {
          const modalOverlay = document.createElement("div");
          modalOverlay.id = "custom-modal-overlay";
          modalOverlay.style.cssText =
            "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2000; display: flex; align-items: center; justify-content: center;";

          const modalContent = document.createElement("div");
          modalContent.style.cssText =
            "background: white; padding: 25px; border-radius: 8px; width: 90%; max-width: 450px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);";

          modalContent.innerHTML = `
                <h3 style="margin-top:0; margin-bottom: 20px; text-align:center;">Detalles para ${itemType}</h3>
                <textarea id="custom-item-description" class="swal2-textarea" placeholder="Descripción del servicio" style="display:block; width:95%; min-height: 80px; margin-bottom: 10px;"></textarea>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom: 10px;">
                  <input id="custom-item-qty" type="number" class="swal2-input" placeholder="Qty" value="1" min="1">
                  <input id="custom-item-rate" type="number" class="swal2-input" placeholder="Rate" value="${(
                    ITEM_RATES[itemType] || 0
                  ).toFixed(2)}" min="0" step="0.01">
                </div>
                <div style="margin-bottom: 10px;">
                  <label style="display:block; margin-bottom: 5px; font-weight: bold;">Fecha de Servicio:</label>
                  <input id="custom-item-fecha-servicio" type="date" class="swal2-input" value="${
                    today.toISOString().split("T")[0]
                  }" style="width:100%;">
                </div>
                <div style="text-align: right; margin-top: 25px;">
                  <button type="button" id="cancel-custom-item" class="swal2-cancel swal2-styled" style="margin-right: 10px;">Cancelar</button>
                  <button type="button" id="save-custom-item" class="swal2-confirm swal2-styled">Guardar</button>
                </div>
            `;

          modalOverlay.appendChild(modalContent);
          document.body.appendChild(modalOverlay);

          if (existingDetails) {
            document.getElementById("custom-item-description").value =
              existingDetails.description || "";
            document.getElementById("custom-item-qty").value =
              existingDetails.qty;
            document.getElementById("custom-item-rate").value =
              existingDetails.rate;
            if (existingDetails.fechaServicioItem) {
              document.getElementById("custom-item-fecha-servicio").value =
                existingDetails.fechaServicioItem;
            }
          }

          const close = () => {
            const overlay = document.getElementById("custom-modal-overlay");
            if (overlay) {
              document.body.removeChild(overlay);
            }
          };

          document.getElementById("save-custom-item").onclick = () => {
            const details = {
              description: document.getElementById("custom-item-description")
                .value,
              qty:
                parseFloat(document.getElementById("custom-item-qty").value) ||
                0,
              rate:
                parseFloat(document.getElementById("custom-item-rate").value) ||
                0,
              fechaServicioItem: document.getElementById(
                "custom-item-fecha-servicio"
              ).value,
            };
            if (details.qty > 0) {
              callback(details);
            }
            close();
          };

          document.getElementById("cancel-custom-item").onclick = close;
        };

        document
          .getElementById("add-selected-item")
          .addEventListener("click", () => {
            const select = document.getElementById("swal-item-select");
            const selectedItem = select.value;
            if (selectedItem) {
              showCustomItemModal(selectedItem, (itemDetails) => {
                window.addedItems.push({
                  item: selectedItem,
                  description: itemDetails.description,
                  qty: itemDetails.qty,
                  rate: itemDetails.rate,
                  amount: itemDetails.qty * itemDetails.rate,
                  fechaServicioItem: itemDetails.fechaServicioItem,
                });
                renderSummary();
              });
              select.value = ""; // Reset dropdown
            } else {
              Swal.fire({
                toast: true,
                position: "top-end",
                icon: "info",
                title: "Por favor, seleccione un item del menú.",
                showConfirmButton: false,
                timer: 2000,
              });
            }
          });

        renderSummary(); // Render inicial
      },
    });

    if (!res) return; // Usuario canceló

    try {
      // 3. Obtener número de cotizacion final
      let invoiceIdFinal;
      let numeroCotizacion;

      if (usedAvailableKey) {
        // Usar número disponible
        invoiceIdFinal = invoiceIdEstimado;
        numeroCotizacion = parseInt(invoiceIdFinal.slice(-5));
        await auditSet(`contadorCotizacion/${usedAvailableKey}`, null, {
          modulo: "Cotización",
          accion: "eliminar",
          registroId: usedAvailableKey,
          extra: `Número disponible consumido para cotización #${invoiceIdFinal}`,
        });
      } else {
        // Generar nuevo número
        const contadorRef = ref(database, "contadorCotizacion");
        const tx = await runTransaction(contadorRef, (curr) => (curr || 0) + 1);
        numeroCotizacion = tx.snapshot.val();
        // Formatear YYMM + secuencia 5 dígitos
        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const seq = String(numeroCotizacion).padStart(5, "0");
        invoiceIdFinal = `${yy}${mm}${seq}`;
      }

      // 4. Calcular To
      let billToValue = "";
      switch (res.billToType) {
        case "anombrede":
          billToValue = res.anombrede;
          break;
        case "direccion":
          billToValue = res.direccion;
          break;
        case "personalizado":
          billToValue = res.customValue;
          break;
      }

      // 5. Calcular total
      const totalAmount = res.items.reduce((sum, item) => sum + item.amount, 0);

      // 6. Preparar invoiceItems para el nodo cotizacion
      const invoiceItems = {};
      res.items.forEach((item, index) => {
        invoiceItems[index + 1] = {
          item: item.item,
          descripcion: item.description,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
          fechaServicioItem: item.fechaServicioItem,
        };
      });

      // 7. Crear el nodo cotizacion
      const cotizacionData = {
        numerodecotizacion: invoiceIdFinal,
        timestamp: Date.now(),
        fechaEmision: res.fechaEmision,
        anombrede: res.anombrede || "",
        direccion: res.direccion || "",
        personalizado: res.personalizado || "",
        billTo: billToValue,
        invoiceItems: invoiceItems,
        totalAmount: totalAmount,
        payment: 0,
        deuda: totalAmount,
        pago: "Debe",
        fechapago: null,
      };

      await auditSet(`cotizaciones/${invoiceIdFinal}`, cotizacionData, {
        modulo: "Cotización",
        accion: "crear",
        registroId: invoiceIdFinal,
        extra: `Cotización manual #${invoiceIdFinal} creada`,
      });

      // La cotización ahora vive solo en /cotizaciones/

      Swal.fire({
        icon: "success",
        title: "Cotizacion Manual Creada",
        text: `Cotizacion #${invoiceIdFinal} creada exitosamente`,
        timer: 2000,
      });
    } catch (error) {
      console.error("Error creando cotizacion manual:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo crear la cotizacion manual",
      });
    }
  };

  // Función para eliminar cotización
  const cancelInvoice = async (numeroCotizacion) => {
    try {
      const { isConfirmed } = await Swal.fire({
        title: "¿Eliminar Cotización?",
        html: `
          <div style="text-align: left;">
            <p><strong>Cotización a eliminar:</strong> ${numeroCotizacion}</p>
            <p style="color: #d33; font-weight: bold;">⚠️ Esta acción:</p>
            <ul style="text-align: left; color: #d33;">
              <li>Eliminará completamente la cotización</li>
              <li>El número de cotización quedará disponible para reutilización</li>
            </ul>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, Eliminar Cotización",
        cancelButtonText: "No, Mantener",
        confirmButtonColor: "#d33",
        width: "600px",
      });

      if (!isConfirmed) return;

      // Eliminar la cotización
      await auditSet(`cotizaciones/${numeroCotizacion}`, null, {
        modulo: "Cotización",
        accion: "eliminar",
        registroId: numeroCotizacion,
        extra: `Cotización #${numeroCotizacion} eliminada`,
      });

      // Agregar el número a la lista de disponibles
      await auditCreate("cotizacionesDisponibles", {
        numeroCotizacion: numeroCotizacion,
        fechaCancelacion: Date.now(),
      }, {
        modulo: "Cotización",
        extra: `Cotización #${numeroCotizacion} agregada a disponibles`,
      });

      // Mostrar confirmación
      Swal.fire({
        icon: "success",
        title: "Cotización Eliminada Exitosamente",
        html: `
          <div style="text-align: left;">
            <p><strong>Cotización:</strong> ${numeroCotizacion}</p>
            <p><strong>Estado:</strong> El número de cotización quedó disponible para reutilización</p>
          </div>
        `,
        timer: 3000,
        width: "500px",
      });
    } catch (error) {
      console.error("Error eliminando cotización:", error);
      Swal.fire({
        icon: "error",
        title: "Error al Eliminar Cotización",
        text: "Hubo un error al eliminar la cotización. Por favor, inténtalo de nuevo.",
      });
    }
  };

  // Reloj interno
  useEffect(() => {
    setCurrentTime(Date.now());

    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 24 * 60 * 60 * 1000); // Actualiza cada 24 horas);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loadedClients && loadedCotizaciones) {
      setLoading(false);
    }
  }, [loadedClients, loadedCotizaciones]);

  // Early return: spinner mientras carga
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
      <div className="filter-button-wrapper">
        <img
          src={filtericon}
          className="show-filter-slidebar-button"
          alt="Filtros"
          onClick={toggleFilterSlidebar}
        />
      </div>
      <div
        ref={filterSlidebarRef}
        className={`filter-slidebar ${showFilterSlidebar ? "show" : ""}`}
      >
        <h2 style={{color:"white"}}>Filtros</h2>
        <br/>
        <hr/>
        <button
          type="button"
          className="filter-button"
          onClick={() => setShowEmisionPicker((v) => !v)}
          style={{ display: "block", margin: "0.5rem 0" }}
        >
          {showEmisionPicker
            ? "Ocultar selector"
            : "Filtrar Por Fecha De Emision"}
        </button>
        {showEmisionPicker && (
          <DatePicker
            selectsRange
            inline
            isClearable
            startDate={filters.fechaEmision[0]}
            endDate={filters.fechaEmision[1]}
            onChange={handleEmisionChange}
            placeholderText="Desde – Hasta"
          />
        )}
        <label>Número de Cotizacion</label>
        <input
          type="text"
          placeholder="Buscar por N° de cotizacion"
          value={filters.numerodecotizacion}
          onChange={(e) =>
            setFilters({ ...filters, numerodecotizacion: e.target.value })
          }
        />

        <label>A Nombre De</label>
        <Select
          isClearable
          isMulti
          options={nameOptions}
          placeholder="Selecciona nombre(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              anombrede: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.anombrede.map((v) => ({ value: v, label: v }))}
        />

        <label>Dirección</label>
        <Select
          isClearable
          isMulti
          options={directionOptions}
          placeholder="Selecciona dirección(es)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              direccion: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.direccion.map((v) => ({ value: v, label: v }))}
        />

        <button
          onClick={() =>
            setFilters({
              numerodecotizacion: "",
              anombrede: [],
              direccion: [],
              fechaEmision: [null, null],
              diasdemora: [],
              cotizacion: "",
              personalizado: "",
              pago: [],
              fechaPago: [null, null],
              sinFechaPago: false,
            })
          }
          className="discard-filter-button"
          style={{ marginTop: "1rem" }}
        >
          Descartar Filtros
        </button>
      </div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Cotizaciones Emitidas</h1>
          <div className="current-date">
            <div style={{cursor:"default"}}>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Seleccionar</th>
                <th>Fecha Emisión</th>
                <th>
                  <button
                    onClick={() => handleSort("numerodecotizacion")}
                    className="sort-button"
                    title="Ordenar por N° de Cotizacion"
                  >
                    Cotizacion
                    {sortConfig.key === "numerodecotizacion" &&
                      (sortConfig.direction === "asc" ? " ▲" : " ▼")}
                  </button>
                </th>
                <th>A Nombre De</th>
                <th>Personalizado</th>
                <th>Dirección</th>
                <th>Total Amount</th>
                <th>Ver/Editar</th>
                <th>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(({ fecha, registros }) => (
                <React.Fragment key={fecha}>
                  {registros.map((r) => (
                    <tr
                      key={`${r.origin}_${r.id}`}
                      className={`${activeRow === r.id ? "active-row" : ""}`}
                    >
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(r.id)}
                          onChange={() => handleSelectRow(r.id)}
                          style={{
                            width: "3ch",
                            height: "3ch",
                            marginLeft: "0%",
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        <input
                          type="date"
                          value={(() => {
                            if (r.fechaEmision) {
                              if (r.fechaEmision.includes("/")) {
                                const [day, month, year] = r.fechaEmision.split("/");
                                return `${year}-${month}-${day}`;
                              }
                              return r.fechaEmision;
                            }
                            const timestamp = new Date(r.timestamp);
                            return timestamp.toISOString().split("T")[0];
                          })()}
                          onChange={(e) => {
                            const [year, month, day] = e.target.value.split("-");
                            const fechaFormateada = `${day}/${month}/${year}`;
                            handleFieldChange(r.fecha, r.id, "fechaEmision", fechaFormateada, r.origin);
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => openCotizacionModal(r.numerodecotizacion)}
                          className="numero-factura-btn"
                          title="Ver/Editar cotizacion"
                        >
                          {r.numerodecotizacion}
                        </button>
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{ width: "16ch" }}
                          value={localValues[`${r.id}_anombrede`] ?? r.anombrede ?? ""}
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${r.id}_anombrede`]: e.target.value,
                            }))
                          }
                          onFocus={() => handleRowEdit(r.id)}
                          onBlur={(e) => {
                            handleRowEditEnd();
                            if (e.target.value !== (r.anombrede || "")) {
                              handleFieldChange(r.fecha, r.id, "anombrede", e.target.value, r.origin);
                            }
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{ width: "20ch" }}
                          value={localValues[`${r.id}_personalizado`] ?? r.personalizado ?? ""}
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${r.id}_personalizado`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.personalizado || "")) {
                              handleFieldChange(r.fecha, r.id, "personalizado", e.target.value, r.origin);
                            }
                          }}
                        />
                      </td>
                      <td>
                        <input
                          style={{ width: "18ch" }}
                          type="text"
                          list={`dirs-${r.id}`}
                          value={localValues[`${r.id}_direccion`] ?? r.direccion ?? ""}
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${r.id}_direccion`]: e.target.value,
                            }))
                          }
                          onFocus={() => handleRowEdit(r.id)}
                          onBlur={(e) => {
                            handleRowEditEnd();
                            if (e.target.value !== (r.direccion || "")) {
                              handleFieldChange(r.fecha, r.id, "direccion", e.target.value, r.origin);
                            }
                          }}
                        />
                        <datalist id={`dirs-${r.id}`}>
                          {directions.map((dir) => (
                            <option key={dir} value={dir} />
                          ))}
                        </datalist>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {formatCurrency(r.totalAmount || 0)} AWG
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => openCotizacionModal(r.numerodecotizacion)}
                          className="ver-editar-btn"
                          title="Ver/Editar cotización"
                        >
                          Ver/Editar
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => cancelInvoice(r.numerodecotizacion)}
                          className="cancelar-factura-btn"
                          title={`Eliminar cotizacion ${r.numerodecotizacion}`}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination-container">
          <div className="pagination-info">
            <span>
              Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de{" "}
              {totalItems} registros
            </span>
            <div className="items-per-page">
              <label>Mostrar:</label>
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  handleItemsPerPageChange(Number(e.target.value))
                }
              >
                <option value={25}>25</option>
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
          style={{
            textAlign: "right",
            gap: "1rem",
            marginLeft: "0px",
            display: "flex",
          }}
        >
          <button
            style={{
              backgroundColor: "#28a745",
              borderRadius: "5px",
              border: "none",
              padding: "10px",
              color: "white",
              cursor: "pointer",
            }}
            onClick={addEmptyInvoice}
          >
            Agregar Cotizacion
          </button>
          <button
            style={{
              backgroundColor: "#084cca",
              borderRadius: "5px",
              border: "none",
              padding: "10px",
              color: "white",
              cursor: "pointer",
            }}
            onClick={generatePDF}
          >
            Generar Cotizacion
          </button>
          <button
            style={{
              backgroundColor: "#ce6814",
              borderRadius: "5px",
              border: "none",
              padding: "10px",
              color: "white",
              cursor: "pointer",
            }}
            onClick={openConfigModal}
          >
            Configuración Cotizacion
          </button>
        </div>
      </div>



      {/* Modal de Vista/Edición de Cotizacion */}
      {showCotizacionModal && selectedCotizacion && (
        <CotizacionViewEdit
          numeroCotizacion={selectedCotizacion}
          onClose={closeCotizacionModal}
        />
      )}
    </div>
  );
};

export default React.memo(Cotizacion);
