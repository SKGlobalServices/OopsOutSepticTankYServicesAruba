import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import {
  ref,
  set,
  onValue,
  update,
  push,
  runTransaction,
} from "firebase/database";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { jsPDF } from "jspdf";
import Swal from "sweetalert2";
import autoTable from "jspdf-autotable";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import Select from "react-select";
import filtericon from "../assets/img/filters_icon.jpg";
import logotipo from "../assets/img/logo.png";

const Facturasemitidas = () => {
  const [facturas, setFacturas] = useState([]);
  const [clients, setClients] = useState([]);
  const [directions, setDirections] = useState([]);
  const [filter, setFilter] = useState({ direccion: [] });
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedRows, setSelectedRows] = useState([]);
  // LOADER
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedRegistro, setLoadedRegistro] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);
  const [loadedFacturas, setLoadedFacturas] = useState(false);
  // Estados para los datos:
  const [dataBranch, setDataBranch] = useState([]);
  const [dataRegistroFechas, setDataRegistroFechas] = useState([]);
  const [todos, setTodos] = useState([]);

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
    servicio: [],
    cubicos: [],
    valor: [],
    diasdemora: [],
    fechaEmision: [null, null],
    fechaServicio: [null, null],
    pago: [],
    factura: "true",
    item: [],
    descripcion: "",
    qtyMin: "",
    qtyMax: "",
    rateMin: "",
    rateMax: "",
    amountMin: "",
    amountMax: "",
  });

  // Reloj interno
  useEffect(() => {
    setCurrentTime(Date.now());

    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  // 1️⃣ Datos “data”
  useEffect(() => {
    const dbRef = ref(database, "data");
    const unsubscribe = onValue(dbRef, (snap) => {
      if (snap.exists()) {
        const list = Object.entries(snap.val()).map(([id, rec]) => ({
          origin: "data",
          id,
          factura: rec.factura ?? false,
          ...rec,
        }));
        setDataBranch(list);
      } else {
        setDataBranch([]);
      }
      setLoadedData(true);
    });
    return unsubscribe;
  }, []);

  // 2️⃣ Datos “registrofechas”
  useEffect(() => {
    const dbRef = ref(database, "registrofechas");
    const unsubscribe = onValue(dbRef, (snap) => {
      if (snap.exists()) {
        const groups = Object.entries(snap.val());

        const list = groups.flatMap(([fecha, regs]) =>
          Object.entries(regs).map(([id, rec]) => ({
            origin: "registrofechas",
            id,
            factura: rec.factura ?? false,
            ...rec,
          }))
        );
        setDataRegistroFechas(list);
      } else {
        setDataRegistroFechas([]);
      }
      setLoadedRegistro(true);
    });
    return unsubscribe;
  }, []);

  // Cargar facturas
  useEffect(() => {
    const factRef = ref(database, "facturasemitidas");
    const unsubscribe = onValue(factRef, (snap) => {
      const data = [];
      snap.forEach((child) => {
        const rec = child.val();
        data.push({
          id: child.key,
          factura: rec.factura ?? false,
          ...rec,
        });
      });
      data.sort((a, b) => b.timestamp - a.timestamp);
      setFacturas(data);
      setLoadedFacturas(true);
    });
    return unsubscribe;
  }, []);

  // Cargar clientes y extraer direcciones
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

  useEffect(() => {
    const configRef = ref(database, "configuraciondefactura");
    return onValue(configRef, (snap) => {
      if (snap.exists()) {
        setInvoiceConfig(snap.val());
      }
    });
  }, []);

  // Formatea fecha y duración
  const formatDate = (ts) => {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };
  const formatDuration = (ms) => {
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${days}d ${hours}h ${minutes}m`;
  };

  // Handle cambios en la factura
  /**
   * Maneja cambios de campo en Firebase y sincroniza estado local
   *
   * @param {"data"|"registrofechas"|"facturasemitidas"} origin  Origen del registro
   * @param {string} id                                         ID del registro
   * @param {string} field                                      Nombre del campo a actualizar
   * @param {any} value                                         Nuevo valor
   * @param {string} [fecha]                                    Fecha (solo para registrofechas)
   */
  function handleFieldChange(origin, id, field, value, fecha = "") {
    const safeValue = value ?? "";

    // 1) Construir la ruta según el origen
    let path;
    if (origin === "data") {
      path = `data/${id}`;
    } else if (origin === "registrofechas") {
      path = `registrofechas/${fecha}/${id}`;
    } else if (origin === "facturasemitidas") {
      path = `facturasemitidas/${id}`;
    } else {
      console.error("Origen desconocido en handleFieldChange:", origin);
      return;
    }
    const dbRefItem = ref(database, path);

    // 2) Actualización inicial en Firebase
    update(dbRefItem, { [field]: safeValue }).catch(console.error);

    // 3) Lógica de recálculo para qty y rate
    const applyLocalUpdate = (updater) => {
      switch (origin) {
        case "data":
          setDataBranch((prev) => prev.map(updater));
          break;
        case "registrofechas":
          setDataRegistroFechas((prev) =>
            prev.map((g) =>
              g.fecha === fecha
                ? { ...g, registros: g.registros.map(updater) }
                : g
            )
          );
          break;
        case "facturasemitidas":
          setFacturas((prev) => prev.map(updater));
          break;
      }
    };

    // Helper: obtener el registro actual desde el estado
    const registro =
      origin === "data"
        ? dataBranch.find((r) => r.id === id) || {}
        : origin === "registrofechas"
        ? dataRegistroFechas
            .find((g) => g.fecha === fecha)
            ?.registros.find((r) => r.id === id) || {}
        : facturas.find((f) => f.id === id) || {};

    // 3a) Si cambió qty → recalcular amount
    if (field === "qty") {
      const newQty = parseFloat(safeValue) || 0;
      const rate = parseFloat(registro.rate) || 0;
      const newAmount = parseFloat((newQty * rate).toFixed(2));

      update(dbRefItem, { qty: newQty, amount: newAmount }).catch(
        console.error
      );

      applyLocalUpdate((r) =>
        r.id === id ? { ...r, qty: newQty, amount: newAmount } : r
      );
      return;
    }

    // 3b) Si cambió rate → recalcular amount
    if (field === "rate") {
      const newRate = parseFloat(safeValue) || 0;
      const qty = parseFloat(registro.qty) || 0;
      const newAmount = parseFloat((newRate * qty).toFixed(2));

      update(dbRefItem, { rate: newRate, amount: newAmount }).catch(
        console.error
      );

      applyLocalUpdate((r) =>
        r.id === id ? { ...r, rate: newRate, amount: newAmount } : r
      );
      return;
    }

    // 4) Actualizar cualquier otro campo
    applyLocalUpdate((r) => (r.id === id ? { ...r, [field]: safeValue } : r));
  }

  // 3️⃣ Combina y ordena
  useEffect(() => {
    const all = [
      ...facturas.map((f) => ({ origin: "facturasemitidas", ...f })),
      ...dataBranch,
      ...dataRegistroFechas,
    ];
    // orden descendente por timestamp
    all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    // sólo dejamos los que `factura === true`
    const visible = all.filter((item) => item.factura === true);
    setTodos(visible);
  }, [facturas, dataBranch, dataRegistroFechas]);

  // Confirmación de pago
  const confirmPagoChange = (id, checked) => {
    Swal.fire({
      title: checked
        ? "¿Deseas marcar esta factura como pagada?"
        : "¿Deseas reanudar la cuenta de cobro?",
      icon: "question",
      showCancelButton: true,
      cancelButtonText: "No",
      confirmButtonText: "Sí",
    }).then((res) => {
      if (res.isConfirmed) {
        handleFieldChange(id, "pago", checked);
        Swal.fire({
          title: "¡Listo!",
          text: checked
            ? "El registro ha sido MARCADO"
            : "El registro ha sido REANUDADO",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      }
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
  const handleFilterChange = (opts) =>
    setFilter({
      direccion: opts ? opts.map((o) => o.value) : [],
    });
  const resetFilters = () => setFilter({ direccion: [] });

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

  const invoiceOptions = React.useMemo(
    () =>
      [...new Set(facturas.map((f) => String(f.numerodefactura)))].map((v) => ({
        value: v,
        label: v,
      })),
    [facturas]
  );
  const nameOptions = React.useMemo(
    () =>
      [...new Set(facturas.map((f) => f.anombrede))].map((v) => ({
        value: v,
        label: v,
      })),
    [facturas]
  );
  const directionOptions = React.useMemo(() => {
    return [...new Set(facturas.map((f) => f.direccion))]
      .filter((d) => d) // elimina vacíos
      .map((d) => ({ value: d, label: d }));
  }, [facturas]);
  const servicioOptions = React.useMemo(
    () =>
      [...new Set(facturas.map((f) => f.servicio))].map((v) => ({
        value: v,
        label: v,
      })),
    [facturas]
  );
  const cubicosOptions = React.useMemo(
    () =>
      [...new Set(facturas.map((f) => String(f.cubicos)))].map((v) => ({
        value: v,
        label: v,
      })),
    [facturas]
  );
  const valorOptions = React.useMemo(
    () =>
      [...new Set(facturas.map((f) => String(f.valor)))].map((v) => ({
        value: v,
        label: v,
      })),
    [facturas]
  );
  const moraOptions = React.useMemo(() => {
    const opts = [];
    for (let i = 1; i <= 100; i++) {
      opts.push({ value: `${i}`, label: `${i}` });
    }
    opts.push({ value: "10+", label: "10+" });
    return opts;
  }, []);

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

  const itemOptions = React.useMemo(
    () =>
      Object.keys(ITEM_RATES).map((key) => ({
        value: key,
        label: key,
      })),
    []
  );

  const filteredFacturas = facturas.filter((f) => {
    // 0) Solo facturas con factura===true
    if (f.factura !== true) return false;

    // 1) Rango de fechaEmision
    if (filters.fechaEmision[0] && filters.fechaEmision[1]) {
      const [from, to] = filters.fechaEmision;
      if (f.timestamp < from.getTime() || f.timestamp > to.getTime())
        return false;
    }

    // 2) Rango de fechaServicio
    if (filters.fechaServicio[0] && filters.fechaServicio[1]) {
      const [day, month, year] = f.fecha.split("-");
      const servTs = new Date(+year, +month - 1, +day).getTime();
      const [fromS, toS] = filters.fechaServicio;
      if (servTs < fromS.getTime() || servTs > toS.getTime()) {
        return false;
      }
    }

    // 3) Dirección
    if (
      filters.direccion.length > 0 &&
      !filters.direccion.includes(f.direccion)
    )
      return false;

    // 4) Número de factura
    if (
      filters.numerodefactura.length > 0 &&
      !filters.numerodefactura.includes(String(f.numerodefactura))
    )
      return false;

    // 5) A nombre de
    if (
      filters.anombrede.length > 0 &&
      !filters.anombrede.includes(f.anombrede)
    )
      return false;

    // 6) Servicio
    if (filters.servicio.length > 0 && !filters.servicio.includes(f.servicio))
      return false;

    // 7) Cúbicos
    if (
      filters.cubicos.length > 0 &&
      !filters.cubicos.includes(String(f.cubicos))
    )
      return false;

    // 8) Valor
    if (filters.valor.length > 0 && !filters.valor.includes(String(f.valor)))
      return false;

    // 9) Días de mora
    if (filters.diasdemora.length > 0) {
      const days = f.diasdemora
        ? parseInt(f.diasdemora, 10)
        : Math.floor((currentTime - f.timestamp) / 86_400_000);
      const ok = filters.diasdemora.some((sel) =>
        sel === "10+" ? days >= 10 : days === parseInt(sel, 10)
      );
      if (!ok) return false;
    }

    // 10) Pago
    if (filters.pago.length > 0) {
      const isPaid = Boolean(f.pago);
      if (!filters.pago.includes(isPaid)) return false;
    }

    // ── filtros extra ──

    // 11) Item
    if (filters.item.length > 0 && !filters.item.includes(f.item)) {
      return false;
    }

    // 12) Descripción (subcadena, case-insensitive)
    if (
      filters.descripcion &&
      !f.descripcion?.toLowerCase().includes(filters.descripcion.toLowerCase())
    ) {
      return false;
    }

    // 13) Qty mínimo/máximo
    const qty = Number(f.qty) || 0;
    if (filters.qtyMin && qty < Number(filters.qtyMin)) return false;
    if (filters.qtyMax && qty > Number(filters.qtyMax)) return false;

    // 14) Rate mínimo/máximo
    const rate = Number(f.rate) || 0;
    if (filters.rateMin && rate < Number(filters.rateMin)) return false;
    if (filters.rateMax && rate > Number(filters.rateMax)) return false;

    // 15) Amount mínimo/máximo
    const amount = Number(f.amount) || 0;
    if (filters.amountMin && amount < Number(filters.amountMin)) return false;
    if (filters.amountMax && amount > Number(filters.amountMax)) return false;

    // Si pasa todos los chequeos, lo incluimos
    return true;
  });

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
  const handleDescriptionClick = (registroId, currentDesc) => {
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
        const desc = result.value;
        handleFieldChange(registroId, "descripcion", desc);
        Swal.fire("Guardado", "Descripción guardada correctamente", "success");
      }
    });
  };

  // actualiza item → recalcula rate & amount
  const handleFacturaItemChange = (id, itemValue) => {
    const factura = facturas.find((f) => f.id === id) || {};
    const newRate = ITEM_RATES[itemValue] ?? 0;
    const newQty = Number(factura.qty) || 0;
    const newAmount = newRate * newQty;

    const updates = { item: itemValue, rate: newRate, amount: newAmount };
    update(ref(database, `facturasemitidas/${id}`), updates).catch(
      console.error
    );

    setFacturas(facturas.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // actualiza qty → recalcula amount
  const handleFacturaQtyChange = (id, qtyValue) => {
    const factura = facturas.find((f) => f.id === id) || {};
    const newQty = parseFloat(qtyValue) || 0;
    const newRate = Number(factura.rate) || 0;
    const newAmount = newRate * newQty;

    const updates = { qty: newQty, amount: newAmount };
    update(ref(database, `facturasemitidas/${id}`), updates).catch(
      console.error
    );

    setFacturas(facturas.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // actualiza rate → recalcula amount
  const handleFacturaRateChange = (id, rateValue) => {
    const factura = facturas.find((f) => f.id === id) || {};
    const newRate = parseFloat(rateValue) || 0;
    const newQty = Number(factura.qty) || 0;
    const newAmount = newRate * newQty;

    const updates = { rate: newRate, amount: newAmount };
    update(ref(database, `facturasemitidas/${id}`), updates).catch(
      console.error
    );

    setFacturas(facturas.map((f) => (f.id === id ? { ...f, ...updates } : f)));
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

    // 2) Pedir Bill To…
    const { value: billToResult } = await Swal.fire({
      title: "Bill To:",
      html: `
      <select id="bill-to-type" class="swal2-select" style="width:75%;">
        <option value="" disabled selected>Elija...</option>
        <option value="anombrede">A Nombre De</option>
        <option value="direccion">Dirección</option>
        <option value="personalizado">Personalizado</option>
      </select>
      <input id="bill-to-custom" class="swal2-input" placeholder="Texto personalizado" style="display:none; width:70%; margin:0.5em auto 0;" />`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const type = document.getElementById("bill-to-type").value;
        const custom = document.getElementById("bill-to-custom").value;
        if (!type) Swal.showValidationMessage("Seleccione un tipo");
        if (type === "personalizado" && !custom)
          Swal.showValidationMessage("Escriba el texto personalizado");
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
    if (!billToResult) return; // cancelado

    // 3) Extraer datos seleccionados
    const selectedData = facturas.filter((f) => selectedRows.includes(f.id));
    const base = selectedData[0];

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
    const contadorRef = ref(database, "contadorFactura");
    const tx = await runTransaction(contadorRef, (curr) => (curr || 0) + 1);
    const numeroFactura = tx.snapshot.val();
    // 6a) Formatear a 5 dígitos con ceros a la izquierda
    const invoiceNumber = numeroFactura.toString().padStart(4, "0");

    // 7) Generar PDF
    const pdf = new jsPDF("p", "mm", "a4");
    const mL = 10,
      mT = 10,
      logoSize = 28;
    const logo = await getBase64ImageFromUrl(logotipo);
    pdf.addImage(logo, "PNG", mL, mT, logoSize * 2.5, logoSize);

    // — Empresa —
    const textX = mL + logoSize * 2.5 + 5;
    pdf.setFontSize(16).text(invoiceConfig.companyName, textX, mT + 5);
    pdf
      .setFontSize(10)
      .text(`Address: ${invoiceConfig.address}`, textX, mT + 12)
      .text(
        `${invoiceConfig.city}, ${invoiceConfig.country}, ${invoiceConfig.postalCode}`,
        textX,
        mT + 16
      )
      .text(`Tel: ${invoiceConfig.phone}`, textX, mT + 16)
      .text(`Email: ${invoiceConfig.email}`, textX, mT + 17);

    // — Número y fecha —
    pdf
      .setFontSize(12)
      .text(`INVOICE NO: ${invoiceNumber}`, 160, mT + 35)
      .text(`DATE: ${new Date().toLocaleDateString()}`, 160, mT + 40);

    // — Bill To —
    const yBill = mT + logoSize + 10;
    pdf.setFontSize(12).text("BILL TO:", mL, yBill);
    const labelW = pdf.getTextWidth("BILL TO:");
    pdf.setFontSize(10).text(billToValue, mL + labelW + 5, yBill);

    // — Tabla de ítems —
    autoTable(pdf, {
      head: [["DATE", "ITEM", "Descripción", "QTY", "RATE", "AMOUNT"]],
      body: filas,
      startY: yBill + 8,
      theme: "grid",
      headStyles: { fillColor: [0, 164, 189], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      margin: { left: mL, right: 10 },
    });

    // — Total y balance —
    const afterY = pdf.lastAutoTable.finalY + 8;
    pdf
      .setFontSize(10)
      .text(`PAYMENT: AWG${totalAmount.toFixed(2)}`, 160, afterY);
    const balance = base.pago ? 0 : totalAmount;
    pdf.text(`BALANCE DUE: AWG${balance.toFixed(2)}`, 160, afterY + 6);

    // — Bank Info y footer —
    const bankY = afterY;
    pdf.text("Bank Info:", mL, bankY);
    pdf
      .setFontSize(9)
      .text(pdf.splitTextToSize(invoiceConfig.bankInfo, 80), mL, bankY + 6);
    const rawFooter = (invoiceConfig.footer || "").replace(/[\r\n]+/g, " ");
    const { width: w, height: h } = pdf.internal.pageSize;
    pdf
      .setFontSize(10)
      .text(rawFooter, (w - pdf.getTextWidth(rawFooter)) / 2, h - 10);

    // — Marca de agua PAID si aplica —
    if (base.pago) {
      // — dimensiones del PDF en “puntos” (72 dpi) —
      const wPt = pdf.internal.pageSize.getWidth();
      const hPt = pdf.internal.pageSize.getHeight();

      // — factor de escala para mayor nitidez —
      const SCALE = 3;

      // 1) Crear canvas “grande”
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(wPt * SCALE);
      canvas.height = Math.floor(hPt * SCALE);
      const ctx = canvas.getContext("2d");

      // 2) Escalar de px → pt
      ctx.scale(SCALE, SCALE);

      // 3) Mover origen al centro de la página
      ctx.translate(wPt / 2, hPt / 2);

      // 4) Girar la diagonal de TL→BR:
      //    ángulo = atan(alto/ancho)
      const angle = Math.atan2(hPt, wPt);
      ctx.rotate(Math.PI / 6);

      // 5) Dibujar el texto semi-transparente
      ctx.globalAlpha = 0.3;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "16px Arial"; // lo ajustas a tu gusto
      ctx.fillStyle = "green";
      ctx.fillText("PAID", 0, 0);

      // 6) Pasar el canvas al PDF
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, wPt, hPt);
    }

    // — Guardar —
    pdf.save(`Invoice-${invoiceNumber}.pdf`);
  };

  const addEmptyInvoice = () => {
    const invoiceRef = ref(database, "facturasemitidas");
    const newRef = push(invoiceRef);
    set(newRef, {
      timestamp: Date.now(),
      fecha: formatDate(Date.now()),
      numerodefactura: "",
      anombrede: "",
      direccion: "",
      servicio: "",
      cubicos: 0,
      valor: 0,
      pago: false,
      diasdemora: null,
      factura: true,
    }).catch(console.error);
  };

  useEffect(() => {
    if (loadedData && loadedRegistro && loadedClients && loadedFacturas) {
      setLoading(false);
    }
  }, [loadedData, loadedRegistro, loadedClients, loadedFacturas]);

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

        <label>Factura</label>
        <Select
          isClearable
          isMulti
          options={invoiceOptions}
          placeholder="Selecciona factura(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              numerodefactura: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.numerodefactura.map((v) => ({ value: v, label: v }))}
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

        <label>Servicio</label>
        <Select
          isClearable
          isMulti
          options={servicioOptions}
          placeholder="Selecciona servicio(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              servicio: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.servicio.map((v) => ({ value: v, label: v }))}
        />

        <label>Cúbicos</label>
        <Select
          isClearable
          isMulti
          options={cubicosOptions}
          placeholder="Selecciona cúbicos..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              cubicos: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.cubicos.map((v) => ({ value: v, label: v }))}
        />

        <label>Valor</label>
        <Select
          isClearable
          isMulti
          options={valorOptions}
          placeholder="Selecciona valor(es)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              valor: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.valor.map((v) => ({ value: v, label: v }))}
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
              servicio: [],
              cubicos: [],
              valor: [],
              diasdemora: [],
              factura: "true",
              pago: [],
              item: [],
              descripcion: "",
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

      {/* Tabla */}
      <div className="homepage-card">
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha Emisión</th>
                <th>Fecha Servicio</th>
                <th>Factura</th>
                <th>A Nombre De</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Servicio</th>
                <th>Cúbicos</th>
                <th>Valor</th>
                <th>Días de Mora</th>
                <th>Item</th>
                <th>Descripción</th>
                <th>qty</th>
                <th>rate</th>
                <th>amount</th>
                <th>Fecha de pago</th>
                <th>Pago</th>
                <th>Seleccionar</th>
              </tr>
            </thead>
            <tbody>
              {todos.length > 0 ? (
                todos.map((item) => {
                  // calcula mora si es necesario, formatea fecha, etc.
                  const emissionTs = item.timestamp;
                  const mora = item.pago
                    ? item.diasdemora
                    : formatDuration(currentTime - emissionTs);
                  return (
                    <tr key={`${item.origin}-${item.id}`}>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {formatDate(item.timestamp)}
                      </td>
                      <td style={{ textAlign: "center" }}>{item.fecha}</td>
                      <td style={{ textAlign: "center" }}>
                        {item.numerodefactura}
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{
                            width: `${Math.max(
                              item.anombrede?.length || 1,
                              20
                            )}ch`,
                          }}
                          value={item.anombrede || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.id,
                              "anombrede",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            type="text"
                            list={`dirs-${item.id}`}
                            style={{
                              width: "20ch",
                            }}
                            value={item.direccion || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                item.id,
                                "direccion",
                                e.target.value
                              )
                            }
                          />
                          <datalist id={`dirs-${item.id}`}>
                            {clients.map((c) => (
                              <option key={c.id} value={c.direccion} />
                            ))}
                          </datalist>
                        </div>
                      </td>
                      <td style={{ minWidth: "22ch" }}>
                        <select
                          value={item.servicio || ""}
                          style={{ width: "22ch" }}
                          onChange={(e) =>
                            handleFieldChange(
                              item.id,
                              "servicio",
                              e.target.value
                            )
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
                          style={{ width: "10ch", textAlign: "center" }}
                          value={item.cubicos || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.id,
                              "cubicos",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ width: "10ch", textAlign: "center" }}
                          value={item.valor || ""}
                          onChange={(e) =>
                            handleFieldChange(item.id, "valor", e.target.value)
                          }
                        />
                      </td>
                      <td style={{ textAlign: "center", width: "6ch" }}>
                        {mora}
                      </td>
                      <td>
                        <select
                          value={item.item || ""}
                          style={{ width: "28ch" }}
                          onChange={(e) =>
                            handleFacturaItemChange(item.id, e.target.value)
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
                      <td
                        style={{
                          alignItems: "center", // centra en Y
                          maxWidth: "26ch",
                        }}
                      >
                        <button
                          onClick={() =>
                            handleDescriptionClick(item.id, item.descripcion)
                          }
                          style={{
                            border: "none",
                            backgroundColor: "transparent",
                            borderRadius: "0.25em",
                            color: "black",
                            padding: "0.2em 0.5em",
                            cursor: "pointer",
                            fontSize: "1em",
                            maxWidth: "100%",
                            textAlign: "left",
                          }}
                        >
                          {item.descripcion ? (
                            <p
                              style={{
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                maxWidth: "20ch",
                              }}
                            >
                              {item.descripcion}
                            </p>
                          ) : (
                            // Mantiene el alto del td aunque esté vacío
                            "ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ"
                          )}
                        </button>
                      </td>

                      <td>
                        <input
                          type="number"
                          step="1"
                          style={{ width: "6ch", textAlign: "center" }}
                          value={item.qty || ""}
                          onChange={(e) =>
                            handleFacturaQtyChange(item.id, e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          style={{ width: "10ch", textAlign: "center" }}
                          value={
                            item.rate != null
                              ? (parseFloat(item.rate) || 0).toFixed(2)
                              : ""
                          }
                          onChange={(e) =>
                            handleFacturaRateChange(item.id, e.target.value)
                          }
                        />
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {item.amount != null
                          ? (parseFloat(item.amount) || 0).toFixed(2)
                          : "0.00"}
                      </td>
                      <td>
                        <input
                          type="date"
                          value={item.fechapago || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.id,
                              "fechapago",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          style={{
                            width: "3ch",
                            height: "3ch",
                            marginLeft: "10%",
                          }}
                          checked={item.pago === true}
                          onChange={(e) =>
                            confirmPagoChange(item.id, e.target.checked)
                          }
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(item.id)}
                          onChange={() => handleSelectRow(item.id)}
                          style={{
                            width: "3ch",
                            height: "3ch",
                            marginLeft: "0%",
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="17">No hay datos disponibles.</td>
                </tr>
              )}
            </tbody>
          </table>
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
      {/* Botones de acción */}
    </div>
  );
};

export default Facturasemitidas;
