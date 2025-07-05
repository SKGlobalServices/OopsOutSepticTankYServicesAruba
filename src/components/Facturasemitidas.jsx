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

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(200);

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
    numerodefactura: [],
    anombrede: [],
    diasdemora: [],
    fechaEmision: [null, null],
    fechaServicio: [null, null],
    factura: "true",
    pago: [],
    item: [],
    descripcion: "",
    personalizado: "",
    qtyMin: "",
    qtyMax: "",
    rateMin: "",
    rateMax: "",
    amountMin: "",
    amountMax: "",
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

  // ② Carga desde Firebase (“configuraciondefactura”)
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

  const anombredeOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.anombrede).filter(Boolean)
      )
    )
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const direccionOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.direccion).filter(Boolean)
      )
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }));

  const servicioOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.servicio).filter(Boolean)
      )
    )
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const cubicosOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.cubicos).filter(Boolean)
      )
    )
  )
    .sort((a, b) => a - b)
    .map((v) => ({ value: v.toString(), label: v.toString() }));

  const valorOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.valor).filter(Boolean)
      )
    )
  )
    .sort((a, b) => a - b)
    .map((v) => ({ value: v.toString(), label: v.toString() }));

  const pagoOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.pago).filter(Boolean)
      )
    )
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const formadePagoOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.formadepago).filter(Boolean)
      )
    )
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const BancoOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.banco).filter(Boolean)
      )
    )
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const metododepagoOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.metododepago).filter(Boolean)
      )
    )
  )
    .sort()
    .map((v) => ({ value: v, label: v }));

  const efectivoOptions = Array.from(
    new Set(
      allRegistros.flatMap((item) =>
        item.registros.map((r) => r.efectivo).filter(Boolean)
      )
    )
  )
    .sort((a, b) => a - b)
    .map((v) => ({ value: v.toString(), label: v.toString() }));

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

    // 3) Multi-select: número de factura
    if (
      filters.numerodefactura.length > 0 &&
      !filters.numerodefactura.includes(r.numerodefactura)
    )
      return false;

    // 4) Multi-select: A Nombre De
    if (
      filters.anombrede.length > 0 &&
      !filters.anombrede.includes(r.anombrede)
    )
      return false;

    // 5) Multi-select: Dirección
    if (
      filters.direccion.length > 0 &&
      !filters.direccion.includes(r.direccion)
    )
      return false;

    // 6) Días de Mora
    if (filters.diasdemora.length > 0) {
      const dias = calculateDaysDelay(r.timestamp, r.pago);
      const matchDias = filters.diasdemora.some((v) =>
        v === "10+" ? dias >= 10 : dias === +v
      );
      if (!matchDias) return false;
    }

    // 7) Factura sí/no
    if (filters.factura !== "" && r.factura !== (filters.factura === "true"))
      return false;

    // 8) Multi-select: Item
    if (filters.item.length > 0 && !filters.item.includes(r.item)) return false;

    // 9) Subcadena: Descripción
    if (
      filters.descripcion &&
      !r.descripcion?.toLowerCase().includes(filters.descripcion.toLowerCase())
    )
      return false;

    // 10) Subcadena: Personalizado
    if (
      filters.personalizado &&
      !r.personalizado
        ?.toLowerCase()
        .includes(filters.personalizado.toLowerCase())
    )
      return false;

    // 11) Rangos numéricos: qty
    if (filters.qtyMin && (r.qty == null || r.qty < parseFloat(filters.qtyMin)))
      return false;
    if (filters.qtyMax && (r.qty == null || r.qty > parseFloat(filters.qtyMax)))
      return false;

    // 12) Rangos numéricos: rate
    if (
      filters.rateMin &&
      (r.rate == null || r.rate < parseFloat(filters.rateMin))
    )
      return false;
    if (
      filters.rateMax &&
      (r.rate == null || r.rate > parseFloat(filters.rateMax))
    )
      return false;

    // 13) Rangos numéricos: amount
    if (
      filters.amountMin &&
      (r.amount == null || r.amount < parseFloat(filters.amountMin))
    )
      return false;
    if (
      filters.amountMax &&
      (r.amount == null || r.amount > parseFloat(filters.amountMax))
    )
      return false;

    // 14) Multi-select: Pago  
    if (filters.pago.length > 0) {
      const pagoValue = r.pago === "Pago" || r.pago === true; // Normalizar: "Pago" = true, otros = false
      if (!filters.pago.includes(pagoValue)) return false;
    }

    return true;
  });

  // 3) AGRUPA DE NUEVO POR FECHA PARA LA TABLA
  const grouped = filtrados.reduce((acc, r) => {
    (acc[r.fecha] = acc[r.fecha] || []).push(r);
    return acc;
  }, {});
  const filteredData = Object.entries(grouped)
    .map(([fecha, registros]) => ({ fecha, registros }))
    .sort((a, b) => {
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

    // Si cambió item, qty o rate, recalcular amount
    let updates = { [field]: safeValue };

    // Obtener registro local
    const registro = fromData
      ? dataBranch.find((r) => r.id === registroId) || {}
      : dataRegistroFechas
          .find((g) => g.fecha === fecha)
          ?.registros.find((r) => r.id === registroId) || {};

    // Logic para qty y rate
    if (field === "qty" || field === "rate") {
      const qty =
        field === "qty"
          ? parseFloat(safeValue) || 0
          : parseFloat(registro.qty) || 0;
      const rate =
        field === "rate"
          ? parseFloat(safeValue) || 0
          : parseFloat(registro.rate) || 0;
      updates.qty = qty;
      updates.rate = rate;
      updates.amount = parseFloat((qty * rate).toFixed(2));
    }

    // Logic para item
    if (field === "item") {
      const newRate = ITEM_RATES[safeValue] ?? 0;
      const qty = parseFloat(registro.qty) || 0;
      updates.rate = parseFloat(newRate.toFixed(2));
      updates.amount = parseFloat((newRate * qty).toFixed(2));
    }

    // Grabar todo en Firebase de una sola vez
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

  const calculateDaysDelay = (timestamp, pagoStatus) => {
    if (pagoStatus === "Pago") return 0; // Si está pagada, no hay mora
    const days = Math.floor((currentTime - timestamp) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
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

  const itemOptions = React.useMemo(
    () =>
      Object.keys(ITEM_RATES).map((key) => ({
        value: key,
        label: key,
      })),
    []
  );

  // SELECCIÓN
  const handleSelectRow = (id) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openConfigModal = () => {
    Swal.fire({
      title: "Configuración de la factura",
      html:
        // Campo para “Nombre de la empresa”
        `<input
         id="swal-company"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Nombre de la empresa"
         value="${invoiceConfig.companyName || ""}"
       >` +
        // Campo para “Direccion”
        `<input
         id="swal-address"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Dirección"
         value="${invoiceConfig.address || ""}"
       >` +
        // Campo para “País”
        `<input
         id="swal-country"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="País"
         value="${invoiceConfig.country || ""}"
       >` +
        // Campo para “Ciudad”
        `<input
         id="swal-city"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Ciudad"
         value="${invoiceConfig.city || ""}"
       >` +
        // Campo para “Código Postal”
        `<input
         id="swal-postal"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Código Postal"
         value="${invoiceConfig.postalCode || ""}"
       >` +
        // Campo para “Teléfono”
        `<input
         id="swal-phone"
         type="text"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Teléfono"
         value="${invoiceConfig.phone || ""}"
       >` +
        // Campo para “Correo electrónico”
        `<input
         id="swal-email"
         type="email"
         class="swal2-input"
         style="width: 80%;"
         placeholder="Correo electrónico"
         value="${invoiceConfig.email || ""}"
       >` +
        // Campo para “Bank Info”
        `<textarea
         id="swal-bank"
         class="swal2-textarea"
         style="width: 80%;"
         placeholder="Bank Info"
       >${invoiceConfig.bankInfo || ""}</textarea>` +
        // Campo para “Pie de página”
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

  // Función para editar descripción con Swal
  const handleDescriptionClick = (fecha, registroId, currentDesc, origin) => {
    Swal.fire({
      title: "Descripción",
      input: "textarea",
      inputLabel: "Descripción",
      inputValue: currentDesc || "",
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        handleFieldChange(
          fecha,
          registroId,
          "descripcion",
          result.value,
          origin
        );
        Swal.fire("Guardado", "Descripción guardada correctamente", "success");
      }
    });
  };

  // Generar factura
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

        // buscamos el registro "base" dentro de filteredData en lugar de facturas
        const allRecs = filteredData.flatMap((g) => g.registros);
        const base = allRecs.find((r) => selectedRows.includes(r.id));
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

    // 3) Extraer datos seleccionados desde filteredData
    const allRecs = filteredData.flatMap((g) => g.registros);
    const selectedData = allRecs.filter((r) => selectedRows.includes(r.id));
    const base = selectedData[0];
    const pagoStatus = base.pago === "Pago" ? "Pago" : "Debe";

    // 4) Calcular Bill To
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

    // 5) Preparar filas y total
    const filas = selectedData.map((r) => [
      r.fecha,
      r.item || "",
      r.descripcion || "",
      r.qty != null ? r.qty.toString() : "",
      r.rate != null ? (parseFloat(r.rate) || 0).toFixed(2) : "",
      r.amount != null ? (parseFloat(r.amount) || 0).toFixed(2) : "",
    ]);

    const totalAmount = filas.reduce(
      (sum, row) => sum + parseFloat(row[5] || 0),
      0
    );
    // 6) Incrementar contador y obtener número de factura
    // const contadorRef = ref(database, "contadorFactura");

    // 6a) Formatear YYMM + secuencia 5 dígitos
    const today = new Date();
    const invoiceId = base.numerodefactura; // "25060001"

    // 7) Generar PDF
    const pdf = new jsPDF("p", "mm", "a4");
    const mL = 10,
      mT = 10,
      logoSize = 28;
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

    // — Empresa —
    const textX = mL + logoSize * 2.5 + 5;
    pdf.setFontSize(16).text(invoiceConfig.companyName, textX, mT + 5);
    pdf
      .setFontSize(10)
      .text(`Address: ${invoiceConfig.address}`, textX, mT + 11)
      .text(
        `${invoiceConfig.city}, ${invoiceConfig.country}, ${invoiceConfig.postalCode}`,
        textX,
        mT + 16
      )
      .text(`Tel: ${invoiceConfig.phone}`, textX, mT + 21)
      .text(`Email: ${invoiceConfig.email}`, textX, mT + 26);

    // — Número y fecha —
    pdf
      .setFontSize(12)
      .text(`INVOICE NO: ${invoiceId}`, 152, mT + 35)
      .text(`DATE: ${today.toLocaleDateString()}`, 152, mT + 40);

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
    const balance = pagoStatus === "Pago" ? 0 : totalAmount;
    pdf
      .setFontSize(10)
      .text(`BALANCE DUE: AWG${balance.toFixed(2)}`, 152, afterY + 6);

    // — Bank Info y footer —
    const bankY = afterY + 6;
    pdf.text("Bank Info:", mL, bankY);
    pdf
      .setFontSize(9)
      .text(pdf.splitTextToSize(invoiceConfig.bankInfo, 80), mL, bankY + 6);
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

      const pagoDate = base.fechapago || today.toLocaleDateString();
      ctx.globalAlpha = 0.4;
      ctx.font = "5px Arial";
      ctx.fillStyle = "green";
      ctx.fillText(pagoDate, 0, 10);

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, wPt, hPt);

      // — PAYMENT total —
      pdf
        .setFontSize(10)
        .text(`PAYMENT: AWG${totalAmount.toFixed(2)}`, 152, afterY + 12);
    }

    // — Guarda el PDF —
    pdf.save(`Invoice-${invoiceId}.pdf`);
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

    // 3) Calcular la clave “hoy” con guiones
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
        <label>Item</label>
        <Select
          isClearable
          isMulti
          options={itemOptions}
          placeholder="Item(s)..."
          value={filters.item.map((v) => ({ value: v, label: v }))}
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              item: opts ? opts.map((o) => o.value) : [],
            }))
          }
        />

        <label>Descripción</label>
        <input
          type="text"
          placeholder="Buscar descripción"
          value={filters.descripcion}
          onChange={(e) =>
            setFilters({ ...filters, descripcion: e.target.value })
          }
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

        {/* QTY */}
        <label>Qty</label>
        <div style={{ display: "flex", gap: "4px" }}>
          <input
            type="number"
            placeholder="Min"
            value={filters.qtyMin}
            onChange={(e) => setFilters({ ...filters, qtyMin: e.target.value })}
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.qtyMax}
            onChange={(e) => setFilters({ ...filters, qtyMax: e.target.value })}
          />
        </div>

        {/* Rate */}
        <label>Rate</label>
        <div style={{ display: "flex", gap: "4px" }}>
          <input
            type="number"
            placeholder="Min"
            value={filters.rateMin}
            onChange={(e) =>
              setFilters({ ...filters, rateMin: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.rateMax}
            onChange={(e) =>
              setFilters({ ...filters, rateMax: e.target.value })
            }
          />
        </div>

        {/* Amount */}
        <label>Amount</label>
        <div style={{ display: "flex", gap: "4px" }}>
          <input
            type="number"
            placeholder="Min"
            value={filters.amountMin}
            onChange={(e) =>
              setFilters({ ...filters, amountMin: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.amountMax}
            onChange={(e) =>
              setFilters({ ...filters, amountMax: e.target.value })
            }
          />
        </div>

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
              direccion: [],
              numerodefactura: [],
              anombrede: [],
              diasdemora: [],
              factura: "true",
              pago: [],
              item: [],
              descripcion: "",
              personalizado: "",
              qtyMin: "",
              qtyMax: "",
              rateMin: "",
              rateMax: "",
              amountMin: "",
              amountMax: "",
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
                <th>Factura</th>
                <th>A Nombre De</th>
                <th>Personalizado</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Días de Mora</th>
                <th>Item</th>
                <th>Descripción</th>
                <th>qty</th>
                <th>rate</th>
                <th>amount</th>
                <th>Fecha de pago</th>
                <th>Pago</th>
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
                        {r.numerodefactura}
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
                        <select
                          value={r.item || ""}
                          style={{ width: "28ch" }}
                          onChange={(e) =>
                            handleFieldChange(
                              fecha,
                              r.id,
                              "item",
                              e.target.value,
                              r.origin
                            )
                          }
                        >
                          <option value=""></option>
                          <option value="Septic Tank">Septic Tank</option>
                          <option value="Pipes Cleaning">Pipes Cleaning</option>
                          <option value="Services">Services</option>
                          <option value="Grease Trap">Grease Trap</option>
                          <option value="Grease Trap & Pipe Cleanings">
                            Grease Trap & Pipe Cleanings
                          </option>
                          <option value="Septic Tank & Grease Trap">
                            Septic Tank & Grease Trap
                          </option>
                          <option value="Dow Temporal">Dow Temporal</option>
                          <option value="Water Truck">Water Truck</option>
                          <option value="Pool">Pool</option>
                        </select>
                      </td>
                      <td>
                        <button
                          style={{
                            border: "none",
                            backgroundColor: "transparent",
                            borderRadius: "0.25em",
                            color: "black",
                            padding: "0.2em 0.5em",
                            cursor: "pointer",
                            fontSize: "1em",
                            maxWidth: "20ch",
                            textAlign: "left",
                            width: "100%",
                          }}
                          onClick={() =>
                            handleDescriptionClick(
                              fecha,
                              r.id,
                              r.descripcion,
                              r.origin
                            )
                          }
                        >
                          {r.descripcion ? (
                            <p
                              style={{
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {r.descripcion}
                            </p>
                          ) : (
                            <span
                              style={{
                                width: "100%",
                                display: "inline-block",
                              }}
                            />
                          )}
                        </button>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          style={{ width: "6ch", textAlign: "center" }}
                          value={r.qty || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              fecha,
                              r.id,
                              "qty",
                              e.target.value,
                              r.origin
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*([.][0-9]{0,2})?"
                          style={{ width: "10ch", textAlign: "center" }}
                          value={
                            editingRate[r.id] != null
                              ? editingRate[r.id]
                              : r.rate != null
                              ? r.rate.toFixed(2)
                              : ""
                          }
                          onFocus={() => {
                            setEditingRate((prev) => ({
                              ...prev,
                              [r.id]: r.rate != null ? r.rate.toFixed(2) : "",
                            }));
                          }}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            setEditingRate((prev) => ({
                              ...prev,
                              [r.id]: raw,
                            }));
                            handleFieldChange(
                              fecha,
                              r.id,
                              "rate",
                              raw,
                              r.origin
                            );
                          }}
                          onBlur={() => {
                            setEditingRate((prev) => {
                              const next = { ...prev };
                              delete next[r.id];
                              return next;
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.target.select();
                            }
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {r.amount != null
                          ? (parseFloat(r.amount) || 0).toFixed(2)
                          : "0.00"}
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
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "1rem",
          padding: "0.5rem",
          background: "#f5f5f5",
          borderRadius: "4px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span>
              Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems} clientes
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label>Mostrar:</label>
              <select 
                value={itemsPerPage} 
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                style={{ padding: "0.25rem" }}
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button 
              onClick={goToFirstPage} 
              disabled={currentPage === 1}
              style={{ padding: "0.25rem 0.5rem" }}
            >
              ««
            </button>
            <button 
              onClick={goToPreviousPage} 
              disabled={currentPage === 1}
              style={{ padding: "0.25rem 0.5rem" }}
            >
              «
            </button>
            <span style={{ margin: "0 1rem" }}>
              Página {currentPage} de {totalPages}
            </span>
            <button 
              onClick={goToNextPage} 
              disabled={currentPage === totalPages}
              style={{ padding: "0.25rem 0.5rem" }}
            >
              »
            </button>
            <button 
              onClick={goToLastPage} 
              disabled={currentPage === totalPages}
              style={{ padding: "0.25rem 0.5rem" }}
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
    </div>
  );
};

export default Facturasemitidas;
