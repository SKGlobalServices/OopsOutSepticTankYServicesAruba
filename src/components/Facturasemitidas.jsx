import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import {
  ref,
  set,
  push,
  update,
  onValue,
  runTransaction,
} from "firebase/database";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { jsPDF } from "jspdf";
import Swal from "sweetalert2";
import autoTable from "jspdf-autotable";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import filtericon from "../assets/img/filters_icon.jpg";
import Select from "react-select";
import logotipo from "../assets/img/logo.png";
import FacturaViewEdit from "./FacturaViewEdit";

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

const Facturasemitidas = () => {
  const [directions, setDirections] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedFacturas, setLoadedFacturas] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [loadedRegistro, setLoadedRegistro] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);
  const [dataBranch, setDataBranch] = useState([]);
  const [dataRegistroFechas, setDataRegistroFechas] = useState([]);
  const [todos, setTodos] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);
  const [editingRate, setEditingRate] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' });
  
  // Estado para el modal de vista/edición de factura
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [showFacturaModal, setShowFacturaModal] = useState(false);

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

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
    direccion: [],
    numerodefactura: "",
    anombrede: [],
    diasdemora: [],
    fechaEmision: [null, null],
    fechaServicio: [null, null],
    factura: "true",
    pago: [],
    personalizado: "",
    fechaPago: [null, null],
  });

  // Cargar datos de la rama "registrofechas"
  useEffect(() => {
    const dbRef = ref(database, "registrofechas");
    // onValue devuelve la función para desuscribirse
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const allData = snapshot.val();
        const formattedData = Object.entries(allData).map(
          ([fecha, registros]) => ({
            fecha,
            registros: Object.entries(registros).map(([id, registro]) => ({
              id,
              ...registro,
            })),
          })
        );
        formattedData.sort((a, b) => {
          const [dayA, monthA, yearA] = a.fecha.split("-");
          const [dayB, monthB, yearB] = b.fecha.split("-");
          const dateA = new Date(yearA, monthA - 1, dayA);
          const dateB = new Date(yearB, monthB - 1, dayB);
          return dateB - dateA;
        });
        setDataRegistroFechas(formattedData);
        setLoadedRegistro(true);
      } else {
        setDataRegistroFechas([]);
      }
    });
    // Aquí devolvemos la función unsubscribe para limpiar el listener
    return unsubscribe;
  }, []);

  // Cargar datos de la rama "data"
  useEffect(() => {
    const dbRef = ref(database, "data");
    // onValue devuelve la función de limpieza
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const dataVal = snapshot.val();
        const dataList = Object.entries(dataVal).map(([id, record]) => {
          const today = new Date();
          const day = ("0" + today.getDate()).slice(-2);
          const month = ("0" + (today.getMonth() + 1)).slice(-2);
          const year = today.getFullYear();
          const fecha = `${day}-${month}-${year}`;
          return { id, ...record, fecha };
        });
        dataList.sort((a, b) => b.timestamp - a.timestamp);
        setDataBranch(dataList);
        setLoadedData(true);
      } else {
        setDataBranch([]);
      }
    });

    // Aquí devolvemos directamente la función unsubscribe
    return unsubscribe;
  }, []);

  // Cargar "users" (excluyendo administradores y contadores)
  useEffect(() => {
    const dbRef = ref(database, "users");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedUsers = Object.entries(snapshot.val())
          .filter(
            ([_, user]) => user.role !== "admin" && user.role !== "contador"
          )
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

  // ② Carga desde Firebase ("configuraciondefactura")
  useEffect(() => {
    const configRef = ref(database, "configuraciondefactura");
    return onValue(configRef, (snap) => {
      if (snap.exists()) setInvoiceConfig(snap.val());
    });
  }, []);

  // Cuando todas las fuentes de datos estén listas, oculta el loader
  useEffect(() => {
    if (loadedData && loadedRegistro && loadedUsers && loadedClients) {
      setLoading(false);
    }
  }, [loadedData, loadedRegistro, loadedUsers, loadedClients]);

  // Opciones para filtros (se combinan ambos registros)
  const allRegistros = [
    ...dataBranch.map((record) => ({
      fecha: record.fecha,
      registros: [record],
    })),
    ...dataRegistroFechas,
  ];

  const realizadoporOptions = users.map((u) => ({
    value: u.id,
    label: u.name,
  }));

  const anombredeOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.anombrede).filter(Boolean)
        )
      )
    )
      .sort()
      .map((v) => ({ value: v, label: v }))
  ];

  const direccionOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.direccion).filter(Boolean)
        )
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }))
  ]

  // ————————
  // 1) APLANA TODOS LOS REGISTROS EN UN ARRAY PLANO
  useEffect(() => {
    const vivos = dataBranch.map((r) => ({
      ...r,
      fecha: r.fecha,
      origin: "data",
    }));
    const historicos = dataRegistroFechas.flatMap((g) =>
      g.registros.map((r) => ({
        ...r,
        fecha: g.fecha,
        origin: "registrofechas",
      }))
    );
    setTodos([...vivos, ...historicos]);
  }, [dataBranch, dataRegistroFechas]);

  // ————————

  // 1) FILTRA ESE ARRAY
  const filtrados = todos.filter((r) => {
    // 1) Filtrar por Fecha de Emisión (timestamp)
    const [emiStart, emiEnd] = filters.fechaEmision;
    if (emiStart && emiEnd) {
      const fechaEmi = new Date(r.timestamp);
      if (fechaEmi < emiStart || fechaEmi > emiEnd) return false;
    }

    // 2) Filtrar por Fecha de Servicio (r.fecha formato "DD-MM-YYYY")
    const [srvStart, srvEnd] = filters.fechaServicio;
    if (srvStart && srvEnd) {
      const [d, m, y] = r.fecha.split("-");
      const fechaSrv = new Date(+y, m - 1, +d);
      if (fechaSrv < srvStart || fechaSrv > srvEnd) return false;
    }

    // 3) Subcadena: número de factura
    if (
      filters.numerodefactura &&
      !r.numerodefactura?.toString().includes(filters.numerodefactura)
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

    // 7) Factura sí/no
    if (filters.factura !== "" && r.factura !== (filters.factura === "true"))
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
      if (!r.fechapago) return false;
      const [y, m, d] = r.fechapago.split("-");
      const fechaPago = new Date(+y, m - 1, +d);
      if (fechaPago < pagoStart || fechaPago > pagoEnd) return false;
    }

    return true;
  });

  // 2b) ORDENA el array plano según la configuración
  const sortedRecords = [...filtrados].sort((a, b) => {
    if (sortConfig.key === 'numerodefactura') {
      const numA = a.numerodefactura || '';
      const numB = b.numerodefactura || '';
      if (sortConfig.direction === 'asc') {
        return numA.localeCompare(numB, undefined, { numeric: true });
      }
      return numB.localeCompare(numA, undefined, { numeric: true });
    }
    // Orden por defecto (fecha)
    const [d1, m1, y1] = a.fecha.split("-");
    const [d2, m2, y2] = b.fecha.split("-");
    const dateA = new Date(y1, m1 - 1, d1);
    const dateB = new Date(y2, m2 - 1, d2);
    return dateB - dateA; // Descendente por defecto
  });

  // 3) AGRUPA DE NUEVO POR FECHA PARA LA TABLA (si no se ordena por factura)
  const grouped = sortedRecords.reduce((acc, r) => {
    const key = sortConfig.key === 'numerodefactura' ? r.id : r.fecha;
    (acc[key] = acc[key] || []).push(r);
    return acc;
  }, {});

  const filteredData = Object.entries(grouped)
    .map(([key, registros]) => ({
      fecha: sortConfig.key === 'numerodefactura' ? registros[0].fecha : key,
      registros,
    }))
    .sort((a, b) => {
      if (sortConfig.key === 'numerodefactura') {
        // La ordenación principal ya se hizo en sortedRecords
        return 0;
      }
      const [d1, m1, y1] = a.fecha.split("-");
      const [d2, m2, y2] = b.fecha.split("-");
      return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    });

  // Cálculos de paginación
  const allRecords = filteredData.flatMap(group => group.registros);
  const totalItems = allRecords.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageRecords = allRecords.slice(startIndex, endIndex);

  // Reagrupar los registros paginados por fecha
  const paginatedGrouped = currentPageRecords.reduce((acc, r) => {
    (acc[r.fecha] = acc[r.fecha] || []).push(r);
    return acc;
  }, {});
  const paginatedData = Object.entries(paginatedGrouped)
    .map(([fecha, registros]) => ({ fecha, registros }))
    .sort((a, b) => {
      const [d1, m1, y1] = a.fecha.split("-");
      const [d2, m2, y2] = b.fecha.split("-");
      return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    });

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
      filteredData.forEach((item) => {
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
    const dbRefClientes = ref(database, "clientes");
    const newClientRef = push(dbRefClientes);
    set(newClientRef, { direccion, cubicos }).catch((error) => {
      console.error("Error adding client: ", error);
    });
  };

  // Función para actualizar campos (gestiona tanto los registros de "data" como de "registrofechas")
  function handleFieldChange(fecha, registroId, field, value, origin) {
    const safeValue = value ?? "";
    const fromData = origin === "data";
    const path = fromData
      ? `data/${registroId}`
      : `registrofechas/${fecha}/${registroId}`;
    const dbRefItem = ref(database, path);

    // Actualizar campo simple
    const updates = { [field]: safeValue };

    // Grabar en Firebase
    update(dbRefItem, updates).catch(console.error);

    // Actualizar estado local
    const updater = (r) => (r.id === registroId ? { ...r, ...updates } : r);

    if (fromData) {
      setDataBranch((prev) => prev.map(updater));
    } else {
      setDataRegistroFechas((prev) =>
        prev.map((g) =>
          g.fecha === fecha ? { ...g, registros: g.registros.map(updater) } : g
        )
      );
    }

    // Si cambió servicio, sincronizar cliente
    if (field === "servicio") {
      const current = fromData
        ? dataBranch.find((r) => r.id === registroId)
        : dataRegistroFechas
            .find((g) => g.fecha === fecha)
            ?.registros.find((r) => r.id === registroId);
      if (current) syncWithClients(current.direccion, current.cubicos);
    }
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

  const getUserName = (userId) => {
    const found = users.find((u) => u.id === userId);
    return found ? found.name : "";
  };

  // Formatea fecha y dias de mora
  const formatDate = (ts) => {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  /**
   * Maneja cambios de campo en Firebase y sincroniza estado local,
   * incluyendo recálculo de amount si cambian qty o rate.
   *
   * @param {string} id     ID del registro en registrofechas
   * @param {string} field  Nombre del campo a actualizar
   * @param {any}    value  Nuevo valor
   */

  // 1) La función que actualiza Firebase y el estado local (PAGO)
  const handlePagoToggle = (fecha, id, origin, checked) => {
    const newPagoValue = checked ? "Pago" : "Debe";
    
    Swal.fire({
      title: checked
        ? "¿Deseas marcar esta factura como pagada?"
        : "¿Deseas desmarcar el pago?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "No",
    }).then((res) => {
      if (!res.isConfirmed) return;

      // ruta en RTDB
      const path =
        origin === "data" ? `data/${id}` : `registrofechas/${fecha}/${id}`;
      const itemRef = ref(database, path);

      update(itemRef, { pago: newPagoValue })
        .then(() => {
          // ACTUALIZO estado local según el origen
          if (origin === "data") {
            setDataBranch((prev) =>
              prev.map((r) => (r.id === id ? { ...r, pago: newPagoValue } : r))
            );
          } else {
            setDataRegistroFechas((prev) =>
              prev.map((group) =>
                group.fecha !== fecha
                  ? group
                  : {
                      ...group,
                      registros: group.registros.map((r) =>
                        r.id === id ? { ...r, pago: newPagoValue } : r
                      ),
                    }
              )
            );
          }
          Swal.fire({ title: "¡Listo!", icon: "success", timer: 1000 });
        })
        .catch(console.error);
    });
  };

  // Manejo del DatePicker para rango de fechas
  const [showEmisionPicker, setShowEmisionPicker] = useState(false);
  const [showServicioPicker, setShowServicioPicker] = useState(false);
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

  const handleServicioChange = (dates) => {
    const [start, end] = dates;
    setFilters((prev) => ({
      ...prev,
      fechaServicio: [
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

  // Función para abrir el modal de vista/edición de factura
  const openFacturaModal = (numeroFactura) => {
    setSelectedFactura(numeroFactura);
    setShowFacturaModal(true);
  };

  const closeFacturaModal = () => {
    setSelectedFactura(null);
    setShowFacturaModal(false);
  };

  // Función para payment rápido desde la tabla
  const paymentRapido = async (numeroFactura) => {
    if (!numeroFactura) {
      Swal.fire({
        icon: "warning",
        title: "Sin factura",
        text: "Este registro no tiene una factura asociada"
      });
      return;
    }

    // Obtener datos de la factura
    const facturaRef = ref(database, `facturas/${numeroFactura}`);
    const facturaSnapshot = await new Promise((resolve) => {
      onValue(facturaRef, resolve, { onlyOnce: true });
    });

    if (!facturaSnapshot.exists()) {
      Swal.fire({
        icon: "error",
        title: "Factura no encontrada",
        text: "No se pudo encontrar la información de la factura"
      });
      return;
    }

    const facturaData = facturaSnapshot.val();
    
    if (facturaData.deuda <= 0) {
      Swal.fire({
        icon: "info",
        title: "Factura ya pagada",
        text: "Esta factura ya está completamente pagada"
      });
      return;
    }

    const { value: montoPayment } = await Swal.fire({
      title: "Payment Rápido",
      html: `
        <div style="text-align: left; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Factura:</strong></span>
            <span style="color: #2196F3; font-weight: bold;">#${numeroFactura}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Total:</strong></span>
            <span>AWG ${formatCurrency(facturaData.totalAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Payments:</strong></span>
            <span style="color: #28a745;">AWG ${formatCurrency(facturaData.payment || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-top: 8px; border-top: 1px solid #dee2e6;">
            <span><strong>Deuda:</strong></span>
            <span style="color: #dc3545; font-weight: bold;">AWG ${formatCurrency(facturaData.deuda)}</span>
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
        const montoInput = document.getElementById('monto-payment-rapido');
        const mitadBtn = document.getElementById('mitad-rapido');
        const totalBtn = document.getElementById('total-rapido');
        
        mitadBtn.onclick = () => {
          montoInput.value = (facturaData.deuda / 2).toFixed(2);
        };
        
        totalBtn.onclick = () => {
          montoInput.value = facturaData.deuda.toFixed(2);
        };
        
        montoInput.focus();
      },
      preConfirm: () => {
        const value = document.getElementById('monto-payment-rapido').value;
        if (!value || parseFloat(value) <= 0) {
          Swal.showValidationMessage("Debe ingresar un monto válido mayor a 0");
          return false;
        }
        if (parseFloat(value) > facturaData.deuda) {
          Swal.showValidationMessage("El payment no puede ser mayor que la deuda actual");
          return false;
        }
        return parseFloat(value);
      }
    });

    if (!montoPayment) return;

    try {
      const payment = parseFloat(montoPayment);
      const nuevosPayments = (facturaData.payment || 0) + payment;
      const nuevaDeuda = Math.max(0, facturaData.totalAmount - nuevosPayments);
      const facturaCompletamentePagada = nuevaDeuda === 0;
      
      // Actualizar la factura
      const facturaUpdates = {
        payment: parseFloat(nuevosPayments.toFixed(2)),
        deuda: parseFloat(nuevaDeuda.toFixed(2))
      };

      if (facturaCompletamentePagada) {
        facturaUpdates.pago = "Pago";
        facturaUpdates.fechapago = new Date().toISOString().split('T')[0];
      }

      await update(facturaRef, facturaUpdates);

      // Si está completamente pagada, actualizar todos los servicios asociados
      if (facturaCompletamentePagada) {
        // Buscar servicios asociados y actualizarlos
        const [dataSnapshot, registroFechasSnapshot] = await Promise.all([
          new Promise((resolve) => onValue(ref(database, "data"), resolve, { onlyOnce: true })),
          new Promise((resolve) => onValue(ref(database, "registrofechas"), resolve, { onlyOnce: true }))
        ]);

        const serviciosAsociados = [];
        
        // Buscar en data
        if (dataSnapshot.exists()) {
          const dataVal = dataSnapshot.val();
          Object.entries(dataVal).forEach(([id, registro]) => {
            if (registro.referenciaFactura === numeroFactura || registro.numerodefactura === numeroFactura) {
              serviciosAsociados.push({ id, origin: "data" });
            }
          });
        }
        
        // Buscar en registrofechas
        if (registroFechasSnapshot.exists()) {
          const registroVal = registroFechasSnapshot.val();
          Object.entries(registroVal).forEach(([fecha, registros]) => {
            Object.entries(registros).forEach(([id, registro]) => {
              if (registro.referenciaFactura === numeroFactura || registro.numerodefactura === numeroFactura) {
                serviciosAsociados.push({ id, fecha, origin: "registrofechas" });
              }
            });
          });
        }

        // Actualizar todos los servicios
        const updatePromises = serviciosAsociados.map(servicio => {
          const path = servicio.origin === "data" 
            ? `data/${servicio.id}` 
            : `registrofechas/${servicio.fecha}/${servicio.id}`;
          
          return update(ref(database, path), { 
            pago: "Pago",
            fechapago: new Date().toISOString().split('T')[0]
          });
        });

        await Promise.all(updatePromises);
      }

      // Mostrar mensaje de éxito
      if (facturaCompletamentePagada) {
        Swal.fire({
          icon: "success",
          title: "¡Factura Pagada Completamente!",
          html: `
            <div style="text-align: center;">
              <p>Se registró un payment de <strong>AWG ${formatCurrency(payment)}</strong></p>
              <p style="color: #28a745; font-weight: bold;">✅ Factura #${numeroFactura} marcada como PAGADA</p>
              <p style="font-size: 14px; color: #6c757d;">Todos los servicios asociados fueron actualizados</p>
            </div>
          `,
          timer: 3000
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "Payment Registrado",
          text: `Payment de AWG ${formatCurrency(payment)} registrado. Deuda restante: AWG ${formatCurrency(nuevaDeuda)}`,
          timer: 2000
        });
      }
    } catch (error) {
      console.error("Error registrando payment:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo registrar el payment"
      });
    }
  };

  
  const openConfigModal = () => {
    Swal.fire({
      title: "Configuración de la factura",
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

        // Guardamos en Firebase sin validar nada más
        const configRef = ref(database, "configuraciondefactura");
        set(configRef, res.value).catch(console.error);

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
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'desc') return { key: 'fecha', direction: 'desc' }; // Volver a default
        return { key, direction: 'desc' };
      }
      return { key, direction: 'asc' };
    });
  };



  // Generar factura usando datos de la factura asociada
  const generatePDF = async () => {
    // 1) Validar selección
    if (selectedRows.length === 0) {
      return Swal.fire({
        title: "No hay registros seleccionados",
        text: "Seleccione al menos uno para generar la factura.",
        icon: "warning",
        confirmButtonText: "Aceptar",
      });
    }

    // 2) Obtener datos seleccionados y usar el PRIMER registro seleccionado como base
    const allRecs = filteredData.flatMap((g) => g.registros);
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

    console.log("Usando registro base:", base);

    // 3) Validar que la factura existe
    if (!base.numerodefactura) {
      return Swal.fire({
        title: "Sin factura asociada",
        text: "El primer registro seleccionado no tiene una factura asociada.",
        icon: "warning",
        confirmButtonText: "Aceptar",
      });
    }

    // 4) Preguntar por el Bill To
    const { value: billToResult } = await Swal.fire({
      title: "Bill To:",
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
            `No hay datos para generar factura con '${labels[type]}'.`
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

    // 5) Calcular Bill To
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
      // 6) Obtener datos de la factura desde el nodo /facturas/
      const facturaRef = ref(database, `facturas/${base.numerodefactura}`);
      const facturaSnapshot = await new Promise((resolve) => {
        onValue(facturaRef, resolve, { onlyOnce: true });
      });

      if (!facturaSnapshot.exists()) {
        return Swal.fire({
          title: "Factura no encontrada",
          text: `No se encontró la factura #${base.numerodefactura}`,
          icon: "error",
          confirmButtonText: "Aceptar",
        });
      }

      const facturaData = facturaSnapshot.val();
      console.log("Datos de la factura obtenidos:", facturaData);

      // 7) Usar datos del primer registro para información básica
      const pagoStatus = base.pago === "Pago" ? "Pago" : "Debe";

      // 8) Preparar filas usando los items de la factura
      const filas = [];
      if (facturaData.invoiceItems) {
        Object.entries(facturaData.invoiceItems).forEach(([key, item]) => {
          filas.push([
            base.fecha, // Fecha del servicio (del primer registro)
            item.item || "",
            item.descripcion || "",
            item.qty != null ? item.qty.toString() : "",
            item.rate != null ? (parseFloat(item.rate) || 0).toFixed(2) : "",
            item.amount != null ? formatCurrency(item.amount) : "",
          ]);
        });
      } else {
        // Si no hay items en la factura, mostrar mensaje
        return Swal.fire({
          title: "Factura sin items",
          text: "La factura no tiene items para mostrar.",
          icon: "warning",
          confirmButtonText: "Aceptar",
        });
      }

      const totalAmount = facturaData.totalAmount || 0;
      const invoiceId = base.numerodefactura;

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
      pdf.setFontSize(16).text(invoiceConfig.companyName || "Company Name", textX, mT + 5);
      pdf
        .setFontSize(10)
        .text(`Address: ${invoiceConfig.address || "Address"}`, textX, mT + 11)
        .text(
          `${invoiceConfig.city || "City"}, ${invoiceConfig.country || "Country"}, ${invoiceConfig.postalCode || "Postal Code"}`,
          textX,
          mT + 16
        )
        .text(`Tel: ${invoiceConfig.phone || "Phone"}`, textX, mT + 21)
        .text(`Email: ${invoiceConfig.email || "Email"}`, textX, mT + 26);

      // — Número y fecha —
      const today = new Date();
      pdf
        .setFontSize(12)
        .text(`INVOICE NO: ${invoiceId}`, 152, mT + 35)
        .text(`DATE: ${new Date(facturaData.timestamp).toLocaleDateString()}`, 152, mT + 40);

      // — Bill To —
      const yBill = mT + logoHeight + 21;
      pdf.setFontSize(12).text("BILL TO:", mL, yBill);

      const labelW = pdf.getTextWidth("BILL TO:");
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
      // BALANCE DUE únicamente se pone en 0 si pagoStatus === "Pago"
      const balance = pagoStatus === "Pago" ? 0 : facturaData.deuda || totalAmount;
      pdf.setFontSize(10);
      pdf.text(`BALANCE DUE: AWG ${formatCurrency(balance)}`, 152, afterY + 6);

      // — Bank Info y footer —
      const bankY = afterY + 12;
      pdf.setFontSize(10).text("Bank Info:", mL, bankY);
      pdf
        .setFontSize(9)
        .text(pdf.splitTextToSize(invoiceConfig.bankInfo || "Bank Info", 80), mL, bankY + 6);
      const footerText = (invoiceConfig.footer || "").replace(/\r?\n/g, " ");
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      pdf
        .setFontSize(10)
        .text(footerText, (w - pdf.getTextWidth(footerText)) / 2, h - 10);

      // — Marca de agua PAID, fecha de pago y PAYMENT —
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

        const fechaPagoDisplay = base.fechapago || facturaData.fechapago || today.toLocaleDateString();
        ctx.globalAlpha = 0.4;
        ctx.font = "5px Arial";
        ctx.fillStyle = "green";
        ctx.fillText(fechaPagoDisplay, 0, 10);

        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, wPt, hPt);

        // — PAYMENT total —
        pdf
          .setFontSize(10)
          .text(`PAYMENT: AWG ${formatCurrency(facturaData.payment || 0)}`, 152, afterY + 12);
      }

      // — Guarda el PDF —
      pdf.save(`Invoice-${invoiceId}.pdf`);

      // Mostrar mensaje de éxito
      Swal.fire({
        icon: "success",
        title: "PDF Generado",
        text: `La factura #${invoiceId} se ha generado correctamente.`,
        timer: 2000
      });

    } catch (error) {
      console.error("Error generando PDF:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo generar el PDF de la factura. Inténtelo nuevamente.",
      });
    }
  };

  const addEmptyInvoice = async () => {
    // 1. Revisar si hay números disponibles en facturasDisponibles
    const availableNumsRef = ref(database, "facturasDisponibles");
    let invoiceId = null;
    let usedAvailableKey = null;
    let numerodefactura = null;

    const availableSnapshot = await new Promise((resolve) => {
      onValue(availableNumsRef, resolve, { onlyOnce: true });
    });

    if (availableSnapshot.exists()) {
      // Hay números disponibles, usar el menor
      const availableData = availableSnapshot.val();
      const sortedAvailable = Object.entries(availableData).sort(
        ([, a], [, b]) => a.numeroFactura.localeCompare(b.numeroFactura)
      );
      const [key, numeroData] = sortedAvailable[0];
      invoiceId = numeroData.numeroFactura;
      usedAvailableKey = key;
      numerodefactura = parseInt(invoiceId.slice(-5));
    } else {
      // No hay números disponibles, generar nuevo
      const contadorRef = ref(database, "contadorFactura");
      const tx = await runTransaction(contadorRef, (curr) => (curr || 0) + 1);
      numerodefactura = tx.snapshot.val();
      // Formatear YYMM + secuencia 5 dígitos
      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const seq = String(numerodefactura).padStart(5, "0");
      invoiceId = `${yy}${mm}${seq}`;
    }

    // Si se usó un número disponible, eliminarlo de la lista
    if (usedAvailableKey) {
      await set(ref(database, `facturasDisponibles/${usedAvailableKey}`), null);
    }

    // 3) Calcular la clave "hoy" con guiones
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const fechaKey = `${dd}-${mm}-${yyyy}`;

    // 4) Hacer push dentro de registrofechas/<fechaKey> en lugar de la raíz
    const groupRef = ref(database, `registrofechas/${fechaKey}`);
    const newRef = push(groupRef);

    await set(newRef, {
      timestamp: Date.now(),
      fecha: fechaKey,
      numerodefactura: invoiceId,
      anombrede: "",
      direccion: "",
      servicio: "",
      cubicos: 0,
      valor: 0,
      pago: "Debe",
      diasdemora: null,
      factura: true,
    }).catch(console.error);
  };

  // Función para cancelar factura (igual que en Hojadefechas)
  const cancelInvoice = async (fecha, registroId, numeroFactura, origin) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Cancelar Factura?",
      text: `¿Estás seguro de que deseas cancelar la factura ${numeroFactura}? Esto borrará todos los datos de facturación y el número quedará disponible para reutilización.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, Cancelar",
      cancelButtonText: "No",
      confirmButtonColor: "#d33",
    });

    if (!isConfirmed) return;

    try {
      // 1) Limpiar los campos de facturación (campos "F")
      const fromData = origin === "data";
      const path = fromData
        ? `data/${registroId}`
        : `registrofechas/${fecha}/${registroId}`;
      const facturaRef = ref(database, path);

      await update(facturaRef, {
        // Mantener datos base del servicio
        // Limpiar solo campos de facturación (F)
        item: null,
        descripcion: null,
        qty: null,
        rate: null,
        amount: null,
        billTo: null,
        personalizado: null,
        factura: false, // Cambiar a false
        numerodefactura: null, // Limpiar número
        fechaEmision: null,
      });

      // 2) Agregar el número de factura a la lista de números disponibles para reutilizar
      if (numeroFactura) {
        const numerosDisponiblesRef = ref(database, "facturasDisponibles");
        const newAvailableRef = push(numerosDisponiblesRef);
        await set(newAvailableRef, {
          numeroFactura: numeroFactura,
          fechaCancelacion: Date.now(),
        });
      }

      // 3) Actualizar estado local
      const updater = (r) =>
        r.id === registroId
          ? {
              ...r,
              item: null,
              descripcion: null,
              qty: null,
              rate: null,
              amount: null,
              billTo: null,
              personalizado: null,
              factura: false,
              numerodefactura: null,
              fechaEmision: null,
            }
          : r;

      if (fromData) {
        setDataBranch((prev) => prev.map(updater));
      } else {
        setDataRegistroFechas((prev) =>
          prev.map((g) =>
            g.fecha === fecha
              ? { ...g, registros: g.registros.map(updater) }
              : g
          )
        );
      }

      Swal.fire({
        icon: "success",
        title: "Factura Cancelada",
        text: `La factura ${numeroFactura} ha sido cancelada. El número quedará disponible para reutilización.`,
        timer: 2000,
      });
    } catch (error) {
      console.error("Error cancelando factura:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Hubo un error al cancelar la factura.",
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
    if (loadedClients && loadedFacturas) {
      setLoading(false);
    }
  }, [loadedClients, loadedFacturas]);

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
        <h2>Filtros</h2>
        <label>Fechas</label>
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

        <label></label>
        <button
          type="button"
          className="filter-button"
          onClick={() => setShowServicioPicker((v) => !v)}
          style={{ display: "block", margin: "0.5rem 0" }}
        >
          {showServicioPicker
            ? "Ocultar selector"
            : "Filtrar Por Fecha De Servicio"}
        </button>
        {showServicioPicker && (
          <DatePicker
            selectsRange
            inline
            isClearable
            startDate={filters.fechaServicio[0]}
            endDate={filters.fechaServicio[1]}
            onChange={handleServicioChange}
            placeholderText="Desde – Hasta"
          />
        )}

        <label></label>
        <button
          type="button"
          className="filter-button"
          onClick={() => setShowPagoPicker((v) => !v)}
          style={{ display: "block", margin: "0.5rem 0" }}
        >
          {showPagoPicker
            ? "Ocultar selector"
            : "Filtrar Por Fecha De Pago"}
        </button>
        {showPagoPicker && (
          <DatePicker
            selectsRange
            inline
            isClearable
            startDate={filters.fechaPago[0]}
            endDate={filters.fechaPago[1]}
            onChange={handlePagoChange}
            placeholderText="Desde – Hasta"
          />
        )}

        <label>Número de Factura</label>
        <input
          type="text"
          placeholder="Buscar por N° de factura"
          value={filters.numerodefactura}
          onChange={(e) =>
            setFilters({ ...filters, numerodefactura: e.target.value })
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

        <label>Días de Mora</label>
        <Select
          isClearable
          isMulti
          options={moraOptions}
          placeholder="Selecciona mora(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              diasdemora: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.diasdemora.map((v) => ({ value: v, label: v }))}
        />
        <label>Personalizado</label>
        <input
          type="text"
          placeholder="Buscar personalizado"
          value={filters.personalizado}
          onChange={(e) =>
            setFilters({ ...filters, personalizado: e.target.value })
          }
        />

        <label>Pago</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: true, label: "Pagado" },
            { value: false, label: "Pendiente" },
          ]}
          placeholder="Selecciona estado(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              pago: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.pago.map((v) => ({
            value: v,
            label: v ? "Pagado" : "Pendiente",
          }))}
        />

        <button
          onClick={() =>
            setFilters({
              fechaEmision: [null, null],
              fechaServicio: [null, null],
              fechaPago: [null, null],
              direccion: [],
              numerodefactura: "",
              anombrede: [],
              diasdemora: [],
              factura: "true",
              pago: [],
              personalizado: "",
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
          <h1 className="title-page">Facturas Emitidas</h1>
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
                <th>Seleccionar</th>
                <th>Fecha Emisión</th>
                <th>Fecha Servicio</th>
                <th>
                  <button 
                    onClick={() => handleSort('numerodefactura')} 
                    className="sort-button"
                    title="Ordenar por N° de Factura"
                  >
                    Factura 
                    {sortConfig.key === 'numerodefactura' && (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')}
                  </button>
                </th>
                <th>A Nombre De</th>
                <th>Personalizado</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Días de Mora</th>
                <th>Fecha de pago</th>
                <th>Pago</th>
                <th>Ver/Editar</th>
                <th>Payment Rápido</th>
                <th>Cancelar</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(({ fecha, registros }) => (
                <React.Fragment key={fecha}>
                  {registros.map((r) => (
                    <tr key={`${r.origin}_${fecha}_${r.id}`}>
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
                        {formatDate(r.timestamp)}
                      </td>
                      <td style={{ textAlign: "center" }}>{fecha}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => openFacturaModal(r.numerodefactura)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#2196F3",
                            textDecoration: "underline",
                            cursor: "pointer",
                            fontSize: "inherit",
                            fontWeight: "bold"
                          }}
                          title="Ver/Editar factura"
                        >
                          {r.numerodefactura}
                        </button>
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{ width: "16ch" }}
                          value={r.anombrede || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              fecha,
                              r.id,
                              "anombrede",
                              e.target.value,
                              r.origin
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{ width: "20ch" }}
                          value={r.personalizado || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              fecha,
                              r.id,
                              "personalizado",
                              e.target.value,
                              r.origin
                            )
                          }
                        />
                      </td>
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            className="direccion-fixed-input"
                            style={{ width: "18ch" }}
                            type="text"
                            list={`dirs-${r.id}`}
                            value={r.direccion || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                fecha,
                                r.id,
                                "direccion",
                                e.target.value,
                                r.origin
                              )
                            }
                          />
                          <datalist id={`dirs-${r.id}`}>
                            {clients.map((c) => (
                              <option key={c.id} value={c.direccion} />
                            ))}
                          </datalist>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", width: "6ch" }}>
                        {calculateDaysDelay(r.timestamp, r.pago)}
                      </td>
                      <td>
                        <input
                          type="date"
                          value={r.fechapago || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              fecha,
                              r.id,
                              "fechapago",
                              e.target.value,
                              r.origin
                            )
                          }
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={r.pago === "Pago"}
                          onChange={(e) =>
                            handlePagoToggle(
                              fecha,
                              r.id,
                              r.origin,
                              e.target.checked
                            )
                          }
                          style={{
                            width: "3ch",
                            height: "3ch",
                            cursor: "pointer",
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => openFacturaModal(r.numerodefactura)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                          title="Ver/Editar factura"
                        >
                          Ver/Editar
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {r.numerodefactura && r.pago !== "Pago" ? (
                          <button
                            onClick={() => paymentRapido(r.numerodefactura)}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: "#007bff",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "11px",
                              fontWeight: "bold"
                            }}
                            title={`Payment rápido para factura ${r.numerodefactura}`}
                          >
                            Payment
                          </button>
                        ) : (
                          <span style={{ 
                            color: "#ccc", 
                            fontSize: "11px",
                            fontStyle: "italic"
                          }}>
                            {r.pago === "Pago" ? "Pagada" : "Sin factura"}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {r.factura && r.numerodefactura ? (
                          <button
                            onClick={() =>
                              cancelInvoice(
                                fecha,
                                r.id,
                                r.numerodefactura,
                                r.origin
                              )
                            }
                            className="delete-button"
                            style={{
                              border: "1px solid #ff3300",
                              backgroundColor: "transparent",
                              cursor: "pointer",
                              color: "black",
                              fontWeight: "normal",
                              marginLeft: "0",
                              padding: "4px 8px",
                              borderRadius: "4px",
                            }}
                            title={`Cancelar factura ${r.numerodefactura}`}
                          >
                            Cancelar Factura
                          </button>
                        ) : (
                          <span style={{ color: "#ccc", fontSize: "12px" }}>
                            Sin factura
                          </span>
                        )}
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
            onClick={generatePDF}
          >
            Generar Factura
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
            Configuración Factura
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
            onClick={addEmptyInvoice}
          >
            Agregar Factura Manual
          </button>
        </div>
      </div>

      {/* Modal de Vista/Edición de Factura */}
      {showFacturaModal && selectedFactura && (
        <FacturaViewEdit
          numeroFactura={selectedFactura}
          onClose={closeFacturaModal}
        />
      )}
    </div>
  );
};

export default Facturasemitidas;
