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
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import Swal from "sweetalert2";
import autoTable from "jspdf-autotable";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import filtericon from "../assets/img/filters_icon.jpg";
import excel_icon from "../assets/img/excel_icon.jpg";
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
  const [sortConfig, setSortConfig] = useState({
    key: "fecha",
    direction: "desc",
  });
  const [facturasData, setFacturasData] = useState({});

  // Estado para el modal de vista/edición de factura
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [showFacturaModal, setShowFacturaModal] = useState(false);

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

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

  // Estados locales para campos editables (onBlur)
  const [localValues, setLocalValues] = useState({});

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

  // Cargar facturas
  useEffect(() => {
    const facturasRef = ref(database, "facturas");
    const unsubscribe = onValue(facturasRef, (snapshot) => {
      if (snapshot.exists()) {
        setFacturasData(snapshot.val());
      } else {
        setFacturasData({});
      }
    });
    return unsubscribe;
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
      .map((v) => ({ value: v, label: v })),
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
      .map((v) => ({ value: v, label: v })),
  ];

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
      // Usar fecha de pago de la factura si está ligado a una factura, sino usar la fecha del servicio
      const fechaPagoStr = r.numerodefactura 
        ? facturasData[r.numerodefactura]?.fechapago
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
    if (sortConfig.key === "numerodefactura") {
      const numA = a.numerodefactura || "";
      const numB = b.numerodefactura || "";
      if (sortConfig.direction === "asc") {
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
    const key = sortConfig.key === "numerodefactura" ? r.id : r.fecha;
    (acc[key] = acc[key] || []).push(r);
    return acc;
  }, {});

  const filteredData = Object.entries(grouped)
    .map(([key, registros]) => ({
      fecha: sortConfig.key === "numerodefactura" ? registros[0].fecha : key,
      registros,
    }))
    .sort((a, b) => {
      if (sortConfig.key === "numerodefactura") {
        // La ordenación principal ya se hizo en sortedRecords
        return 0;
      }
      const [d1, m1, y1] = a.fecha.split("-");
      const [d2, m2, y2] = b.fecha.split("-");
      return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    });

  // Cálculos de paginación
  const allRecords = filteredData.flatMap((group) => group.registros);
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

    // Campo especial: fecha - mover registro a nueva fecha
    if (field === "fecha") {
      console.log('🔄 Procesando cambio de fecha:', {
        fecha,
        registroId,
        safeValue,
        origin,
        fromData
      });
      
      const actualizarFechaServicio = async () => {
        try {
          // Obtener el registro completo
          const registro = fromData
            ? dataBranch.find((r) => r.id === registroId) || {}
            : dataRegistroFechas
                .find((g) => g.fecha === fecha)
                ?.registros.find((r) => r.id === registroId) || {};

          console.log('📋 Registro encontrado:', registro);

          if (fromData) {
            // Si está en data, solo actualizar la fecha
            console.log('📝 Actualizando en data:', path);
            await update(dbRefItem, { fecha: safeValue });
          } else {
            // Si está en registrofechas, mover a nueva fecha
            if (safeValue !== fecha) {
              console.log('🔄 Moviendo registro de registrofechas:', {
                from: fecha,
                to: safeValue,
                registroId
              });
              // Crear en nueva fecha
              await set(ref(database, `registrofechas/${safeValue}/${registroId}`), {
                ...registro,
                fecha: safeValue
              });
              // Eliminar de fecha anterior
              await set(ref(database, `registrofechas/${fecha}/${registroId}`), null);
            } else {
              console.log('📝 Actualizando fecha en registrofechas sin mover:', path);
              await update(dbRefItem, { fecha: safeValue });
            }
          }
          console.log(`✅ Fecha de servicio actualizada: ${fecha} → ${safeValue}`);
        } catch (error) {
          console.error("❌ Error actualizando fecha de servicio:", error);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo actualizar la fecha del servicio"
          });
        }
      };
      
      actualizarFechaServicio();
      return;
    }

    // Campo especial: fechapago_factura - actualizar fecha de pago en la factura
    if (field === "fechapago_factura") {
      const registro = fromData
        ? dataBranch.find((r) => r.id === registroId) || {}
        : dataRegistroFechas
            .find((g) => g.fecha === fecha)
            ?.registros.find((r) => r.id === registroId) || {};

      if (registro.numerodefactura) {
        // Actualizar la fecha de pago en la factura
        const facturaRef = ref(database, `facturas/${registro.numerodefactura}`);
        update(facturaRef, { fechapago: safeValue }).catch(console.error);
        
        // Actualizar todos los servicios asociados a esta factura
        const actualizarServiciosAsociados = async () => {
          try {
            // Buscar todos los servicios asociados a esta factura
            const [dataSnapshot, registroFechasSnapshot] = await Promise.all([
              new Promise((resolve) => onValue(ref(database, "data"), resolve, { onlyOnce: true })),
              new Promise((resolve) => onValue(ref(database, "registrofechas"), resolve, { onlyOnce: true }))
            ]);

            const serviciosAsociados = [];
            
            // Buscar en data
            if (dataSnapshot.exists()) {
              const dataVal = dataSnapshot.val();
              Object.entries(dataVal).forEach(([id, reg]) => {
                if (reg.referenciaFactura === registro.numerodefactura || reg.numerodefactura === registro.numerodefactura) {
                  serviciosAsociados.push({ id, origin: "data" });
                }
              });
            }
            
            // Buscar en registrofechas
            if (registroFechasSnapshot.exists()) {
              const registroVal = registroFechasSnapshot.val();
              Object.entries(registroVal).forEach(([fechaReg, registros]) => {
                Object.entries(registros).forEach(([id, reg]) => {
                  if (reg.referenciaFactura === registro.numerodefactura || reg.numerodefactura === registro.numerodefactura) {
                    serviciosAsociados.push({ id, fecha: fechaReg, origin: "registrofechas" });
                  }
                });
              });
            }

            // Actualizar todos los servicios
            const updatePromises = serviciosAsociados.map(servicio => {
              const path = servicio.origin === "data" 
                ? `data/${servicio.id}` 
                : `registrofechas/${servicio.fecha}/${servicio.id}`;
              
              return update(ref(database, path), { fechapago: safeValue });
            });

            await Promise.all(updatePromises);
            console.log(`✅ Fecha de pago actualizada en factura y ${serviciosAsociados.length} servicios`);
          } catch (error) {
            console.error("Error actualizando servicios asociados:", error);
          }
        };

        actualizarServiciosAsociados();
      }
      return;
    }

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

  // Función para obtener la fecha de emisión correcta
  const getFechaEmision = (registro) => {
    // 1. Buscar primero en la factura
    if (registro.numerodefactura && facturasData[registro.numerodefactura]) {
      const factura = facturasData[registro.numerodefactura];
      if (factura.fechaEmision) {
        // Formatear la fecha de emisión al formato DD/MM/YYYY
        const [year, month, day] = factura.fechaEmision.split('-');
        return `${day}/${month}/${year}`;
      }
    }
    
    // 2. Si no está en la factura, buscar en el servicio
    if (registro.fechaEmision) {
      return registro.fechaEmision; // Ya está en formato DD/MM/YYYY
    }
    
    // 3. Si no hay fecha de emisión específica, usar el timestamp
    return formatDate(registro.timestamp);
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
  const handlePagoToggle = async (fecha, id, origin, checked) => {
    const newPagoValue = checked ? "Pago" : "Debe";
    
    // Obtener el registro para verificar si tiene factura asociada
    const registro = origin === "data"
      ? dataBranch.find((r) => r.id === id) || {}
      : dataRegistroFechas
          .find((g) => g.fecha === fecha)
          ?.registros.find((r) => r.id === id) || {};

    const confirmTitle = checked
      ? (registro.numerodefactura 
          ? `¿Deseas marcar la factura #${registro.numerodefactura} como pagada?`
          : "¿Deseas marcar este servicio como pagado?")
      : (registro.numerodefactura 
          ? `¿Deseas desmarcar el pago de la factura #${registro.numerodefactura}?`
          : "¿Deseas desmarcar el pago?");

    const result = await Swal.fire({
      title: confirmTitle,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "No",
    });

    if (!result.isConfirmed) return;

    try {
      if (registro.numerodefactura) {
        // Si tiene factura asociada, actualizar la factura
        const facturaRef = ref(database, `facturas/${registro.numerodefactura}`);
        
        if (checked) {
          // Marcar como pagada: payment = totalAmount, deuda = 0
          const facturaSnapshot = await new Promise((resolve) => {
            onValue(facturaRef, resolve, { onlyOnce: true });
          });
          
          if (facturaSnapshot.exists()) {
            const facturaData = facturaSnapshot.val();
            const fechaPagoFinal = new Date().toISOString().split('T')[0];
            
            await update(facturaRef, {
              payment: facturaData.totalAmount,
              deuda: 0,
              pago: "Pago",
              fechapago: fechaPagoFinal
            });

            // Actualizar todos los servicios asociados a esta factura
            const [dataSnapshot, registroFechasSnapshot] = await Promise.all([
              new Promise((resolve) => onValue(ref(database, "data"), resolve, { onlyOnce: true })),
              new Promise((resolve) => onValue(ref(database, "registrofechas"), resolve, { onlyOnce: true }))
            ]);

            const serviciosAsociados = [];
            
            // Buscar en data
            if (dataSnapshot.exists()) {
              const dataVal = dataSnapshot.val();
              Object.entries(dataVal).forEach(([serviceId, reg]) => {
                if (reg.referenciaFactura === registro.numerodefactura || reg.numerodefactura === registro.numerodefactura) {
                  serviciosAsociados.push({ id: serviceId, origin: "data" });
                }
              });
            }
            
            // Buscar en registrofechas
            if (registroFechasSnapshot.exists()) {
              const registroVal = registroFechasSnapshot.val();
              Object.entries(registroVal).forEach(([fechaReg, registros]) => {
                Object.entries(registros).forEach(([serviceId, reg]) => {
                  if (reg.referenciaFactura === registro.numerodefactura || reg.numerodefactura === registro.numerodefactura) {
                    serviciosAsociados.push({ id: serviceId, fecha: fechaReg, origin: "registrofechas" });
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
                fechapago: fechaPagoFinal
              });
            });

            await Promise.all(updatePromises);
            
            Swal.fire({
              icon: "success",
              title: "¡Factura Pagada Completamente!",
              text: `Factura #${registro.numerodefactura} marcada como PAGADA`,
              timer: 2000
            });
          }
        } else {
          // Desmarcar como pagada: payment = 0, deuda = totalAmount
          const facturaSnapshot = await new Promise((resolve) => {
            onValue(facturaRef, resolve, { onlyOnce: true });
          });
          
          if (facturaSnapshot.exists()) {
            const facturaData = facturaSnapshot.val();
            
            await update(facturaRef, {
              payment: 0,
              deuda: facturaData.totalAmount,
              pago: "Debe",
              fechapago: null
            });

            // Actualizar todos los servicios asociados
            const [dataSnapshot, registroFechasSnapshot] = await Promise.all([
              new Promise((resolve) => onValue(ref(database, "data"), resolve, { onlyOnce: true })),
              new Promise((resolve) => onValue(ref(database, "registrofechas"), resolve, { onlyOnce: true }))
            ]);

            const serviciosAsociados = [];
            
            // Buscar en data
            if (dataSnapshot.exists()) {
              const dataVal = dataSnapshot.val();
              Object.entries(dataVal).forEach(([serviceId, reg]) => {
                if (reg.referenciaFactura === registro.numerodefactura || reg.numerodefactura === registro.numerodefactura) {
                  serviciosAsociados.push({ id: serviceId, origin: "data" });
                }
              });
            }
            
            // Buscar en registrofechas
            if (registroFechasSnapshot.exists()) {
              const registroVal = registroFechasSnapshot.val();
              Object.entries(registroVal).forEach(([fechaReg, registros]) => {
                Object.entries(registros).forEach(([serviceId, reg]) => {
                  if (reg.referenciaFactura === registro.numerodefactura || reg.numerodefactura === registro.numerodefactura) {
                    serviciosAsociados.push({ id: serviceId, fecha: fechaReg, origin: "registrofechas" });
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
                pago: "Debe",
                fechapago: null
              });
            });

            await Promise.all(updatePromises);
            
            Swal.fire({
              icon: "success",
              title: "Pago Desmarcado",
              text: `Factura #${registro.numerodefactura} marcada como DEBE`,
              timer: 2000
            });
          }
        }
      } else {
        // Si no tiene factura, actualizar solo el servicio individual
        const path = origin === "data" ? `data/${id}` : `registrofechas/${fecha}/${id}`;
        const itemRef = ref(database, path);

        const updates = { pago: newPagoValue };
        
        if (checked) {
          updates.fechapago = new Date().toISOString().split('T')[0];
        } else {
          updates.fechapago = null;
        }

        await update(itemRef, updates);
        
        // Actualizar estado local
        if (origin === "data") {
          setDataBranch((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
          );
        } else {
          setDataRegistroFechas((prev) =>
            prev.map((group) =>
              group.fecha !== fecha
                ? group
                : {
                    ...group,
                    registros: group.registros.map((r) =>
                      r.id === id ? { ...r, ...updates } : r
                    ),
                  }
            )
          );
        }
        
        Swal.fire({ title: "¡Listo!", icon: "success", timer: 1000 });
      }
    } catch (error) {
      console.error("Error actualizando pago:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el estado de pago"
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
        text: "Este registro no tiene una factura asociada",
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
        text: "No se pudo encontrar la información de la factura",
      });
      return;
    }

    const facturaData = facturaSnapshot.val();

    if (facturaData.deuda <= 0) {
      Swal.fire({
        icon: "info",
        title: "Factura ya pagada",
        text: "Esta factura ya está completamente pagada",
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
            <span style="color: #28a745;">AWG ${formatCurrency(
              facturaData.payment || 0
            )}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-top: 8px; border-top: 1px solid #dee2e6;">
            <span><strong>Deuda:</strong></span>
            <span style="color: #dc3545; font-weight: bold;">AWG ${formatCurrency(
              facturaData.deuda
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
          montoInput.value = (facturaData.deuda / 2).toFixed(2);
        };

        totalBtn.onclick = () => {
          montoInput.value = facturaData.deuda.toFixed(2);
        };

        montoInput.focus();
      },
      preConfirm: () => {
        const value = document.getElementById("monto-payment-rapido").value;
        if (!value || parseFloat(value) <= 0) {
          Swal.showValidationMessage("Debe ingresar un monto válido mayor a 0");
          return false;
        }
        if (parseFloat(value) > facturaData.deuda) {
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
      const nuevosPayments = (facturaData.payment || 0) + payment;
      const nuevaDeuda = Math.max(0, facturaData.totalAmount - nuevosPayments);
      const facturaCompletamentePagada = nuevaDeuda === 0;

      // Actualizar la factura
      const facturaUpdates = {
        payment: parseFloat(nuevosPayments.toFixed(2)),
        deuda: parseFloat(nuevaDeuda.toFixed(2)),
      };

      const fechaPagoFinal = facturaData.fechapago || new Date().toISOString().split('T')[0];
      if (facturaCompletamentePagada) {
        facturaUpdates.pago = "Pago";
        facturaUpdates.fechapago = fechaPagoFinal;
      }

      await update(facturaRef, facturaUpdates);

      // Si está completamente pagada, actualizar todos los servicios asociados
      if (facturaCompletamentePagada) {
        // Buscar servicios asociados y actualizarlos
        const [dataSnapshot, registroFechasSnapshot] = await Promise.all([
          new Promise((resolve) =>
            onValue(ref(database, "data"), resolve, { onlyOnce: true })
          ),
          new Promise((resolve) =>
            onValue(ref(database, "registrofechas"), resolve, {
              onlyOnce: true,
            })
          ),
        ]);

        const serviciosAsociados = [];

        // Buscar en data
        if (dataSnapshot.exists()) {
          const dataVal = dataSnapshot.val();
          Object.entries(dataVal).forEach(([id, registro]) => {
            if (
              registro.referenciaFactura === numeroFactura ||
              registro.numerodefactura === numeroFactura
            ) {
              serviciosAsociados.push({ id, origin: "data" });
            }
          });
        }

        // Buscar en registrofechas
        if (registroFechasSnapshot.exists()) {
          const registroVal = registroFechasSnapshot.val();
          Object.entries(registroVal).forEach(([fecha, registros]) => {
            Object.entries(registros).forEach(([id, registro]) => {
              if (
                registro.referenciaFactura === numeroFactura ||
                registro.numerodefactura === numeroFactura
              ) {
                serviciosAsociados.push({
                  id,
                  fecha,
                  origin: "registrofechas",
                });
              }
            });
          });
        }

        // Actualizar todos los servicios
        const updatePromises = serviciosAsociados.map((servicio) => {
          const path =
            servicio.origin === "data"
              ? `data/${servicio.id}`
              : `registrofechas/${servicio.fecha}/${servicio.id}`;

          return update(ref(database, path), {
            pago: "Pago",
            fechapago: fechaPagoFinal
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
              <p>Se registró un payment de <strong>AWG ${formatCurrency(
                payment
              )}</strong></p>
              <p style="color: #28a745; font-weight: bold;">✅ Factura #${numeroFactura} marcada como PAGADA</p>
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
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "desc")
          return { key: "fecha", direction: "desc" }; // Volver a default
        return { key, direction: "desc" };
      }
      return { key, direction: "asc" };
    });
  };

  // EXPORTAR XLSX
  const generateXLSX = async () => {
    const exportData = filteredData.flatMap((item) =>
      item.registros.map((registro) => ({
        "Fecha Emisión": formatDate(registro.timestamp),

        "N° Factura": registro.numerodefactura || "",
        "A Nombre De": registro.anombrede || "",
        "Personalizado": registro.personalizado || "",
        "Dirección": registro.direccion || "",
        "Días de Mora": calculateDaysDelay(registro.timestamp, registro.pago),
        "Fecha de Pago": registro.numerodefactura 
          ? facturasData[registro.numerodefactura]?.fechapago || ""
          : registro.fechapago || "",
        "Estado Pago": registro.pago || "",
        "Valor Total": registro.valor || "",
        "Payment": formatCurrency(
          registro.numerodefactura && facturasData[registro.numerodefactura]
            ? facturasData[registro.numerodefactura].payment || 0
            : 0
        ),
        "Deuda": registro.numerodefactura && facturasData[registro.numerodefactura]
          ? formatCurrency(facturasData[registro.numerodefactura].deuda || 0)
          : "",
        "Factura Emitida": registro.factura ? "Sí" : "No",
      }))
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Facturas Emitidas");

    const headers = [
      "Fecha Emisión",
      "N° Factura",
      "A Nombre De",
      "Personalizado",
      "Dirección",
      "Días de Mora",
      "Fecha de Pago",
      "Estado Pago",
      "Valor Total",
      "Payment",
      "Deuda",
      "Factura Emitida",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F81BD" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    // Ajustar anchos de columnas
    worksheet.columns = [
      { width: 14 }, // Fecha Emisión
      
      { width: 12 }, // N° Factura
      { width: 20 }, // A Nombre De
      { width: 20 }, // Personalizado
      { width: 30 }, // Dirección
      { width: 12 }, // Días de Mora
      { width: 14 }, // Fecha de Pago
      { width: 12 }, // Estado Pago
      { width: 12 }, // Valor Total
      { width: 12 }, // Payment
      { width: 12 }, // Deuda
      { width: 12 }, // Factura Emitida
    ];

    exportData.forEach((rowData) => {
      const row = worksheet.addRow(Object.values(rowData));
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Facturas_Emitidas.xlsx";
    a.click();
    URL.revokeObjectURL(url);
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

      // 7) Usar datos del primer registro para información básica
      const pagoStatus = base.pago === "Pago" ? "Pago" : "Debe";

      // 8) Preparar filas usando los items de la factura
      const filas = [];
      if (facturaData.invoiceItems) {
        Object.entries(facturaData.invoiceItems).forEach(([key, item]) => {
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
        .text(`INVOICE NO: ${invoiceId}`, 152, mT + 35)
        .text(
          `DATE: ${facturaData.fechaEmision || new Date(facturaData.timestamp).toLocaleDateString()}`,
          152,
          mT + 40
        );

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
      
      // Mostrar información financiera
      const hasPayment = facturaData && facturaData.payment > 0;
      
      pdf.setFontSize(10);
      
      if (hasPayment) {
        pdf.text(`PAYMENT: AWG ${formatCurrency(facturaData.payment)}`, 152, afterY + 6);

        const balance = pagoStatus === "Pago" ? 0 : (facturaData.deuda || 0);
        pdf.text(`BALANCE DUE: AWG ${formatCurrency(balance)}`, 152, afterY + 11);
      } else {
        const balance = pagoStatus === "Pago" ? 0 : (facturaData.deuda || 0);
        pdf.text(`BALANCE DUE: AWG ${formatCurrency(balance)}`, 152, afterY + 6);
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
          base.fechapago || facturaData.fechapago || today.toLocaleDateString();
        ctx.globalAlpha = 0.4;
        ctx.font = "5px Arial";
        ctx.fillStyle = "green";
        ctx.fillText(fechaPagoDisplay, 0, 10);

        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, wPt, hPt);
      }

      // — Guarda el PDF —
      pdf.save(`Invoice-${invoiceId}.pdf`);

      // Mostrar mensaje de éxito
      Swal.fire({
        icon: "success",
        title: "PDF Generado",
        text: `La factura #${invoiceId} se ha generado correctamente.`,
        timer: 2000,
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
    // 1. Calcular número de factura estimado
    const availableNumsRef = ref(database, "facturasDisponibles");
    let invoiceIdEstimado = null;
    let usedAvailableKey = null;

    const availableSnapshot = await new Promise((resolve) => {
      onValue(availableNumsRef, resolve, { onlyOnce: true });
    });

    if (availableSnapshot.exists()) {
      // Hay números disponibles, usar el menor para mostrar
      const availableData = availableSnapshot.val();
      const sortedAvailable = Object.entries(availableData).sort(
        ([, a], [, b]) => a.numeroFactura.localeCompare(b.numeroFactura)
      );
      const [key, numeroData] = sortedAvailable[0];
      invoiceIdEstimado = numeroData.numeroFactura;
      usedAvailableKey = key;
    } else {
      // No hay números disponibles, calcular el siguiente número secuencial
      const numeroEstimado = await new Promise((resolve) => {
        const contadorRef = ref(database, "contadorFactura");
        onValue(
          contadorRef,
          (snapshot) => {
            resolve((snapshot.val() || 0) + 1);
          },
          { onlyOnce: true }
        );
      });

      // Formatear número de factura estimado
      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const seq = String(numeroEstimado).padStart(5, "0");
      invoiceIdEstimado = `${yy}${mm}${seq}`;
    }

    const today = new Date();

    const direccionesOptions = directions.sort().map(dir => 
    `<option value="${dir}">${dir}</option>`
  ).join('');

    // 2. Mostrar modal para ingresar datos de la factura manual
    const { value: res } = await Swal.fire({
      title: "Crear Factura Manual",
      html:
        `<div style="margin-bottom:15px;padding:12px;border:1px solid #ddd;border-radius:5px;background-color:#f9f9f9;">
          <h4 style="margin:0 0 10px 0;color:#333;">Nueva Factura Manual</h4>
          <div style="text-align: center; margin-top: 8px;">
            <span style="padding:8px 16px;border-radius:20px;font-weight:bold;font-size:16px;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
              Factura #${invoiceIdEstimado}
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
        <div style="position:relative;width:200px;">
          <input id="direccion" type="text" class="swal2-input" placeholder="Opcional o seleccionar" list="direcciones-list" style="width:100%;margin:0;font-size:12px;padding:4px 8px;" />
          <datalist id="direcciones-list">
            ${direccionesOptions}
          </datalist>
        </div>
      </div>` +
        `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
          <label style="min-width:100px;font-size:14px;">Personalizado:</label>
          <input id="personalizado" type="text" class="swal2-input" placeholder="Opcional" style="width:200px;margin:0;font-size:12px;padding:4px 8px;" />
        </div>` +
        `<hr style="color:transparent;"/>` +
        `<label>Bill To:</label>` +
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
              .map((i) => `<option value="${i}" ${i === "Septic Tank" ? "selected" : ""}>${i}</option>`)
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
        const personalizado = document.getElementById("personalizado").value.trim();
        const billToType = document.getElementById("bill-to-type").value;
        const customValue = document.getElementById("bill-to-custom").value.trim();

        // Los items se recogen de la variable 'addedItems' que está en el scope de didOpen
        if (!window.addedItems || window.addedItems.length === 0) {
          Swal.showValidationMessage(
            "Debe agregar al menos un item a la factura."
          );
          return false;
        }

        // Validaciones básicas (solo fecha de emisión es obligatoria)
        if (!fechaEmision) {
          Swal.showValidationMessage("Seleccione la fecha de emisión");
          return false;
        }
        if (!billToType) {
          Swal.showValidationMessage("Seleccione un tipo de Bill To");
          return false;
        }
        if (billToType === "personalizado" && !customValue) {
          Swal.showValidationMessage("Ingrese texto personalizado para Bill To");
          return false;
        }

        return {
          fechaEmision,
          anombrede,
          direccion,
          personalizado,
          facturaNumero: invoiceIdEstimado,
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
              }) - ${formatCurrency(item.amount)}<br><small style="color: #666;">Fecha: ${item.fechaServicioItem || 'No especificada'}</small></span>
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
                  <input id="custom-item-fecha-servicio" type="date" class="swal2-input" value="${today.toISOString().split("T")[0]}" style="width:100%;">
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
              document.getElementById("custom-item-fecha-servicio").value = existingDetails.fechaServicioItem;
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
              fechaServicioItem: document.getElementById("custom-item-fecha-servicio").value,
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
      // 3. Obtener número de factura final
      let invoiceIdFinal;
      let numeroFactura;

      if (usedAvailableKey) {
        // Usar número disponible
        invoiceIdFinal = invoiceIdEstimado;
        numeroFactura = parseInt(invoiceIdFinal.slice(-5));
        // Eliminar de números disponibles
        await set(ref(database, `facturasDisponibles/${usedAvailableKey}`), null);
      } else {
        // Generar nuevo número
        const contadorRef = ref(database, "contadorFactura");
        const tx = await runTransaction(contadorRef, (curr) => (curr || 0) + 1);
        numeroFactura = tx.snapshot.val();
        // Formatear YYMM + secuencia 5 dígitos
        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const seq = String(numeroFactura).padStart(5, "0");
        invoiceIdFinal = `${yy}${mm}${seq}`;
      }

      // 4. Calcular Bill To
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

      // 6. Preparar invoiceItems para el nodo factura
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

      // 7. Crear el nodo factura
      const facturaData = {
        numerodefactura: invoiceIdFinal,
        timestamp: Date.now(),
        fechaEmision: res.fechaEmision, // ✅ Guardar la fecha de emisión seleccionada
        billTo: billToValue,
        invoiceItems: invoiceItems,
        totalAmount: totalAmount,
        payment: 0, // Factura manual inicia sin payments
        deuda: totalAmount, // Deuda inicial = total
        pago: "Debe",
        fechapago: null,
      };

      await set(ref(database, `facturas/${invoiceIdFinal}`), facturaData);

      // 8. Crear registro en registrofechas
      const fechaKey = `${String(today.getDate()).padStart(2, "0")}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${today.getFullYear()}`;
      const groupRef = ref(database, `registrofechas/${fechaKey}`);
      const newRef = push(groupRef);

      await set(newRef, {
        timestamp: Date.now(),
        fecha: fechaKey,
        numerodefactura: invoiceIdFinal,
        referenciaFactura: invoiceIdFinal,
        anombrede: res.anombrede || "",
        direccion: res.direccion || "",
        personalizado: res.personalizado || "",
        servicio: "",
        cubicos: 0,
        valor: totalAmount,
        pago: "Debe",
        diasdemora: null,
        factura: true,
        fechapago: null,
      });

      Swal.fire({
        icon: "success",
        title: "Factura Manual Creada",
        text: `Factura #${invoiceIdFinal} creada exitosamente`,
        timer: 2000,
      });

    } catch (error) {
      console.error("Error creando factura manual:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo crear la factura manual",
      });
    }
  };

  // Función para cancelar factura (igual que en Hojadefechas)
  const cancelInvoice = async (fecha, registroId, numeroFactura, origin) => {
    try {
      // 1) ✅ BUSCAR TODOS LOS SERVICIOS RELACIONADOS CON LA FACTURA
      const serviciosRelacionados = [];
      
      // Buscar en dataBranch
      dataBranch.forEach(servicio => {
        if (servicio.numerodefactura === numeroFactura) {
          serviciosRelacionados.push({
            ...servicio,
            origin: 'data',
            path: `data/${servicio.id}`
          });
        }
      });
      
      // Buscar en dataRegistroFechas
      dataRegistroFechas.forEach(grupo => {
        grupo.registros.forEach(servicio => {
          if (servicio.numerodefactura === numeroFactura) {
            serviciosRelacionados.push({
              ...servicio,
              origin: 'registrofechas',
              path: `registrofechas/${grupo.fecha}/${servicio.id}`
            });
          }
        });
      });

      // 2) ✅ MOSTRAR INFORMACIÓN DETALLADA ANTES DE CANCELAR
      const serviciosInfo = serviciosRelacionados.map(servicio => 
        `• ${servicio.direccion} - ${servicio.fecha} (${servicio.pago})`
      ).join('\n');

      const { isConfirmed } = await Swal.fire({
        title: "¿Cancelar Factura?",
        html: `
          <div style="text-align: left;">
            <p><strong>Factura a cancelar:</strong> ${numeroFactura}</p>
            <p><strong>Servicios relacionados (${serviciosRelacionados.length}):</strong></p>
            <div style="max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0;">
              ${serviciosInfo || 'No se encontraron servicios relacionados'}
            </div>
            <p style="color: #d33; font-weight: bold;">⚠️ Esta acción:</p>
            <ul style="text-align: left; color: #d33;">
              <li>Eliminará completamente la factura</li>
              <li>Desvinculará ${serviciosRelacionados.length} servicios de esta factura</li>
              <li>El número de factura quedará disponible para reutilización</li>
            </ul>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, Cancelar Factura",
        cancelButtonText: "No, Mantener",
        confirmButtonColor: "#d33",
        width: "600px"
      });

      if (!isConfirmed) return;

      // 3) ✅ ELIMINAR EL NODO FACTURA COMPLETO
      if (numeroFactura) {
        await set(ref(database, `facturas/${numeroFactura}`), null);
      }

      // 4) ✅ LIMPIAR TODOS LOS SERVICIOS RELACIONADOS
      const updatePromises = serviciosRelacionados.map(async (servicio) => {
        const updateData = {
          // Limpiar campos de facturación
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
          timestamp: Date.now(),
        };
        
        return update(ref(database, servicio.path), updateData);
      });

      await Promise.all(updatePromises);

      // 5) ✅ AGREGAR EL NÚMERO DE FACTURA A LA LISTA DE DISPONIBLES
      if (numeroFactura) {
        const numerosDisponiblesRef = ref(database, "facturasDisponibles");
        const newAvailableRef = push(numerosDisponiblesRef);
        await set(newAvailableRef, {
          numeroFactura: numeroFactura,
          fechaCancelacion: Date.now(),
        });
      }

      // 6) ✅ ACTUALIZAR ESTADO LOCAL PARA TODOS LOS SERVICIOS
      const updater = (r) => {
        if (r.numerodefactura === numeroFactura) {
          return {
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
          };
        }
        return r;
      };

      // Actualizar dataBranch
      setDataBranch((prev) => prev.map(updater));
      
      // Actualizar dataRegistroFechas
      setDataRegistroFechas((prev) =>
        prev.map((g) => ({
          ...g,
          registros: g.registros.map(updater)
        }))
      );

      // 7) ✅ MOSTRAR CONFIRMACIÓN
      Swal.fire({
        icon: "success",
        title: "Factura Cancelada Exitosamente",
        html: `
          <div style="text-align: left;">
            <p><strong>Factura:</strong> ${numeroFactura}</p>
            <p><strong>Servicios desvinculados:</strong> ${serviciosRelacionados.length}</p>
            <p><strong>Estado:</strong> El número de factura quedó disponible para reutilización</p>
          </div>
        `,
        timer: 3000,
        width: "500px"
      });
    } catch (error) {
      console.error("Error cancelando factura:", error);
      Swal.fire({
        icon: "error",
        title: "Error al Cancelar Factura",
        text: "Hubo un error al cancelar la factura. Por favor, inténtalo de nuevo.",
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


        <label></label>
        <button
          type="button"
          className="filter-button"
          onClick={() => setShowPagoPicker((v) => !v)}
          style={{ display: "block", margin: "0.5rem 0" }}
        >
          {showPagoPicker ? "Ocultar selector" : "Filtrar Por Fecha De Pago"}
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
                <th>
                  <button
                    onClick={() => handleSort("numerodefactura")}
                    className="sort-button"
                    title="Ordenar por N° de Factura"
                  >
                    Factura
                    {sortConfig.key === "numerodefactura" &&
                      (sortConfig.direction === "asc" ? " ▲" : " ▼")}
                  </button>
                </th>
                <th>A Nombre De</th>
                <th>Personalizado</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Días de Mora</th>
                <th>Fecha de Pago</th>
                <th>Pago</th>
                <th>Total Amount</th>
                <th>Payment</th>
                <th>Deuda</th>
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
                        <input
                          type="date"
                          value={(() => {
                            // 1. Buscar primero en la factura
                            if (r.numerodefactura && facturasData[r.numerodefactura]) {
                              const factura = facturasData[r.numerodefactura];
                              if (factura.fechaEmision) {
                                // Si la fecha está en formato DD/MM/YYYY, convertir a YYYY-MM-DD
                                if (factura.fechaEmision.includes('/')) {
                                  const [day, month, year] = factura.fechaEmision.split('/');
                                  return `${year}-${month}-${day}`;
                                }
                                // Si ya está en formato YYYY-MM-DD, usar directamente
                                return factura.fechaEmision;
                              }
                            }
                            
                            // 2. Si no está en la factura, buscar en el servicio
                            if (r.fechaEmision) {
                              // Si la fecha está en formato DD/MM/YYYY, convertir a YYYY-MM-DD
                              if (r.fechaEmision.includes('/')) {
                                const [day, month, year] = r.fechaEmision.split('/');
                                return `${year}-${month}-${day}`;
                              }
                              // Si ya está en formato YYYY-MM-DD, usar directamente
                              return r.fechaEmision;
                            }
                            
                            // 3. Si no hay fecha de emisión específica, usar el timestamp
                            const timestamp = new Date(r.timestamp);
                            return timestamp.toISOString().split('T')[0];
                          })()}
                          onChange={(e) => {
                            // Convertir de YYYY-MM-DD a DD/MM/YYYY para Firebase
                            const [year, month, day] = e.target.value.split('-');
                            const fechaFormateada = `${day}/${month}/${year}`;
                            
                            // Prioridad: 1. Factura, 2. Servicio
                            if (r.numerodefactura && facturasData[r.numerodefactura]) {
                              // Si tiene factura, guardar en la factura
                              const facturaRef = ref(database, `facturas/${r.numerodefactura}`);
                              update(facturaRef, { fechaEmision: fechaFormateada }).catch(console.error);
                            } else {
                              // Si no tiene factura, guardar en el servicio
                              handleFieldChange(fecha, r.id, "fechaEmision", fechaFormateada, r.origin);
                            }
                          }}
                          className={`fecha-emision-input ${r.numerodefactura ? 'factura' : ''}`}
                          title={r.numerodefactura ? "Editar fecha de emisión de la factura" : "Fecha de emisión (timestamp)"}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => openFacturaModal(r.numerodefactura)}
                          className="numero-factura-btn"
                          title="Ver/Editar factura"
                        >
                          {r.numerodefactura}
                        </button>
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{ width: "16ch" }}
                          value={localValues[`${r.id}_anombrede`] ?? r.anombrede ?? ""}
                          onChange={(e) =>
                            setLocalValues(prev => ({
                              ...prev,
                              [`${r.id}_anombrede`]: e.target.value
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.anombrede || "")) {
                              handleFieldChange(
                                fecha,
                                r.id,
                                "anombrede",
                                e.target.value,
                                r.origin
                              );
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
                            setLocalValues(prev => ({
                              ...prev,
                              [`${r.id}_personalizado`]: e.target.value
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.personalizado || "")) {
                              handleFieldChange(
                                fecha,
                                r.id,
                                "personalizado",
                                e.target.value,
                                r.origin
                              );
                            }
                          }}
                        />
                      </td>
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            className="direccion-fixed-input"
                            style={{ width: "18ch" }}
                            type="text"
                            list={`dirs-${r.id}`}
                            value={localValues[`${r.id}_direccion`] ?? r.direccion ?? ""}
                            onChange={(e) =>
                              setLocalValues(prev => ({
                                ...prev,
                                [`${r.id}_direccion`]: e.target.value
                              }))
                            }
                            onBlur={(e) => {
                              if (e.target.value !== (r.direccion || "")) {
                                handleFieldChange(
                                  fecha,
                                  r.id,
                                  "direccion",
                                  e.target.value,
                                  r.origin
                                );
                              }
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ textAlign: "center", width: "6ch" }}>
                        {calculateDaysDelay(r.timestamp, r.pago)}
                      </td>
                      <td>
                        <input
                          type="date"
                          value={
                            r.numerodefactura 
                              ? facturasData[r.numerodefactura]?.fechapago || ""
                              : r.fechapago || ""
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              fecha,
                              r.id,
                              r.numerodefactura ? "fechapago_factura" : "fechapago",
                              e.target.value,
                              r.origin
                            )
                          }
                          style={{
                            backgroundColor: r.numerodefactura ? "#f0f8ff" : "white",
                            borderColor: r.numerodefactura ? "#007bff" : "#ccc",
                          }}
                          title={
                            r.numerodefactura 
                              ? `Fecha de pago de la factura #${r.numerodefactura}`
                              : "Fecha de pago del servicio individual"
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
                      <td className="factura-amount-cell" style={{ textAlign: "center" }}>
                        {r.numerodefactura && facturasData[r.numerodefactura] 
                          ? formatCurrency(facturasData[r.numerodefactura].totalAmount || 0)
                          : formatCurrency(r.valor || 0)
                        }
                      </td>
                      <td className="factura-payment-cell" style={{ textAlign: "center" }}>
                        {r.numerodefactura && facturasData[r.numerodefactura] 
                          ? formatCurrency(facturasData[r.numerodefactura].payment || 0)
                          : "N/A"
                        }
                      </td>
                      <td className="factura-deuda-cell" style={{ textAlign: "center" }}>
                        {r.numerodefactura && facturasData[r.numerodefactura] 
                          ? formatCurrency(facturasData[r.numerodefactura].deuda || 0)
                          : "N/A"
                        }
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => openFacturaModal(r.numerodefactura)}
                          className="ver-editar-btn"
                          title="Ver/Editar factura"
                        >
                          Ver/Editar
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {r.numerodefactura && r.pago !== "Pago" ? (
                          <button
                            onClick={() => paymentRapido(r.numerodefactura)}
                            className="payment-rapido-btn"
                            title={`Payment rápido para factura ${r.numerodefactura}`}
                          >
                            Payment
                          </button>
                        ) : (
                          <span className={`estado-pago-span ${r.pago === "Pago" ? "pagada" : ""}`}>
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
                            className="cancelar-factura-btn"
                            title={`Cancelar factura ${r.numerodefactura}`}
                          >
                            Cancelar Factura
                          </button>
                        ) : (
                          <span className="estado-pago-span">
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

      {/* Botón flotante para exportar Excel */}
      <button className="generate-button2" onClick={generateXLSX}>
        <img className="generate-button-imagen2" src={excel_icon} alt="Excel" />
      </button>

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
