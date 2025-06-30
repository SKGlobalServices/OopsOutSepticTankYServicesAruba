import React, { useState, useEffect, useRef, useMemo } from "react";
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
  const [loadedClients, setLoadedClients] = useState(false);
  const [loadedFacturas, setLoadedFacturas] = useState(false);

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
    personalizado: "",
  });

  // Cargar facturas
  useEffect(() => {
    const factRef = ref(database, "facturasemitidas");
    const unsubscribe = onValue(factRef, (snap) => {
      const data = [];
      snap.forEach((child) => {
        const rec = child.val();
        const { id: _, ...recWithoutId } = rec; // Excluye el ID
        data.push({
          origin: "facturasemitidas",
          id: child.key,
          pago: Boolean(rec.pago),
          factura: rec.factura ?? false,
          ...recWithoutId,
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

  // Cargar configuracion de factura
  useEffect(() => {
    const configRef = ref(database, "configuraciondefactura");
    return onValue(configRef, (snap) => {
      if (snap.exists()) {
        setInvoiceConfig(snap.val());
      }
    });
  }, []);

  // Formatea fecha y dias de mora
  const formatDate = (ts) => {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };
  const calculateDaysDelay = (timestamp, isPaid) => {
    if (isPaid) return 0; // Si está pagada, no hay mora
    const days = Math.floor((currentTime - timestamp) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  };

  /**
   * Maneja cambios de campo en Firebase y sincroniza estado local,
   * incluyendo recálculo de amount si cambian qty o rate.
   *
   * @param {string} id     ID del registro en facturasemitidas
   * @param {string} field  Nombre del campo a actualizar
   * @param {any}    value  Nuevo valor
   */
  function handleFieldChange(origen, id, field, value) {
    const dbRefItem = ref(database, `facturasemitidas/${id}`);
    update(dbRefItem, { [field]: value }).catch(console.error);
    setFacturas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
    const safeValue = value ?? "";

    // 2) Actualización inicial en Firebase
    update(dbRefItem, { [field]: safeValue }).catch(console.error);

    // 3) Lógica de recálculo para qty y rate
    const registro = facturas.find((f) => f.id === id) || {};

    // 3a) Si cambió qty → recalcular amount
    if (field === "qty") {
      const newQty = parseFloat(safeValue) || 0;
      const rate = parseFloat(registro.rate) || 0;
      const newAmount = parseFloat((newQty * rate).toFixed(2));

      // Persistir ambos en Firebase
      update(dbRefItem, { qty: newQty, amount: newAmount }).catch(
        console.error
      );

      // Actualizar estado local
      setFacturas((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, qty: newQty, amount: newAmount } : f
        )
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

      setFacturas((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, rate: newRate, amount: newAmount } : f
        )
      );
      return;
    }

    // 4) Actualizar cualquier otro campo
    setFacturas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: safeValue } : f))
    );
  }

  // 3️⃣ Combina y ordena
  // const merged = useMemo(() => {
  //   return facturas
  //     .sort((a, b) => b.timestamp - a.timestamp)
  //     .filter((f) => f.factura);
  // }, [facturas]);

  // const visibleTodos = useMemo(() => {
  //   return merged.filter((f) => {
  //     // aquí tu lógica de filtros, por ejemplo:
  //     if (
  //       filters.descripcion &&
  //       !f.descripcion
  //         ?.toLowerCase()
  //         .includes(filters.descripcion.toLowerCase())
  //     )
  //       return false;
  //     // … resto de checks …
  //     return true;
  //   });
  // }, [merged, filters]);

  // 1) La función que actualiza Firebase y el estado local
  const handlePagoToggle = (item, checked) => {
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

      // 1) Apunto a /facturasemitidas/${item.id}
      const itemRef = ref(database, `facturasemitidas/${item.id}`);
      // 2) Actualizo sólo la propiedad "pago"
      update(itemRef, { pago: checked })
        .then(() => {
          // 3) Reflejo el cambio en mi estado local
          setFacturas((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, pago: checked } : f))
          );
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
    if (!f.factura || f.factura === false || f.factura === "false")
      return false;

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

    // 6) Días de mora
    if (filters.diasdemora.length > 0) {
      const days = calculateDaysDelay(f.timestamp, f.pago);
      const ok = filters.diasdemora.some((sel) =>
        sel === "10+" ? days >= 10 : days === parseInt(sel, 10)
      );
      if (!ok) return false;
    }

    // 7) Pago
    if (filters.pago.length > 0) {
      const isPaid = Boolean(f.pago);
      if (!filters.pago.includes(isPaid)) return false;
    }

    // ── filtros extra ──

    // 8) Item
    if (filters.item.length > 0 && !filters.item.includes(f.item)) {
      return false;
    }

    // 9) Descripción (subcadena, case-insensitive)
    if (
      filters.descripcion &&
      !f.descripcion?.toLowerCase().includes(filters.descripcion.toLowerCase())
    ) {
      return false;
    }

    // 10) Personalizado (subcadena, case-insensitive)
    if (
      filters.personalizado &&
      !f.personalizado
        ?.toLowerCase()
        .includes(filters.personalizado.toLowerCase())
    ) {
      return false;
    }

    // 11) Qty mínimo/máximo
    const qty = Number(f.qty) || 0;
    if (filters.qtyMin && qty < Number(filters.qtyMin)) return false;
    if (filters.qtyMax && qty > Number(filters.qtyMax)) return false;

    // 12) Rate mínimo/máximo
    const rate = Number(f.rate) || 0;
    if (filters.rateMin && rate < Number(filters.rateMin)) return false;
    if (filters.rateMax && rate > Number(filters.rateMax)) return false;

    // 13) Amount mínimo/máximo
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
        handleFieldChange("facturasemitidas", registroId, "descripcion", desc);
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

        const base = facturas.find((f) => selectedRows.includes(f.id));
        if (
          (type === "anombrede" && !base.anombrede) ||
          (type === "direccion" && !base.direccion)
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

    // 3) Extraer datos seleccionados
    const selectedData = facturas.filter((f) => selectedRows.includes(f.id));
    const base = selectedData[0];
    const pagoStatus = base.pago === true ? "Pago" : "Debe";

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

    // 6a) Formatear YYMM + secuencia 4 dígitos
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
    // Generar el número de factura completo
    const contadorRef = ref(database, "contadorFactura");
    const tx = await runTransaction(contadorRef, (curr) => (curr || 0) + 1);
    const numeroFactura = tx.snapshot.val();

    // Formatear YYMM + secuencia 4 dígitos
    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const seq = String(numeroFactura).padStart(4, "0");
    const invoiceId = `${yy}${mm}${seq}`;

    const invoiceRef = ref(database, "facturasemitidas");
    const newRef = push(invoiceRef);
    set(newRef, {
      timestamp: Date.now(),
      fecha: formatDate(Date.now()),
      numerodefactura: invoiceId,
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
        <div className="homepage-card" style={{ padding: "10px" }}>
          <h1 className="title-page" style={{ marginBottom: "-18px" }}>
            Facturas Emitidas
          </h1>
          <div>{new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* Tabla */}
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
              </tr>
            </thead>
            <tbody>
              {/* {visibleTodos.length > 0 ? (
                visibleTodos.map((item, index) => { */}
              {filteredFacturas.length > 0 ? (
                filteredFacturas.map((item, index) => {
                  // calcula mora si es necesario, formatea fecha, etc.
                  const emissionTs = item.timestamp;
                  const diasMora = calculateDaysDelay(
                    item.timestamp,
                    item.pago
                  );
                  return (
                    <tr
                      key={`${item.origin}-${item.id}-${
                        item.fecha || ""
                      }-${index}`}
                    >
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
                            width: "16ch",
                          }}
                          value={item.anombrede || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.origin,
                              item.id,
                              "anombrede",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{ width: "20ch" }}
                          value={item.personalizado || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.origin,
                              item.id,
                              "personalizado",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            className="direccion-fixed-input "
                            style={{ width: "18ch" }}
                            type="text"
                            value={item.direccion || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                item.origin,
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
                      <td style={{ textAlign: "center", width: "6ch" }}>
                        {diasMora}
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
                            handleDescriptionClick(item.id, item.descripcion)
                          }
                        >
                          {item.descripcion ? (
                            <p
                              style={{
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {item.descripcion || ""}
                            </p>
                          ) : (
                            <span
                              style={{
                                width: "100%",
                                display: "inline-block",
                              }}
                            ></span>
                          )}
                        </button>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          style={{ width: "6ch", textAlign: "center" }}
                          value={item.qty || ""}
                          onChange={(e) =>
                            handleFacturaQtyChange(item.id, e.target.value)
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
                            item.rate != null
                              ? parseFloat(item.rate).toFixed(2)
                              : "0.00"
                          }
                          onFocus={(e) => {
                            const val = e.target.value;
                            const dot = val.indexOf(".");
                            if (dot > -1) {
                              e.target.setSelectionRange(0, dot);
                            } else {
                              e.target.select();
                            }
                          }}
                          onClick={(e) => {
                            const val = e.target.value;
                            const dot = val.indexOf(".");
                            const pos = e.target.selectionStart;
                            if (dot > -1 && pos > dot) {
                              e.target.setSelectionRange(dot + 1, val.length);
                            } else {
                              e.target.setSelectionRange(
                                0,
                                dot > -1 ? dot : val.length
                              );
                            }
                          }}
                          onChange={(e) => {
                            let v = e.target.value.replace(/[^0-9.]/g, "");
                            const parts = v.split(".");
                            if (parts.length > 2)
                              v = parts[0] + "." + parts.slice(1).join("");
                            handleFacturaRateChange(item.id, v);
                          }}
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
                              item.origin,
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
                          checked={item.pago}
                          onChange={(e) =>
                            handlePagoToggle(item, e.target.checked)
                          }
                          style={{
                            width: "3ch",
                            height: "3ch",
                            cursor: "pointer",
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
