import React, { useState, useEffect, useRef, useMemo } from "react";
import { database } from "../Database/firebaseConfig";
import {
  ref,
  set,
  push,
  update,
  remove,
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
import guardarfactura from "../assets/img/guardarfactura_icon.jpg";
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

const Hojadefechas = () => {
  // LOADER
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedRegistro, setLoadedRegistro] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);
  const [dataBranch, setDataBranch] = useState([]);
  const [dataRegistroFechas, setDataRegistroFechas] = useState([]);
  const [todos, setTodos] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // todos, incluyendo inactive
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [facturas, setFacturas] = useState({});
  const [loadedFacturas, setLoadedFacturas] = useState(false);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);
  const [showSelection, setShowSelection] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // === Casillas de seleccion ===
  const [showCobranzaSelection, setShowCobranzaSelection] = useState(false);
  const [cobranzaSelectedRows, setCobranzaSelectedRows] = useState({});
  const [selectedRows, setSelectedRows] = useState({});

  // Estado para el modal de vista/edición de factura
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [showFacturaModal, setShowFacturaModal] = useState(false);

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  // Estados para filtros de dirección
  const [addrChecklistOpen, setAddrChecklistOpen] = useState(false);
  const [addrSearch, setAddrSearch] = useState("");
  const [addrChecked, setAddrChecked] = useState({}); // { "Calle 1": true, ... }
  // Estado de filtros
  const [filters, setFilters] = useState({
    realizadopor: [],
    anombrede: [],
    direccion: [],
    servicio: [],
    cubicos: [],
    valor: [],
    pago: [],
    banco: [],
    formadepago: [],
    metododepago: [],
    efectivo: [],
    payment: [],
    numerodefactura: "",
    factura: "",
    fechaInicio: null,
    fechaFin: null,
    fechaPagoInicio: null,
    fechaPagoFin: null,
    sinFechaPago: false,
  });
  // Número de filas marcadas
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;

  // Estados locales para campos editables (onBlur)
  const [localValues, setLocalValues] = useState({});

  // Estados para fila activa donde el usuario está trabajando
  const [activeRow, setActiveRow] = useState(null);
  const [editingRow, setEditingRow] = useState(null);

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
        // 1) todos
        const all = Object.entries(snapshot.val()).map(([id, u]) => ({
          id,
          name: u.name,
          role: u.role,
        }));
        // 2) activos = ni admin, ni contador, ni usernotactive
        const active = all
          .filter(
            (u) =>
              u.role !== "admin" &&
              u.role !== "contador" &&
              u.role !== "usernotactive"
          )
          .map(({ id, name }) => ({ id, name }));
        active.sort((a, b) => a.name.localeCompare(b.name));

        setAllUsers(all);
        setUsers(active);
        setLoadedUsers(true);
      } else {
        setAllUsers([]);
        setUsers([]);
      }
    });
    // limpia el listener al desmontar
    return unsubscribe;
  }, []);

  // Cargar clientes
  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedClients = Object.entries(snapshot.val()).map(
          ([id, client]) => ({
            id,
            direccion: client.direccion,
            cubicos: client.cubicos,
            valor: client.valor,
            anombrede: client.anombrede,
          })
        );
        setClients(fetchedClients);
        setLoadedClients(true);
      } else {
        setClients([]);
      }
    });

    // limpia el listener al desmontar
    return unsubscribe;
  }, []);

  // Cargar facturas
  useEffect(() => {
    const dbRef = ref(database, "facturas");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        setFacturas(snapshot.val());
        setLoadedFacturas(true);
      } else {
        setFacturas({});
        setLoadedFacturas(true);
      }
    });

    return unsubscribe;
  }, []);

  // Cuando todas las fuentes de datos estén listas, oculta el loader
  useEffect(() => {
    if (
      loadedData &&
      loadedRegistro &&
      loadedUsers &&
      loadedClients &&
      loadedFacturas
    ) {
      setLoading(false);
    }
  }, [loadedData, loadedRegistro, loadedUsers, loadedClients, loadedFacturas]);

  // Opciones para filtros (se combinan ambos registros)
  const allRegistros = [
    ...dataBranch.map((record) => ({
      fecha: record.fecha,
      registros: [record],
    })),
    ...dataRegistroFechas,
  ];

  // Direcciones únicas (desde TODOS los registros disponibles)
  const allDireccionesUnicas = useMemo(() => {
    const setDir = new Set(
      allRegistros.flatMap((grp) =>
        (grp.registros || []).map((r) => r.direccion).filter(Boolean)
      )
    );
    return Array.from(setDir).sort((a, b) => a.localeCompare(b));
  }, [allRegistros]);

  // Filtrado por buscador del checklist
  const visibleDirecciones = useMemo(() => {
    const q = addrSearch.trim().toLowerCase();
    if (!q) return allDireccionesUnicas;
    return allDireccionesUnicas.filter((d) => d.toLowerCase().includes(q));
  }, [allDireccionesUnicas, addrSearch]);

  const realizadoporOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...users.map((u) => ({
      value: u.id,
      label: u.name,
    })),
  ];

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

  const servicioOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.servicio).filter(Boolean)
        )
      )
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const cubicosOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.cubicos).filter(Boolean)
        )
      )
    )
      .sort((a, b) => a - b)
      .map((v) => ({ value: v.toString(), label: v.toString() })),
  ];

  const valorOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.valor).filter(Boolean)
        )
      )
    )
      .sort((a, b) => a - b)
      .map((v) => ({ value: v.toString(), label: formatCurrency(v) })),
  ];

  const pagoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.pago).filter(Boolean)
        )
      )
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const formadePagoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.formadepago).filter(Boolean)
        )
      )
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const BancoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.banco).filter(Boolean)
        )
      )
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const metododepagoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.metododepago).filter(Boolean)
        )
      )
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const efectivoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.efectivo).filter(Boolean)
        )
      )
    )
      .sort((a, b) => a - b)
      .map((v) => ({ value: v.toString(), label: v.toString() })),
  ];

  const paymentOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(
        allRegistros.flatMap((item) =>
          item.registros.map((r) => r.payment).filter(Boolean)
        )
      )
    )
      .sort((a, b) => a - b)
      .map((v) => ({ value: v.toString(), label: formatCurrency(v) })),
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
  const filtrados = todos.filter((registro) => {
    // 1) Rango de fechas
    if (filters.fechaInicio && filters.fechaFin) {
      const [d, m, y] = registro.fecha.split("-");
      const f = new Date(y, m - 1, d);
      if (f < filters.fechaInicio || f > filters.fechaFin) return false;
    }

    // 2) Función de match para multicombos
    const match = (arr, field, toStr = false) =>
      !arr.length ||
      arr.some((opt) => {
        // Si el valor es "__EMPTY__", solo verifica si el campo está vacío
        if (opt.value === "__EMPTY__") {
          const fieldValue = registro[field];
          return (
            !fieldValue ||
            fieldValue === "" ||
            fieldValue === null ||
            fieldValue === undefined
          );
        }

        const val = toStr
          ? (registro[field] ?? "").toString()
          : (registro[field] ?? "").toString().toLowerCase();

        const optValue = toStr
          ? (opt.value ?? "").toString()
          : (opt.value ?? "").toString().toLowerCase();

        return val === optValue;
      });

    if (!match(filters.realizadopor, "realizadopor")) return false;
    if (!match(filters.anombrede, "anombrede")) return false;
    if (!match(filters.direccion, "direccion")) return false;
    if (!match(filters.servicio, "servicio")) return false;
    if (!match(filters.cubicos, "cubicos", true)) return false;
    if (!match(filters.valor, "valor", true)) return false;
    if (!match(filters.pago, "pago")) return false;
    if (!match(filters.formadepago, "formadepago")) return false;
    if (!match(filters.banco, "banco")) return false;
    if (!match(filters.metododepago, "metododepago")) return false;
    if (!match(filters.efectivo, "efectivo", true)) return false;
    if (!match(filters.payment, "payment", true)) return false;

    // Filtro por número de factura (subcadena)
    if (
      filters.numerodefactura &&
      !(registro.numerodefactura || "")
        .toLowerCase()
        .includes(filters.numerodefactura.toLowerCase())
    )
      return false;

    // 2) Factura sí/no
    if (
      filters.factura !== "" &&
      Boolean(registro.factura) !== (filters.factura === "true")
    )
      return false;

    // 3) DESCRIPCIÓN (subcadena, case-insensitive)
    if (
      filters.descripcion &&
      !registro.descripcion
        ?.toLowerCase()
        .includes(filters.descripcion.toLowerCase())
    )
      return false;

    if (filters.sinFechaPago) {
      // tomar la fecha de pago de la factura o del registro
      const fechaPagoStr = registro.numerodefactura
        ? facturas[registro.numerodefactura]?.fechapago
        : registro.fechapago;
      if (fechaPagoStr) return false; // descartar si *tiene* fecha
    }
    // 5) Si no pide “sin fecha”, aplicar rango normal
    else if (filters.fechaPagoInicio && filters.fechaPagoFin) {
      const fechaPagoStr = registro.numerodefactura
        ? facturas[registro.numerodefactura]?.fechapago
        : registro.fechapago;
      if (!fechaPagoStr) return false;
      const [y, m, d] = fechaPagoStr.split("-");
      const fechaPago = new Date(y, m - 1, d);
      if (
        fechaPago < filters.fechaPagoInicio ||
        fechaPago > filters.fechaPagoFin
      )
        return false;
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

  // Función para obtener payment de la factura
  const getPaymentFactura = (registro) => {
    // Si el registro no tiene factura asociada, usar el payment individual
    if (!registro.numerodefactura && !registro.referenciaFactura) {
      return registro.payment || 0;
    }

    // Buscar la factura correspondiente
    const numeroFactura =
      registro.numerodefactura || registro.referenciaFactura;
    const factura = facturas[numeroFactura];

    if (factura && factura.payment !== undefined) {
      return factura.payment;
    }

    // Si no se encuentra la factura, usar el payment individual como fallback
    return registro.payment || 0;
  };

  // Funciones de navegación
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setSelectedRows({}); // Limpiar selección al cambiar página
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
    setSelectedRows({}); // Limpiar selección
  };

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows({});
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

  // Helpers para selección y fecha
  const handleCobranzaRowSelection = (_fecha, registroId, checked) => {
    // ignoramos fecha, guardamos por id
    const key = registroId;
    setCobranzaSelectedRows((prev) => ({ ...prev, [key]: checked }));
  };

  const getTodayDDMMYYYY = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Acción principal del botón “Cobranza”
  const GestionarCobranza = async () => {
    if (!showCobranzaSelection) {
      setShowCobranzaSelection(true);
      return;
    }

    const haySeleccion = Object.values(cobranzaSelectedRows).some(Boolean);
    if (!haySeleccion) {
      setShowCobranzaSelection(false);
      setCobranzaSelectedRows({});
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title: "Enviar a Informe de Cobranza",
      html: `
      <p style="margin:0 0 8px;">Se copiarán los registros seleccionados a <b>Informe De Cobranza</b>.</p>
      <p style="margin:0;">Los datos <b>NO</b> se eliminarán de Agenda Dinámica.</p>
      <p style="margin:8px 0 0;color:#d35400;font-size:0.9em;">
        Nota: si ya existía una copia para un id, será <b>actualizada</b>.
      </p>
    `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, enviar",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;

    Swal.fire({
      title: "Enviando...",
      text: "Se están enviando los datos a informe de cobranza",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // aplanar todo como ya lo haces
      const flatAll = filteredData.flatMap((group) =>
        group.registros.map((r) => ({ ...r, fecha: group.fecha }))
      );

      // filtrar por ids seleccionados
      const seleccionados = flatAll.filter((r) => !!cobranzaSelectedRows[r.id]);

      if (seleccionados.length === 0) {
        Swal.close();
        await Swal.fire({
          icon: "info",
          title: "Sin registros",
          text: "No hay registros seleccionados para cobranza.",
        });
        return;
      }

      // escribir 1 a 1 en cobranzapendientes/{id}
      const writes = seleccionados.map((reg) => {
        const copy = {
          direccion: reg.direccion || "",
          valor: reg.valor ?? "",
          notas: reg.notas || "",
        };

        // path por ID (sin fecha)
        const itemRef = ref(database, `cobranzapendientes/${reg.id}`);
        return set(itemRef, copy); // sobrescribe/crea
      });

      await Promise.all(writes);

      Swal.close();
      await Swal.fire({
        icon: "success",
        title: "Copiados a Informe de Cobranza",
        text: `Se copiaron ${seleccionados.length} registro(s) por id en 'Informe De Cobranza'.`,
        timer: 2200,
      });

      setShowCobranzaSelection(false);
      setCobranzaSelectedRows({});
    } catch (err) {
      console.error("Error copiando a cobranzapendientes:", err);
      Swal.close();
      await Swal.fire({
        icon: "error",
        title: "Error al enviar",
        text: "No se pudo copiar a Informe de Cobranza. Intenta de nuevo.",
      });
    }
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

  // Función para cargar campos desde clientes (cubicos, valor, anombrede)
  const loadClientFields = (direccion, registroId, fromData, fecha) => {
    const cli = clients.find((c) => c.direccion === direccion);
    const path = fromData
      ? `data/${registroId}`
      : `registrofechas/${fecha}/${registroId}`;
    const dbRefItem = ref(database, path);

    if (cli) {
      // si existe el cliente, actualiza cubicos, valor y anombrede
      const updateData = {
        cubicos: cli.cubicos ?? 0,
        valor: cli.valor ?? 0,
        anombrede: cli.anombrede ?? "",
      };

      update(dbRefItem, updateData).catch(console.error);

      // Actualizar estado local
      const updater = (r) =>
        r.id === registroId ? { ...r, ...updateData } : r;

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
    } else {
      // si no existe, limpia los campos
      const updateData = { cubicos: "", valor: "", anombrede: "" };

      update(dbRefItem, updateData).catch(console.error);

      // Actualizar estado local
      const updater = (r) =>
        r.id === registroId ? { ...r, ...updateData } : r;

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
    }
  };

  // Función para actualizar campos (gestiona tanto los registros de "data" como de "registrofechas")
  function handleFieldChange(fecha, registroId, field, value, origin) {
    const safeValue = value ?? "";
    const fromData = origin === "data";
    const path = fromData
      ? `data/${registroId}`
      : `registrofechas/${fecha}/${registroId}`;
    const dbRefItem = ref(database, path);

    // Eliminar la edición de fecha: si el campo es 'fecha', no hacer nada
    if (field === "fecha") {
      return;
    }

    update(dbRefItem, { [field]: safeValue }).catch(console.error);

    // 2) Obtener el registro local (para recálculos)
    const registro = fromData
      ? dataBranch.find((r) => r.id === registroId) || {}
      : dataRegistroFechas
          .find((g) => g.fecha === fecha)
          ?.registros.find((r) => r.id === registroId) || {};

    // 3) Si cambió qty → recalcular amount = rate * qty
    if (field === "qty") {
      const newQty = parseFloat(safeValue) || 0;
      const rate = parseFloat(registro.rate) || 0;
      const newAmount = newQty * rate;

      update(dbRefItem, {
        qty: newQty,
        amount: parseFloat(newAmount.toFixed(2)),
      }).catch(console.error);

      const updater = (r) =>
        r.id === registroId ? { ...r, qty: newQty, amount: newAmount } : r;

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
      return;
    }

    // 4) Si cambió rate → recalcular amount = rate * qty
    if (field === "rate") {
      const newRate = parseFloat(safeValue) || 0;
      const qty = parseFloat(registro.qty) || 0;
      const newAmount = newRate * qty;

      update(dbRefItem, {
        rate: parseFloat(newRate.toFixed(2)),
        amount: parseFloat(newAmount.toFixed(2)),
      }).catch(console.error);

      const updater = (r) =>
        r.id === registroId ? { ...r, rate: newRate, amount: newAmount } : r;

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
      return;
    }

    // 5) Campos especiales: "realizadopor", "servicio" y "direccion"
    if (
      field === "realizadopor" ||
      field === "servicio" ||
      field === "direccion"
    ) {
      // actualiza en Firebase
      update(dbRefItem, { [field]: safeValue }).catch(console.error);

      // local update
      const updater = (r) =>
        r.id === registroId ? { ...r, [field]: safeValue } : r;

      if (fromData) {
        setDataBranch((prev) => prev.map(updater));
        // sincronizar clientes si cambió servicio
        if (field === "servicio") {
          const current = dataBranch.find((r) => r.id === registroId);
          if (current) {
            syncWithClients(current.direccion, current.cubicos);
            loadClientFields(current.direccion, registroId, true, fecha);
          }
        }
        // cargar campos de clientes si cambió dirección
        if (field === "direccion") {
          loadClientFields(safeValue, registroId, true, fecha);
        }
      } else {
        setDataRegistroFechas((prev) =>
          prev.map((g) =>
            g.fecha === fecha
              ? { ...g, registros: g.registros.map(updater) }
              : g
          )
        );
        if (field === "servicio") {
          const current = dataRegistroFechas
            .find((g) => g.fecha === fecha)
            ?.registros.find((r) => r.id === registroId);
          if (current) {
            syncWithClients(current.direccion, current.cubicos);
            loadClientFields(current.direccion, registroId, false, fecha);
          }
        }
        // cargar campos de clientes si cambió dirección
        if (field === "direccion") {
          loadClientFields(safeValue, registroId, false, fecha);
        }
      }
      return;
    }

    // 5.1) Campo especial: "pago" - manejar fecha de pago automáticamente
    if (field === "pago") {
      // Obtener el registro para verificar si tiene factura asociada
      const registro = fromData
        ? dataBranch.find((r) => r.id === registroId) || {}
        : dataRegistroFechas
            .find((g) => g.fecha === fecha)
            ?.registros.find((r) => r.id === registroId) || {};

      // Si tiene factura asociada, actualizar la factura
      if (registro.numerodefactura) {
        const handleFacturaPago = async () => {
          try {
            const facturaRef = ref(
              database,
              `facturas/${registro.numerodefactura}`
            );

            if (safeValue === "Pago") {
              // Marcar como pagada: payment = totalAmount, deuda = 0
              const facturaSnapshot = await new Promise((resolve) => {
                onValue(facturaRef, resolve, { onlyOnce: true });
              });

              if (facturaSnapshot.exists()) {
                const facturaData = facturaSnapshot.val();
                const fechaPagoFinal = new Date().toISOString().split("T")[0];

                await update(facturaRef, {
                  payment: facturaData.totalAmount,
                  deuda: 0,
                  pago: "Pago",
                  fechapago: fechaPagoFinal,
                });

                // Actualizar todos los servicios asociados a esta factura
                const [dataSnapshot, registroFechasSnapshot] =
                  await Promise.all([
                    new Promise((resolve) =>
                      onValue(ref(database, "data"), resolve, {
                        onlyOnce: true,
                      })
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
                  Object.entries(dataVal).forEach(([serviceId, reg]) => {
                    if (
                      reg.referenciaFactura === registro.numerodefactura ||
                      reg.numerodefactura === registro.numerodefactura
                    ) {
                      serviciosAsociados.push({
                        id: serviceId,
                        origin: "data",
                      });
                    }
                  });
                }

                // Buscar en registrofechas
                if (registroFechasSnapshot.exists()) {
                  const registroVal = registroFechasSnapshot.val();
                  Object.entries(registroVal).forEach(
                    ([fechaReg, registros]) => {
                      Object.entries(registros).forEach(([serviceId, reg]) => {
                        if (
                          reg.referenciaFactura === registro.numerodefactura ||
                          reg.numerodefactura === registro.numerodefactura
                        ) {
                          serviciosAsociados.push({
                            id: serviceId,
                            fecha: fechaReg,
                            origin: "registrofechas",
                          });
                        }
                      });
                    }
                  );
                }

                // Actualizar todos los servicios
                const updatePromises = serviciosAsociados.map((servicio) => {
                  const path =
                    servicio.origin === "data"
                      ? `data/${servicio.id}`
                      : `registrofechas/${servicio.fecha}/${servicio.id}`;

                  return update(ref(database, path), {
                    pago: "Pago",
                    fechapago: fechaPagoFinal,
                  });
                });

                await Promise.all(updatePromises);
                console.log(
                  `✅ Factura ${registro.numerodefactura} marcada como PAGADA`
                );
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
                  fechapago: null,
                });

                // Actualizar todos los servicios asociados
                const [dataSnapshot, registroFechasSnapshot] =
                  await Promise.all([
                    new Promise((resolve) =>
                      onValue(ref(database, "data"), resolve, {
                        onlyOnce: true,
                      })
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
                  Object.entries(dataVal).forEach(([serviceId, reg]) => {
                    if (
                      reg.referenciaFactura === registro.numerodefactura ||
                      reg.numerodefactura === registro.numerodefactura
                    ) {
                      serviciosAsociados.push({
                        id: serviceId,
                        origin: "data",
                      });
                    }
                  });
                }

                // Buscar en registrofechas
                if (registroFechasSnapshot.exists()) {
                  const registroVal = registroFechasSnapshot.val();
                  Object.entries(registroVal).forEach(
                    ([fechaReg, registros]) => {
                      Object.entries(registros).forEach(([serviceId, reg]) => {
                        if (
                          reg.referenciaFactura === registro.numerodefactura ||
                          reg.numerodefactura === registro.numerodefactura
                        ) {
                          serviciosAsociados.push({
                            id: serviceId,
                            fecha: fechaReg,
                            origin: "registrofechas",
                          });
                        }
                      });
                    }
                  );
                }

                // Actualizar todos los servicios
                const updatePromises = serviciosAsociados.map((servicio) => {
                  const path =
                    servicio.origin === "data"
                      ? `data/${servicio.id}`
                      : `registrofechas/${servicio.fecha}/${servicio.id}`;

                  return update(ref(database, path), {
                    pago: safeValue,
                    fechapago: null,
                  });
                });

                await Promise.all(updatePromises);
                console.log(
                  `✅ Factura ${registro.numerodefactura} marcada como DEBE`
                );
              }
            }
          } catch (error) {
            console.error("Error actualizando pago de factura:", error);
          }
        };

        handleFacturaPago();
        return;
      }

      // Si no tiene factura, actualizar solo el servicio individual
      let updates = { [field]: safeValue };

      if (safeValue === "Pago") {
        const today = new Date();
        const fechaPago = today.toISOString().split("T")[0]; // formato YYYY-MM-DD
        updates.fechapago = fechaPago;
      } else {
        // Si se desmarca o cambia a otro estado, limpiar fecha de pago
        if (safeValue !== "Pago") {
          updates.fechapago = "";
        }
      }

      // Actualizar en Firebase
      update(dbRefItem, updates).catch(console.error);

      // Actualizar estado local
      const updater = (r) => (r.id === registroId ? { ...r, ...updates } : r);

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
      return;
    }

    // 6) Campo especial: fechapago_factura - actualizar fecha de pago en la factura
    if (field === "fechapago_factura") {
      const registro = fromData
        ? dataBranch.find((r) => r.id === registroId) || {}
        : dataRegistroFechas
            .find((g) => g.fecha === fecha)
            ?.registros.find((r) => r.id === registroId) || {};

      if (registro.numerodefactura) {
        // Actualizar la fecha de pago en la factura
        const facturaRef = ref(
          database,
          `facturas/${registro.numerodefactura}`
        );
        update(facturaRef, { fechapago: safeValue }).catch(console.error);

        // Actualizar todos los servicios asociados a esta factura
        const actualizarServiciosAsociados = async () => {
          try {
            // Buscar todos los servicios asociados a esta factura
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
              Object.entries(dataVal).forEach(([id, reg]) => {
                if (
                  reg.referenciaFactura === registro.numerodefactura ||
                  reg.numerodefactura === registro.numerodefactura
                ) {
                  serviciosAsociados.push({ id, origin: "data" });
                }
              });
            }

            // Buscar en registrofechas
            if (registroFechasSnapshot.exists()) {
              const registroVal = registroFechasSnapshot.val();
              Object.entries(registroVal).forEach(([fechaReg, registros]) => {
                Object.entries(registros).forEach(([id, reg]) => {
                  if (
                    reg.referenciaFactura === registro.numerodefactura ||
                    reg.numerodefactura === registro.numerodefactura
                  ) {
                    serviciosAsociados.push({
                      id,
                      fecha: fechaReg,
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

              return update(ref(database, path), { fechapago: safeValue });
            });

            await Promise.all(updatePromises);
            console.log(
              `✅ Fecha de pago actualizada en factura y ${serviciosAsociados.length} servicios`
            );
          } catch (error) {
            console.error("Error actualizando servicios asociados:", error);
          }
        };

        actualizarServiciosAsociados();
      }
      return;
    }

    // 7) Campo especial: "banco" - sincronizar con factura asociada
    if (field === "banco") {
      // Obtener el registro para verificar si tiene factura asociada
      const registro = fromData
        ? dataBranch.find((r) => r.id === registroId) || {}
        : dataRegistroFechas
            .find((g) => g.fecha === fecha)
            ?.registros.find((r) => r.id === registroId) || {};

      // Si tiene factura asociada, actualizar la factura también
      if (registro.numerodefactura) {
        const handleFacturaBanco = async () => {
          try {
            // Actualizar el banco en la factura
            const facturaRef = ref(
              database,
              `facturas/${registro.numerodefactura}`
            );
            await update(facturaRef, { banco: safeValue });

            // Actualizar todos los servicios asociados a esta factura
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
              Object.entries(dataVal).forEach(([id, reg]) => {
                if (
                  reg.referenciaFactura === registro.numerodefactura ||
                  reg.numerodefactura === registro.numerodefactura
                ) {
                  serviciosAsociados.push({ id, origin: "data" });
                }
              });
            }

            // Buscar en registrofechas
            if (registroFechasSnapshot.exists()) {
              const registroVal = registroFechasSnapshot.val();
              Object.entries(registroVal).forEach(([fechaReg, registros]) => {
                Object.entries(registros).forEach(([id, reg]) => {
                  if (
                    reg.referenciaFactura === registro.numerodefactura ||
                    reg.numerodefactura === registro.numerodefactura
                  ) {
                    serviciosAsociados.push({
                      id,
                      fecha: fechaReg,
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

              return update(ref(database, path), { banco: safeValue });
            });

            await Promise.all(updatePromises);
            console.log(
              `✅ Banco "${safeValue}" actualizado en factura y ${serviciosAsociados.length} servicios`
            );
          } catch (error) {
            console.error("Error actualizando banco de factura:", error);
          }
        };

        handleFacturaBanco();
      } else {
        // Si no tiene factura, actualizar solo el servicio individual
        update(dbRefItem, { [field]: safeValue }).catch(console.error);
      }

      // Actualizar estado local
      const updater = (r) =>
        r.id === registroId ? { ...r, [field]: safeValue } : r;

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
      return;
    }

    // 8) Cualquier otro campo → sólo actualizamos ese campo
    update(dbRefItem, { [field]: safeValue }).catch(console.error);
    const updater = (r) =>
      r.id === registroId ? { ...r, [field]: safeValue } : r;

    if (fromData) {
      setDataBranch((prev) => prev.map(updater));
    } else {
      setDataRegistroFechas((prev) =>
        prev.map((g) =>
          g.fecha === fecha ? { ...g, registros: g.registros.map(updater) } : g
        )
      );
    }
  }

  // Mostrar/ocultar slidebars
  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);
  const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);
  const toggleAddrCheck = (direccion) => {
    setAddrChecked((prev) => ({ ...prev, [direccion]: !prev[direccion] }));
  };

  const selectAllVisibleDirecciones = () => {
    setAddrChecked((prev) => {
      const next = { ...prev };
      visibleDirecciones.forEach((d) => {
        next[d] = true;
      });
      return next;
    });
  };

  const clearAllVisibleDirecciones = () => {
    setAddrChecked((prev) => {
      const next = { ...prev };
      visibleDirecciones.forEach((d) => {
        next[d] = false;
      });
      return next;
    });
  };

  // Aplica el checklist → llena filters.direccion con las direcciones tildadas
  const applyDireccionChecklist = () => {
    const seleccionadas = Object.entries(addrChecked)
      .filter(([, v]) => v)
      .map(([d]) => ({ value: d, label: d }));

    setFilters((prev) => ({
      ...prev,
      direccion: seleccionadas, // usa el mismo formato que tu <Select isMulti />
    }));

    // opcional: cerrar panel tras aplicar
    setAddrChecklistOpen(false);

    // opcional: limpiar búsqueda
    setAddrSearch("");
  };

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
    const found = allUsers.find((u) => u.id === userId);
    return found ? found.name : "";
  };

  // Funciones para manejar la fila activa donde el usuario está trabajando
  const handleRowEdit = (rowId) => {
    setActiveRow(rowId);
  };

  const handleRowEditEnd = () => {
    setActiveRow(null);
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

      const fechaPagoFinal =
        facturaData.fechapago || new Date().toISOString().split("T")[0];
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
            fechapago: fechaPagoFinal,
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

  // Función para manejar cambios en campos específicos
  const getSelectWidth = () => {
    const maxLength = Math.max(...users.map((u) => u.name.length));
    const baseWidth = maxLength * 8 + 20;
    return Math.max(baseWidth, 100);
  };

  // EXPORTAR XLSX
  const generateXLSX = async () => {
    const exportData = filteredData.flatMap((item) =>
      item.registros.map((registro) => ({
        Fecha: item.fecha,
        "Realizado Por": getUserName(registro.realizadopor) || "",
        "A Nombre De": registro.anombrede || "",
        Dirección: registro.direccion || "",
        Servicio: registro.servicio || "",
        Cúbicos: registro.cubicos || "",
        Valor: registro.valor || "",
        Pago: registro.pago || "",
        "Fecha de Pago": registro.numerodefactura
          ? facturas[registro.numerodefactura]?.fechapago || ""
          : registro.fechapago || "",
        "Forma De Pago": registro.formadepago || "",
        Banco: registro.banco || "",
        Notas: registro.notas || "",
        "Método De Pago": registro.metododepago || "",
        Efectivo: registro.efectivo || "",
        Factura: registro.factura ? "Sí" : "No",
        "N° Factura": registro.numerodefactura || "",
        Payment: formatCurrency(getPaymentFactura(registro)),
        "Días de Mora": calculateDaysDelay
          ? calculateDaysDelay(registro.timestamp, registro.pago)
          : "",
      }))
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Servicios");

    const headers = [
      "Fecha",
      "Realizado Por",
      "A Nombre De",
      "Dirección",
      "Servicio",
      "Cúbicos",
      "Valor",
      "Pago",
      "Fecha de Pago",
      "Forma De Pago",
      "Banco",
      "Notas",
      "Método De Pago",
      "Efectivo",
      "Factura",
      "N° Factura",
      "Payment",
      "Días de Mora",
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

    // ajustar anchos
    worksheet.columns = [
      { width: 12 }, // Fecha
      { width: 20 }, // Realizado Por
      { width: 20 }, // A Nombre De
      { width: 30 }, // Dirección
      { width: 18 }, // Servicio
      { width: 12 }, // Cúbicos
      { width: 12 }, // Valor
      { width: 16 }, // Pago
      { width: 16 }, // Fecha de Pago
      { width: 18 }, // Forma De Pago
      { width: 25 }, // Banco
      { width: 20 }, // Notas
      { width: 18 }, // Método De Pago
      { width: 12 }, // Efectivo
      { width: 10 }, // Factura
      { width: 16 }, // N° Factura
      { width: 15 }, // Payment
      { width: 15 }, // Días de Mora
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
    a.download = "Agenda_Dinamica.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Manejo del DatePicker para rango de fechas
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPagoDatePicker, setShowPagoDatePicker] = useState(false);
  const handleDateRangeChange = (dates) => {
    const [start, end] = dates;
    setFilters((prev) => ({
      ...prev,
      fechaInicio: start
        ? new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            0,
            0,
            0
          )
        : null,
      fechaFin: end
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)
        : null,
    }));
  };

  // Manejo del DatePicker para fecha de pago
  const handlePagoDateRangeChange = (dates) => {
    const [start, end] = dates;
    setFilters((prev) => ({
      ...prev,
      fechaPagoInicio: start
        ? new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            0,
            0,
            0
          )
        : null,
      fechaPagoFin: end
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)
        : null,
    }));
  };

  // Función para editar descripción con Swal
  const handleDescriptionClick = (fecha, registroId, currentDesc) => {
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
        handleFieldChange(fecha, registroId, "descripcion", desc);
        Swal.fire("Guardado", "Descripción guardada correctamente", "success");
      }
    });
  };

  const handleNotesClick = (fecha, registroId, currentNotes, origin) => {
    Swal.fire({
      title: "Notas",
      input: "textarea",
      inputLabel: "Notas",
      inputValue: currentNotes || "",
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        handleFieldChange(fecha, registroId, "notas", result.value, origin);
      }
    });
  };

  // Mapeo estático de items a sus rates
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

  const handleItemSelect = (fecha, registroId, itemValue) => {
    const fromData = dataBranch.some((r) => r.id === registroId);
    const path = fromData
      ? `data/${registroId}`
      : `registrofechas/${fecha}/${registroId}`;
    const dbRef = ref(database, path);

    // Registro local
    const registro = fromData
      ? dataBranch.find((r) => r.id === registroId) || {}
      : dataRegistroFechas
          .find((g) => g.fecha === fecha)
          ?.registros.find((r) => r.id === registroId) || {};

    const newRate = ITEM_RATES[itemValue] ?? 0;
    const newQty = Number(registro.qty) || 0;
    const newAmount = newRate * newQty;

    // Grabar en Firebase
    update(dbRef, {
      item: itemValue,
      rate: parseFloat(newRate.toFixed(2)),
      amount: parseFloat(newAmount.toFixed(2)),
    }).catch(console.error);

    // Reflejar en estado local
    const updater = (r) =>
      r.id === registroId
        ? { ...r, item: itemValue, rate: newRate, amount: newAmount }
        : r;

    if (fromData) {
      setDataBranch((prev) => prev.map(updater));
    } else {
      setDataRegistroFechas((prev) =>
        prev.map((g) =>
          g.fecha === fecha ? { ...g, registros: g.registros.map(updater) } : g
        )
      );
    }
  };

  const handleRateChange = (fecha, registroId, rateValue) => {
    const fromData = dataBranch.some((r) => r.id === registroId);
    const path = fromData
      ? `data/${registroId}`
      : `registrofechas/${fecha}/${registroId}`;
    const dbRef = ref(database, path);

    // Registro actual en local
    const registro = fromData
      ? dataBranch.find((r) => r.id === registroId) || {}
      : dataRegistroFechas
          .find((g) => g.fecha === fecha)
          ?.registros.find((r) => r.id === registroId) || {};

    const newRate = parseFloat(rateValue) || 0;
    const newQty = Number(registro.qty) || 0;
    const newAmount = newRate * newQty;

    // Grabar sólo rate y amount en Firebase
    update(dbRef, {
      rate: parseFloat(newRate.toFixed(2)),
      amount: parseFloat(newAmount.toFixed(2)),
    }).catch(console.error);

    // Reflejar en estado local
    const updater = (r) =>
      r.id === registroId ? { ...r, rate: newRate, amount: newAmount } : r;

    if (fromData) {
      setDataBranch((prev) => prev.map(updater));
    } else {
      setDataRegistroFechas((prev) =>
        prev.map((g) =>
          g.fecha === fecha ? { ...g, registros: g.registros.map(updater) } : g
        )
      );
    }
  };

  // ① Estado para la configuración de la factura
  const [invoiceConfig, setInvoiceConfig] = useState({
    companyName: "",
    address: "",
    country: "",
    city: "",
    postalCode: "",
    phone: "",
    email: "",
    bankInfo: "",
    footer: "",
  });

  // ② Carga desde Firebase ("configuraciondefactura")
  useEffect(() => {
    const configRef = ref(database, "configuraciondefactura");
    return onValue(configRef, (snap) => {
      if (snap.exists()) setInvoiceConfig(snap.val());
    });
  }, []);

  // Convertir logo a Base64
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

  // Función auxiliar: genera y guarda el PDF usando los datos que ya se ingresaron.
  const generarPDFconDatos = async ({
    filas,
    totalAmount,
    billToValue,
    numeroFactura,
    pagoStatus,
    pagoDate,
    fechaEmision, // ✅ Agregar parámetro fechaEmision
    fechaServicio,
    direccion,
    servicio,
    cubicos,
    facturaInfo,
  }) => {
    // ✅ Usar siempre los datos del primer registro para el PDF (no se guardan en factura)
    console.log(`Generando PDF con datos dinámicos del primer registro:
      - Fecha base: ${fechaServicio}
      - Dirección: ${direccion}
      - Servicio: ${servicio}
      - Cúbicos: ${cubicos}
      - Bill To: ${billToValue}
      - Nota: La fecha de cada item se obtiene del campo fechaServicioItem del item`);

    const pdf = new jsPDF("p", "mm", "a4");
    const mL = 10; // margen izquierdo
    const mT = 15; // margen superior
    // Obtener logo en base64
    const logo = await getBase64ImageFromUrl(logotipo);
    // Crear imagen temporal para obtener dimensiones reales
    const img = new Image();
    img.src = logo;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    // Definir altura deseada
    const logoHeight = 18;
    // Calcular ancho proporcional para mantener proporciones originales
    const logoWidth = (img.width / img.height) * logoHeight;
    // Insertar logo sin deformación
    const logoY = mT - 1; // en lugar de solo +5
    pdf.addImage(logo, "PNG", mL, logoY, logoWidth, logoHeight);
    // Número de factura formateado
    // Usar el número de factura que viene como parámetro (ya está formateado)
    const invoiceId = numeroFactura; // El número ya viene formateado como "25060001"
    const today = new Date();

    // ... continúa con la lógica para añadir datos al PDF como filas, totales, etc.
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

    // — Cabecera con número y fecha —
    console.log("Fecha de emisión para PDF:", fechaEmision); // Debug

    // Formatear fecha de emisión para el PDF
    let fechaEmisionFormateada = today.toLocaleDateString();
    if (fechaEmision) {
      // Si viene en formato YYYY-MM-DD, convertir a DD/MM/YYYY
      if (fechaEmision.includes("-")) {
        const [year, month, day] = fechaEmision.split("-");
        fechaEmisionFormateada = `${day}/${month}/${year}`;
      } else {
        // Si ya está en formato DD/MM/YYYY, usar directamente
        fechaEmisionFormateada = fechaEmision;
      }
    }

    pdf
      .setFontSize(12)
      .text(`INVOICE NO: ${invoiceId}`, 152, mT + 35)
      .text(`DATE: ${fechaEmisionFormateada}`, 152, mT + 40);

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

    // — Total —
    const afterY = pdf.lastAutoTable.finalY;

    // Obtener datos de la factura para mostrar información completa
    const hasPayment = facturaInfo && facturaInfo.payment > 0;

    pdf.setFontSize(10);

    // Mostrar información financiera
    if (hasPayment) {
      pdf.text(
        `PAYMENT: AWG ${formatCurrency(facturaInfo.payment)}`,
        152,
        afterY + 6
      );

      const balance = pagoStatus === "Pago" ? 0 : facturaInfo.deuda || 0;
      pdf.text(`BALANCE DUE: AWG ${formatCurrency(balance)}`, 152, afterY + 11);
    } else {
      const balance = pagoStatus === "Pago" ? 0 : facturaInfo.deuda || 0;
      pdf.text(`BALANCE DUE: AWG ${formatCurrency(balance)}`, 152, afterY + 6);
    }

    // — Bank Info y footer —
    const bankY = afterY + 6;
    pdf.setFontSize(10).text("Bank Info:", mL, bankY);
    pdf
      .setFontSize(9)
      .text(pdf.splitTextToSize(invoiceConfig.bankInfo, 80), mL, bankY + 6);
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

      const fechaPagoDisplay = pagoDate || today.toLocaleDateString();
      ctx.globalAlpha = 0.4;
      ctx.font = "5px Arial";
      ctx.fillStyle = "green";
      ctx.fillText(fechaPagoDisplay, 0, 10);

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, wPt, hPt);
    }

    // — Guarda el PDF —
    pdf.save(`Invoice-${invoiceId}.pdf`);
  };

  const generateAndMaybeEmitFactura = async () => {
    // 1) Validar selección
    const flat = filteredData.flatMap((group) =>
      group.registros.map((r) => ({ ...r, fecha: group.fecha }))
    );

    // filtrar solo los marcados en selectedRows:
    const selectedData = flat.filter((r) => selectedRows[`${r.fecha}_${r.id}`]);

    if (selectedData.length === 0) {
      return Swal.fire({
        title: "No hay registros seleccionados",
        text: "Seleccione al menos uno para generar la factura.",
        icon: "warning",
        confirmButtonText: "Aceptar",
      });
    }

    // ✅ USAR SOLO EL PRIMER REGISTRO para datos base (dirección, servicio, etc.)
    const base = selectedData[0];

    // ✅ Determinar estado de pago basado en todos los servicios seleccionados
    const todosPagados = selectedData.every(
      (servicio) => servicio.pago === "Pago"
    );
    const pagoStatus = todosPagados ? "Pago" : "Debe";

    // 2) Calcular número de factura estimado
    let invoiceIdEstimado;

    const availableNumsRef = ref(database, "facturasDisponibles");
    const availableSnapshot = await new Promise((resolve) => {
      onValue(availableNumsRef, resolve, { onlyOnce: true });
    });

    if (availableSnapshot.exists()) {
      // Hay números disponibles, usar el menor para mostrar
      const availableData = availableSnapshot.val();
      const sortedAvailable = Object.entries(availableData).sort(
        ([, a], [, b]) => a.numeroFactura.localeCompare(b.numeroFactura)
      );
      const [_, numeroData] = sortedAvailable[0]; // Tomar el menor

      invoiceIdEstimado = numeroData.numeroFactura;
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

    // Usar today para el modal
    const today = new Date();

    // 3) Solicitar datos de la factura (Bill To + linea de detalle)
    const { value: res } = await Swal.fire({
      title: "Generar Factura",
      html:
        `<div style="margin-bottom:15px;padding:12px;border:1px solid #ddd;border-radius:5px;background-color:#f9f9f9;">
          <h4 style="margin:0 0 10px 0;color:#333;">Información del Servicio</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px;">
            <div><b>Dirección:</b> ${base.direccion || "No especificada"}</div>
            <div><b>Servicio:</b> ${base.servicio || "No especificado"}</div>
            <div><b>Cúbicos:</b> ${base.cubicos || "0"}</div>
            <div><b>Valor:</b> AWG ${formatCurrency(base.valor)}</div>
            <div style="grid-column: 1 / -1; text-align: center; margin-top: 8px;">
              <span style="padding:8px 16px;border-radius:20px;font-weight:bold;font-size:16px;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
                Factura #${invoiceIdEstimado}
              </span>
            </div>
          </div>
        </div>` +
        `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
          <label style="min-width:100px;font-size:14px;">Fecha Emisión:</label>
          <input id="fecha-emision" type="date" class="swal2-input" value="${
            today.toISOString().split("T")[0]
          }" style="width:150px;margin:0;font-size:12px;padding:4px 8px;" />
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
             <option value="" disabled>Seleccione un item...</option>
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
        `<div id="items-error-message" style="display: none; color: #d32f2f; font-size: 12px; margin-top: 5px; text-align: center; font-weight: bold;">⚠️ Debe agregar al menos un item a la factura</div>` +
        `<div style="text-align: right; font-weight: bold; font-size: 1.2em; margin-top: 10px;">
          Total: <span id="invoice-total">AWG 0.00</span>
         </div>`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const fechaEmision = document.getElementById("fecha-emision").value;
        const billToType = document.getElementById("bill-to-type").value;
        const customValue = document
          .getElementById("bill-to-custom")
          .value.trim();

        // Los items se recogen de la variable 'addedItems' que está en el scope de didOpen
        if (!window.addedItems || window.addedItems.length === 0) {
          // Mostrar error pero no cerrar el modal - usar un mensaje más específico
          Swal.showValidationMessage(
            "⚠️ Debe agregar al menos un item a la factura. Haga clic en 'Agregar Item' después de seleccionar un servicio."
          );
          return false;
        }

        // Validaciones básicas
        if (!fechaEmision)
          Swal.showValidationMessage("Seleccione la fecha de emisión");
        if (!billToType)
          Swal.showValidationMessage("Seleccione un tipo de Bill To");
        if (billToType === "personalizado" && !customValue)
          Swal.showValidationMessage(
            "Ingrese texto personalizado para Bill To"
          );
        return {
          fechaEmision,
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
          const errorMessage = document.getElementById("items-error-message");

          if (window.addedItems.length === 0) {
            summaryContainer.innerHTML =
              '<p style="color: #888; text-align:center;">No hay items todavía.</p>';
            if (errorMessage) {
              errorMessage.style.display = "block";
            }
          } else {
            if (errorMessage) {
              errorMessage.style.display = "none";
            }
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
                  fechaServicioItem: newDetails.fechaServicioItem, // ✅ Agregar fecha de servicio
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
                    base.fecha ? base.fecha.split("-").reverse().join("-") : ""
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
              ).value, // ✅ Agregar fecha de servicio
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
                  fechaServicioItem: itemDetails.fechaServicioItem, // ✅ Agregar fecha de servicio
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

    // 4) Calcular valor de Bill To (SOLO del primer registro)
    let billToValue = "";
    switch (res.billToType) {
      case "anombrede":
        billToValue = base.anombrede;
        break;
      case "direccion":
        billToValue = base.direccion;
        break;
      case "personalizado":
        billToValue = res.customValue;
        break;
    }

    // 5) Preparar filas con los datos ingresados en el modal (usar fecha de servicio del item)
    const filas = res.items.map((item) => {
      // Formatear fecha de servicio del item
      let fechaFormateada = base.fecha; // fallback a fecha base
      if (item.fechaServicioItem) {
        // Si la fecha está en formato YYYY-MM-DD, convertir a DD-MM-YYYY
        if (
          item.fechaServicioItem.includes("-") &&
          item.fechaServicioItem.split("-")[0].length === 4
        ) {
          const [year, month, day] = item.fechaServicioItem.split("-");
          fechaFormateada = `${day}-${month}-${year}`;
        } else {
          // Si ya está en formato DD-MM-YYYY, usar directamente
          fechaFormateada = item.fechaServicioItem;
        }
      }

      return [
        fechaFormateada, // ✅ Usar fecha de servicio del item formateada
        item.item,
        item.description,
        item.qty,
        item.rate.toFixed(2),
        formatCurrency(item.amount),
      ];
    });

    // 6) Calcular totalAmount sumando los campos 'amount' de los items
    const totalAmount = res.items.reduce((sum, item) => sum + item.amount, 0);

    // 7) Preparar invoiceItems para el nuevo nodo factura
    const invoiceItems = {};
    res.items.forEach((item, index) => {
      invoiceItems[index + 1] = {
        item: item.item,
        descripcion: item.description,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount,
        fechaServicioItem: item.fechaServicioItem, // ✅ Agregar fecha de servicio por item
      };
    });

    // 8) Preguntar si queremos emitir antes de generar el PDF
    const { isConfirmed, isDenied } = await Swal.fire({
      title: "¿Deseas emitir las facturas?",
      icon: "question",
      showDenyButton: true,
      confirmButtonText: "Sí",
      denyButtonText: "No",
    });

    if (isConfirmed) {
      let numeroFactura;
      let invoiceIdFinal;

      // Verificar si hay números disponibles para reutilizar
      const numerosDisponiblesRef = ref(database, "facturasDisponibles");
      const numerosSnapshot = await new Promise((resolve) => {
        onValue(numerosDisponiblesRef, resolve, { onlyOnce: true });
      });

      if (numerosSnapshot.exists()) {
        // Hay números disponibles, usar el menor
        const numerosData = numerosSnapshot.val();
        const sortedNumeros = Object.entries(numerosData).sort(([, a], [, b]) =>
          a.numeroFactura.localeCompare(b.numeroFactura)
        );
        const [keyToDelete, numeroData] = sortedNumeros[0]; // Tomar el menor

        invoiceIdFinal = numeroData.numeroFactura;
        numeroFactura = parseInt(invoiceIdFinal.slice(-5)); // Extraer número de secuencia

        // Eliminar de números disponibles
        await set(ref(database, `facturasDisponibles/${keyToDelete}`), null);
      } else {
        // No hay números disponibles, generar nuevo
        const contadorRef = ref(database, "contadorFactura");
        const tx = await runTransaction(contadorRef, (curr) => (curr || 0) + 1);
        numeroFactura = tx.snapshot.val();

        // Formatear YYMM + secuencia 5 dígitos para nuevo número
        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const seq = String(numeroFactura).padStart(5, "0");
        invoiceIdFinal = `${yy}${mm}${seq}`;
      }

      // ✅ CREAR EL NUEVO NODO FACTURA (sin datos específicos del servicio)
      // Calcular payments totales y fecha de pago basados en el estado de los servicios
      let paymentsTotales = 0;
      let fechaPago = null;

      if (pagoStatus === "Pago") {
        // Si todos están pagados, el payment es igual al total y usar la fecha de pago del primer servicio pagado
        paymentsTotales = totalAmount;
        const primerServicioPagado = selectedData.find(
          (servicio) => servicio.pago === "Pago"
        );
        fechaPago =
          primerServicioPagado?.fechapago ||
          new Date().toISOString().split("T")[0];
      } else {
        // Si no todos están pagados, calcular payments existentes
        paymentsTotales = selectedData.reduce((sum, registro) => {
          return sum + (parseFloat(registro.payment) || 0);
        }, 0);
      }

      const facturaData = {
        numerodefactura: invoiceIdFinal,
        timestamp: Date.now(),
        fechaEmision: res.fechaEmision, // ✅ Guardar la fecha de emisión seleccionada
        billTo: billToValue,
        invoiceItems: invoiceItems,
        totalAmount: totalAmount,
        payment: paymentsTotales, // ✅ Payment basado en estado de servicios
        deuda: totalAmount - paymentsTotales, // ✅ Deuda = Total - Payments
        pago: pagoStatus,
        fechapago: fechaPago, // ✅ Fecha de pago del primer servicio pagado
        banco: base.banco || "", // ✅ Banco del primer servicio seleccionado
        // ✅ Los datos del servicio (dirección, servicio, cúbicos) se obtienen del primer registro seleccionado
      };

      // Guardar la factura en el nuevo nodo
      await set(ref(database, `facturas/${invoiceIdFinal}`), facturaData);

      // ✅ ACTUALIZAR REGISTROS CON REFERENCIA A LA FACTURA
      await Promise.all(
        selectedData.map((r) => {
          const origin = dataBranch.some((x) => x.id === r.id)
            ? "data"
            : "registrofechas";
          const path =
            origin === "data"
              ? `data/${r.id}`
              : `registrofechas/${r.fecha}/${r.id}`;

          // Solo agregar la referencia a la factura y marcar como emitida
          const updateData = {
            factura: true,
            numerodefactura: invoiceIdFinal,
            referenciaFactura: invoiceIdFinal, // ✅ Nueva referencia
            pago: "Debe", // ✅ Establecer estado de pago en "Debe"
            timestamp: Date.now(),
          };

          return update(ref(database, path), updateData);
        })
      );
      await emitirFacturasSeleccionadas();

      // 9a) Cuando terminen de emitir, generar el PDF con datos del primer registro
      await generarPDFconDatos({
        filas,
        totalAmount: totalAmount,
        billToValue,
        numeroFactura: invoiceIdFinal,
        pagoStatus: pagoStatus,
        pagoDate: fechaPago, // ✅ Usar la fecha de pago calculada
        fechaEmision: res.fechaEmision, // ✅ Pasar la fecha de emisión al PDF
        // ✅ Datos adicionales del primer registro para el PDF
        fechaServicio: base.fecha,
        direccion: base.direccion,
        servicio: base.servicio,
        cubicos: base.cubicos,
        facturaInfo: facturaData,
      });
    } else if (isDenied) {
      Swal.fire("Cancelado", "La emisión de la factura fue cancelada.", "info");
    }
  };

  // Función para cancelar factura
  const cancelInvoice = async (fecha, registroId, numeroFactura, origin) => {
    try {
      // 1) ✅ BUSCAR TODOS LOS SERVICIOS RELACIONADOS CON LA FACTURA
      const serviciosRelacionados = [];

      // Buscar en dataBranch
      dataBranch.forEach((servicio) => {
        if (servicio.numerodefactura === numeroFactura) {
          serviciosRelacionados.push({
            ...servicio,
            origin: "data",
            path: `data/${servicio.id}`,
          });
        }
      });

      // Buscar en dataRegistroFechas
      dataRegistroFechas.forEach((grupo) => {
        grupo.registros.forEach((servicio) => {
          if (servicio.numerodefactura === numeroFactura) {
            serviciosRelacionados.push({
              ...servicio,
              origin: "registrofechas",
              path: `registrofechas/${grupo.fecha}/${servicio.id}`,
            });
          }
        });
      });

      // 2) ✅ MOSTRAR INFORMACIÓN DETALLADA ANTES DE CANCELAR
      const serviciosInfo = serviciosRelacionados
        .map(
          (servicio) =>
            `• ${servicio.direccion} - ${servicio.fecha} (${servicio.pago})`
        )
        .join("\n");

      const { isConfirmed } = await Swal.fire({
        title: "¿Cancelar Factura?",
        html: `
          <div style="text-align: left;">
            <p><strong>Factura a cancelar:</strong> ${numeroFactura}</p>
            <p><strong>Servicios relacionados (${
              serviciosRelacionados.length
            }):</strong></p>
            <div style="max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0;">
              ${serviciosInfo || "No se encontraron servicios relacionados"}
            </div>
            <p style="color: #d33; font-weight: bold;">⚠️ Esta acción:</p>
            <ul style="text-align: left; color: #d33;">
              <li>Eliminará completamente la factura</li>
              <li>Desvinculará ${
                serviciosRelacionados.length
              } servicios de esta factura</li>
              <li>El número de factura quedará disponible para reutilización</li>
            </ul>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, Cancelar Factura",
        cancelButtonText: "No, Mantener",
        confirmButtonColor: "#d33",
        width: "600px",
      });

      if (!isConfirmed) return;

      // 3) ✅ ELIMINAR EL NODO FACTURA COMPLETO
      if (numeroFactura) {
        await set(ref(database, `facturas/${numeroFactura}`), null);
      }

      // 4) ✅ LIMPIAR TODOS LOS SERVICIOS RELACIONADOS
      const updatePromises = serviciosRelacionados.map(async (servicio) => {
        const updateData = {
          factura: false,
          numerodefactura: null,
          referenciaFactura: null,
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
            factura: false,
            numerodefactura: null,
            referenciaFactura: null,
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
          registros: g.registros.map(updater),
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
        width: "500px",
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

  const emitirFacturasSeleccionadas = async () => {
    // ✅ Esta función ahora solo muestra confirmación ya que la emisión se hace arriba
    Swal.fire({
      icon: "success",
      title: "Factura emitida correctamente",
      text: "La factura se ha creado exitosamente en el sistema.",
      confirmButtonText: "Genial",
      timer: 2000,
    });

    // Limpiar selección después de emitir
    setSelectedRows({});
  };

  // 1) Función de eliminación
  const EliminarServicio = () => {
    // 1) Si aún no estamos en modo selección, activamos el modo
    if (!showSelection) {
      setShowSelection(true);
      return;
    }
    // 2) Si estamos en modo selección pero no hay nada seleccionado, salimos
    if (showSelection && !selectedKey) {
      setShowSelection(false);
      return;
    }

    // Extraigo fecha y id del registro marcado
    const [fecha, registroId] = selectedKey.split("_");
    // Busco en todos los registros filtrados
    const flatFiltered = filteredData.flatMap((g) => g.registros);
    const reg = flatFiltered.find(
      (r) => r.fecha === fecha && r.id === registroId
    );

    if (!reg) {
      Swal.fire({
        icon: "error",
        title: "Registro no encontrado",
        text: "El registro seleccionado ya no está disponible.",
      });
      setSelectedKey(null);
      setShowSelection(false);
      return;
    }

    // Paso A: pregunta genérica
    Swal.fire({
      title: "¿Deseas eliminar este registro?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "No, cancelar",
    }).then((answer) => {
      if (!answer.isConfirmed) return;

      // Paso B: tu alerta con detalles
      Swal.fire({
        title: "¿Estás seguro de eliminar este registro?",
        html: `
        <p><strong>Factura:</strong> ${reg.factura ? "Sí" : "No"}</p>
        <p><strong>N° Factura:</strong> ${reg.numerodefactura || "–"}</p>
        <p><strong>Estado:</strong> ${reg.pago}</p>
        <p><strong>Dirección:</strong> ${reg.direccion}</p>
        <p><strong>Fecha:</strong> ${reg.fecha}</p>
      `,
        icon: "error",
        showCancelButton: true,
        confirmButtonText: "Eliminar permanentemente",
        cancelButtonText: "Cancelar",
      }).then((result) => {
        if (!result.isConfirmed) return;

        // Finalmente borramos en Firebase
        const path = dataBranch.some((x) => x.id === registroId)
          ? `data/${registroId}`
          : `registrofechas/${fecha}/${registroId}`;

        remove(ref(database, path))
          .then(() => {
            Swal.fire("Eliminado", "Registro borrado.", "success");
            setSelectedKey(null);
            setShowSelection(false);
          })
          .catch(() => {
            Swal.fire("Error", "No se pudo eliminar.", "error");
          });
      });
    });
  };

  const handleToggleSelection = (key) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  };

  const TotalServiciosPorTrabajador = () => {
    // users ya viene sin admin, contador, usernotactive
    const usersIndex = new Map(users.map((u) => [u.id, u])); // id -> {id, name}
    const visibleUserIds = new Set(users.map((u) => u.id));

    // 1) Aplano todos los registros filtrados
    const allRecords = filteredData.flatMap((group) => group.registros);

    // 2) Calculo totales SOLO para IDs visibles; mantengo "__unassigned__"
    const counts = allRecords.reduce((acc, item) => {
      const uid = item.realizadopor || "__unassigned__";

      // Excluir registros asignados a IDs que no están en la lista visible
      if (uid !== "__unassigned__" && !visibleUserIds.has(uid)) return acc;

      acc[uid] = (acc[uid] || 0) + 1;
      return acc;
    }, {});

    // 3) Extraigo "Sin Asignar"
    const unassignedCount = counts["__unassigned__"] || 0;
    delete counts["__unassigned__"];

    // 4) Construyo la tabla
    let html = `
    <table style="width:100%; border-collapse:collapse; font-family:sans-serif; text-align:left;">
      <thead>
        <tr>
          <th style="background-color:#5271ff;color:white;padding:8px;border:1px solid #ddd;">Trabajador</th>
          <th style="background-color:#5271ff;color:white;padding:8px;border:1px solid #ddd;">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

    Object.entries(counts).forEach(([uid, cnt]) => {
      if (cnt === 0) return;
      const name = usersIndex.get(uid)?.name || "(desconocido)";
      html += `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${name}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${cnt}</td>
      </tr>
    `;
    });

    html += `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">Sin Asignar</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${unassignedCount}</td>
    </tr>
  `;

    // 5) Gran total mostrado (solo visibles + sin asignar)
    const grandTotalShown =
      Object.values(counts).reduce((a, b) => a + b, 0) + unassignedCount;

    html += `
      <tr style="font-weight:bold;">
        <th style="padding:8px;border:1px solid #ddd;background-color:#5271ff;color:white;text-align:left;">
          Total:
        </th>
        <th style="padding:8px;border:1px solid #ddd;background-color:#5271ff;color:white;text-align:center;">
          ${grandTotalShown}
        </th>
      </tr>
    </tbody>
  </table>
  `;

    Swal.fire({
      title: "Total de servicios por trabajador",
      html,
      width: "600px",
      showCloseButton: true,
      focusConfirm: false,
      confirmButtonText: "Cerrar",
    });
  };

  // Reloj interno para calcular días de mora
  useEffect(() => {
    setCurrentTime(Date.now());

    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 24 * 60 * 60 * 1000); // Actualiza cada 24 horas

    return () => clearInterval(timer);
  }, []);

  // Early return: mientras loading sea true, muestra el spinner
  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  // Función para calcular días de mora
  const calculateDaysDelay = (timestamp, pagoStatus) => {
    if (pagoStatus === "Pago") return 0;
    const days = Math.floor((currentTime - timestamp) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  };
  console.log("Rerender");
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
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="filter-button"
        >
          {showDatePicker
            ? "Ocultar selector de fechas"
            : "Filtrar por rango de fechas"}
        </button>
        {showDatePicker && (
          <DatePicker
            selected={filters.fechaInicio}
            onChange={handleDateRangeChange}
            startDate={filters.fechaInicio}
            endDate={filters.fechaFin}
            selectsRange
            inline
          />
        )}
        <button
          onClick={() => setShowPagoDatePicker(!showPagoDatePicker)}
          className="filter-button"
        >
          {showPagoDatePicker
            ? "Ocultar selector de fechas"
            : "Filtrar por fecha de pago"}
        </button>
        {showPagoDatePicker && (
          <DatePicker
            selected={filters.fechaPagoInicio}
            onChange={handlePagoDateRangeChange}
            startDate={filters.fechaPagoInicio}
            endDate={filters.fechaPagoFin}
            selectsRange
            inline
          />
        )}
        <button
          className="filter-button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              sinFechaPago: !prev.sinFechaPago,
              fechaPagoInicio: null,
              fechaPagoFin: null,
            }))
          }
        >
          {filters.sinFechaPago
            ? "Quitar filtro sin fecha"
            : "Filtrar sin fecha de pago"}
        </button>

        <label>Realizado Por</label>
        <Select
          isClearable
          isMulti
          options={realizadoporOptions}
          value={filters.realizadopor}
          onChange={(opts) =>
            setFilters({ ...filters, realizadopor: opts || [] })
          }
          placeholder="Usuario(s)..."
        />
        <label>A Nombre De</label>
        <Select
          isClearable
          isMulti
          options={anombredeOptions}
          value={filters.anombrede}
          onChange={(opts) => setFilters({ ...filters, anombrede: opts || [] })}
          placeholder="Nombre(s)..."
        />
        <label>Dirección</label>
        <Select
          isClearable
          isMulti
          options={direccionOptions}
          value={filters.direccion}
          onChange={(opts) => setFilters({ ...filters, direccion: opts || [] })}
          placeholder="Dirección(es)..."
        />
        <div
          style={{
            marginTop: 10,
            padding: "10px",
            width: "90%",
            borderRadius: 8,
          }}
        >
          <button
            className="filter-button"
            onClick={() => setAddrChecklistOpen((o) => !o)}
            style={{ width: "100%", marginBottom: 8 }}
          >
            {addrChecklistOpen
              ? "Ocultar"
              : "Seleccionar varias direcciones"}
          </button>

          {addrChecklistOpen && (
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                paddingBottom: 8,
                background: "#1c1f24",
              }}
            >
              {/* Buscador */}
              <input
                type="text"
                placeholder="Buscar dirección..."
                value={addrSearch}
                onChange={(e) => setAddrSearch(e.target.value)}
                style={{
                  width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #3a3f46",
            background: "#0f1216",
            color: "#e8e8e8",
            outline: "none",
            marginBottom: 8,
                }}
              />

              {/* Acciones rápidas */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button
                  className="filter-button"
                  onClick={selectAllVisibleDirecciones}
                  style={{ flex: 1 }}
                >
                  Seleccionar visibles
                </button>
                <button
                  className="discard-filter-button"
                  onClick={clearAllVisibleDirecciones}
                  style={{ flex: 1 }}
                >
                  Limpiar visibles
                </button>
              </div>

              {/* Lista con scroll */}
              <div
                style={{
          maxHeight: 260,
          overflowY: "auto",
          border: "1px solid #2a2f36",
          borderRadius: 8,
          padding: 6,
          marginTop: 8,
          background: "#0f1216",
        }}
              >
                {visibleDirecciones.length === 0 ? (
                  <div
                    style={{
              color: "#b9c0c8",
              fontStyle: "italic",
              textAlign: "center",
              padding: "14px 0",
            }}
                  >
                    Sin coincidencias
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {visibleDirecciones.map((dir) => (
              <li
                key={dir}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  display: "grid",
                  gridTemplateColumns: "22px 1fr",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!addrChecked[dir]}
                  onChange={() => toggleAddrCheck(dir)}
                  style={{
                    width: 18,
                    height: 18,
                    cursor: "pointer",
                    accentColor: "#5271ff",
                  }}
                />
                {/* Texto de dirección: hasta 2 líneas + tooltip completo */}
                <span
                  title={dir}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    lineHeight: "1.2",
                    color: "#e6e9ed",
                    wordBreak: "break-word",
                  }}
                >
                  {dir}
                </span>
              </li>
            ))}
          </ul>
                )}
              </div>

              {/* Aplicar */}
              <button
                className="filter-button"
                onClick={applyDireccionChecklist}
                style={{
                  width: "100%",
                  marginTop: 10,
                  backgroundColor: "#28a745",
                }}
              >
                Aplicar filtro con direcciones seleccionadas
              </button>
            </div>
          )}
        </div>

        <label>Servicio</label>
        <Select
          isClearable
          isMulti
          options={servicioOptions}
          value={filters.servicio}
          onChange={(opts) => setFilters({ ...filters, servicio: opts || [] })}
          placeholder="Servicio(s)..."
        />
        <label>Cúbicos</label>
        <Select
          isClearable
          isMulti
          options={cubicosOptions}
          value={filters.cubicos}
          onChange={(opts) => setFilters({ ...filters, cubicos: opts || [] })}
          placeholder="Valor(es)..."
        />
        <label>Valor</label>
        <Select
          isClearable
          isMulti
          options={valorOptions}
          value={filters.valor}
          onChange={(opts) => setFilters({ ...filters, valor: opts || [] })}
          placeholder="Valor(es)..."
        />
        <label>Pago</label>
        <Select
          isClearable
          isMulti
          options={pagoOptions}
          value={filters.pago}
          onChange={(opts) => setFilters({ ...filters, pago: opts || [] })}
          placeholder="Estado(s)..."
        />
        <label>Forma De Pago</label>
        <Select
          isClearable
          isMulti
          options={formadePagoOptions}
          value={filters.formadepago}
          onChange={(opts) =>
            setFilters({ ...filters, formadepago: opts || [] })
          }
          placeholder="Selecciona forma(s)..."
        />
        <label>Banco</label>
        <Select
          isClearable
          isMulti
          options={BancoOptions}
          value={filters.banco}
          onChange={(opts) => setFilters({ ...filters, banco: opts || [] })}
          placeholder="Selecciona forma(s)..."
        />
        <label>Método de Pago</label>
        <Select
          isClearable
          isMulti
          options={metododepagoOptions}
          value={filters.metododepago}
          onChange={(opts) =>
            setFilters({ ...filters, metododepago: opts || [] })
          }
          placeholder="Método(s)..."
        />
        <label>Efectivo</label>
        <Select
          isClearable
          isMulti
          options={efectivoOptions}
          value={filters.efectivo}
          onChange={(opts) => setFilters({ ...filters, efectivo: opts || [] })}
          placeholder="Monto(s)..."
        />

        <label>Payment</label>
        <Select
          isClearable
          isMulti
          options={paymentOptions}
          value={filters.payment}
          onChange={(opts) => setFilters({ ...filters, payment: opts || [] })}
          placeholder="Monto(s) de payment..."
        />

        <label>N° de Factura</label>
        <input
          type="text"
          placeholder="Buscar número de factura..."
          value={filters.numerodefactura}
          onChange={(e) =>
            setFilters({ ...filters, numerodefactura: e.target.value })
          }
          style={{
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            width: "95%",
          }}
        />

        <label>Factura</label>
        <select
          value={filters.factura}
          onChange={(e) => setFilters({ ...filters, factura: e.target.value })}
        >
          <option value="">Todos</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              realizadopor: [],
              anombrede: [],
              direccion: [],
              servicio: [],
              cubicos: [],
              valor: [],
              pago: [],
              formadepago: [],
              banco: [],
              metododepago: [],
              efectivo: [],
              payment: [],
              numerodefactura: "",
              factura: "",
              fechaInicio: null,
              fechaFin: null,
              fechaPagoInicio: null,
              fechaPagoFin: null,
            })
          }
        >
          Descartar Filtros
        </button>
      </div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Agenda Dinámica</h1>
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
                {showSelection && <th></th>}
                <th>Fecha</th>
                <th>Realizado Por</th>
                <th>A Nombre De</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Servicio</th>
                <th>Cúbicos</th>
                <th>Valor</th>
                <th>Pago</th>
                {showCobranzaSelection && <th></th>}
                <th>Fecha de Pago</th>
                <th>Forma De Pago</th>
                <th>Banco</th>
                <th style={{ backgroundColor: "#6200ffb4" }}>Notas</th>
                <th style={{ backgroundColor: "#6200ffb4" }}>Método De Pago</th>
                <th style={{ backgroundColor: "#6200ffb4" }}>Efectivo</th>
                <th>Emitir</th>
                <th>Factura</th>
                <th>N° Factura</th>
                <th>Payment</th>
                <th>Payment Rápido</th>
                <th>Pago</th>
                <th>Cancelar</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <React.Fragment key={item.fecha}>
                  {item.registros.map((registro) => (
                    <tr
                      key={`${registro.origin}_${item.fecha}_${registro.id}`}
                      className={`${
                        activeRow === registro.id ? "active-row" : ""
                      }`}
                    >
                      {showSelection && (
                        <td>
                          {(() => {
                            const key = `${item.fecha}_${registro.id}`;
                            return (
                              <input
                                type="checkbox"
                                checked={selectedKey === key}
                                onChange={() => handleToggleSelection(key)}
                                disabled={!!selectedKey && selectedKey !== key}
                                style={{
                                  width: "3ch",
                                  height: "3ch",
                                  margin: "0 8px",
                                }}
                              />
                            );
                          })()}
                        </td>
                      )}

                      <td
                        style={{
                          minWidth: window.innerWidth < 768 ? "55px" : "80px",
                          textAlign: "center",
                          fontWeight: "bold",
                        }}
                      >
                        {/* Fecha solo lectura, sin input editable */}
                        {item.fecha}
                      </td>
                      <td>
                        {/*
     Si el registro tiene un realizadopor cuyo role es "usernotactive",
     mostramos sólo el nombre (no aparece en el select de activos).
   */}
                        {(() => {
                          const assigned = allUsers.find(
                            (u) => u.id === registro.realizadopor
                          );
                          const isInactive = assigned?.role === "usernotactive";
                          if (isInactive) {
                            return (
                              <span style={{ marginLeft: "12px" }}>
                                {assigned.name}
                              </span>
                            );
                          } else {
                            return (
                              <select
                                value={registro.realizadopor || ""}
                                onChange={(e) =>
                                  handleFieldChange(
                                    item.fecha,
                                    registro.id,
                                    "realizadopor",
                                    e.target.value,
                                    registro.origin
                                  )
                                }
                                style={{
                                  width: "fit-content",
                                  minWidth: "16ch",
                                  maxWidth: "100%",
                                  paddingRight: "3ch",
                                }}
                              >
                                <option value=""></option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            );
                          }
                        })()}
                      </td>

                      <td>
                        <input
                          style={{ width: "16ch" }}
                          type="text"
                          value={
                            localValues[`${registro.id}_anombrede`] ??
                            registro.anombrede ??
                            ""
                          }
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${registro.id}_anombrede`]: e.target.value,
                            }))
                          }
                          onFocus={() => handleRowEdit(registro.id)}
                          onBlur={(e) => {
                            handleRowEditEnd();
                            if (e.target.value !== (registro.anombrede || "")) {
                              handleFieldChange(
                                item.fecha,
                                registro.id,
                                "anombrede",
                                e.target.value,
                                registro.origin
                              );
                            }
                          }}
                        />
                      </td>
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            className="direccion-fixed-input "
                            style={{ width: "18ch" }}
                            type="text"
                            value={
                              localValues[`${registro.id}_direccion`] ??
                              registro.direccion ??
                              ""
                            }
                            onChange={(e) =>
                              setLocalValues((prev) => ({
                                ...prev,
                                [`${registro.id}_direccion`]: e.target.value,
                              }))
                            }
                            onFocus={() => handleRowEdit(registro.id)}
                            onBlur={(e) => {
                              handleRowEditEnd();
                              if (
                                e.target.value !== (registro.direccion || "")
                              ) {
                                handleFieldChange(
                                  item.fecha,
                                  registro.id,
                                  "direccion",
                                  e.target.value,
                                  registro.origin
                                );
                              }
                            }}
                            list={`direccion-options-${registro.id}`}
                          />
                        </div>
                      </td>
                      <td>
                        <select
                          value={registro.servicio || ""}
                          style={{ width: "23ch" }}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              "servicio",
                              e.target.value,
                              registro.origin
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
                          <option value="Pool">Pool</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ textAlign: "center" }}
                          value={
                            localValues[`${registro.id}_cubicos`] ??
                            registro.cubicos ??
                            ""
                          }
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${registro.id}_cubicos`]: e.target.value,
                            }))
                          }
                          onFocus={() => handleRowEdit(registro.id)}
                          onBlur={(e) => {
                            handleRowEditEnd();
                            if (e.target.value !== (registro.cubicos || "")) {
                              handleFieldChange(
                                item.fecha,
                                registro.id,
                                "cubicos",
                                e.target.value,
                                registro.origin
                              );
                            }
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ width: "10ch" }}
                          value={
                            localValues[`${registro.id}_valor`] ??
                            registro.valor ??
                            ""
                          }
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${registro.id}_valor`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (registro.valor || "")) {
                              handleFieldChange(
                                item.fecha,
                                registro.id,
                                "valor",
                                e.target.value,
                                registro.origin
                              );
                            }
                          }}
                        />
                      </td>
                      <td>
                        <select
                          value={registro.pago || ""}
                          style={{ width: "12ch" }}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              "pago",
                              e.target.value,
                              registro.origin
                            )
                          }
                        >
                          <option value=""></option>
                          <option value="Debe">Debe</option>
                          <option value="Pago">Pago</option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="Pendiente Fin De Mes">-</option>
                        </select>
                      </td>
                      {showCobranzaSelection && (
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            style={{ width: "3ch", height: "3ch" }}
                            checked={!!cobranzaSelectedRows[registro.id]}
                            onChange={(e) =>
                              handleCobranzaRowSelection(
                                null,
                                registro.id,
                                e.target.checked
                              )
                            }
                            // si quieres impedir cobrar ya pagados, descomenta:
                            // disabled={registro.pago === "Pago"}
                            title="Marcar para enviar a Informe de Cobranza"
                          />
                        </td>
                      )}

                      <td>
                        <input
                          type="date"
                          value={
                            registro.numerodefactura
                              ? facturas[registro.numerodefactura]?.fechapago ||
                                ""
                              : registro.fechapago || ""
                          }
                          disabled={registro.pago !== "Pago"}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              registro.numerodefactura
                                ? "fechapago_factura"
                                : "fechapago",
                              e.target.value,
                              registro.origin
                            )
                          }
                          style={{
                            width: "16ch",
                            opacity: registro.pago !== "Pago" ? 0.5 : 1,
                            cursor:
                              registro.pago !== "Pago" ? "not-allowed" : "auto",
                            backgroundColor: registro.numerodefactura
                              ? "#f0f8ff"
                              : "white",
                            borderColor: registro.numerodefactura
                              ? "#007bff"
                              : "#ccc",
                          }}
                          title={
                            registro.numerodefactura
                              ? `Fecha de pago de la factura #${registro.numerodefactura}`
                              : "Fecha de pago del servicio individual"
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={registro.formadepago || ""}
                          style={{ width: "15ch" }}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              "formadepago",
                              e.target.value,
                              registro.origin
                            )
                          }
                        >
                          <option value=""></option>
                          <option value="Efectivo">Efectivo</option>
                          <option value="Transferencia">Transferencia</option>
                          <option value="Intercambio">Intercambio</option>
                          <option value="Garantia">Garantia</option>
                          <option value="Perdido">Perdido</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={registro.banco || ""}
                          style={{ width: "22ch" }}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              "banco",
                              e.target.value,
                              registro.origin
                            )
                          }
                        >
                          <option value=""></option>
                          <option value="Aruba Bank N.V.">
                            Aruba Bank N.V.
                          </option>
                          <option value="Caribbean Mercantile Bank N.V.">
                            Caribbean Mercantile Bank N.V.
                          </option>
                          <option value="RBC Royal Bank N.V.">
                            RBC Royal Bank N.V.
                          </option>
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
                            handleNotesClick(
                              item.fecha,
                              registro.id,
                              registro.notas,
                              registro.origin
                            )
                          }
                        >
                          {registro.notas ? (
                            <p
                              style={{
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                paddingRight: "5px",
                              }}
                            >
                              {registro.notas || ""}
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
                        <select
                          value={registro.metododepago || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              "metododepago",
                              e.target.value,
                              registro.origin
                            )
                          }
                        >
                          <option value=""></option>
                          <option value="credito">Crédito</option>
                          <option value="cancelado">Cancelado</option>
                          <option value="efectivo">Efectivo</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ width: "10ch" }}
                          value={
                            localValues[`${registro.id}_efectivo`] ??
                            registro.efectivo ??
                            ""
                          }
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${registro.id}_efectivo`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (registro.efectivo || "")) {
                              handleFieldChange(
                                item.fecha,
                                registro.id,
                                "efectivo",
                                e.target.value,
                                registro.origin
                              );
                            }
                          }}
                          disabled={registro.metododepago !== "efectivo"}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          style={{
                            width: "3ch",
                            height: "3ch",
                            marginLeft: "30%",
                          }}
                          checked={
                            !!selectedRows[`${item.fecha}_${registro.id}`]
                          }
                          onChange={(e) =>
                            handleRowSelection(
                              item.fecha,
                              registro.id,
                              e.target.checked
                            )
                          }
                          disabled={registro.factura === true}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={registro.factura === true}
                          readOnly
                          style={{
                            width: "3ch",
                            height: "3ch",
                            marginLeft: "35%",
                            pointerEvents: "none",
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {registro.numerodefactura ? (
                          <button
                            onClick={() =>
                              openFacturaModal(registro.numerodefactura)
                            }
                            className="numero-factura-btn"
                            title={`Ver/Editar Factura N° ${registro.numerodefactura}`}
                          >
                            {registro.numerodefactura}
                          </button>
                        ) : (
                          <span
                            style={{
                              color: "#ccc",
                              fontSize: "11px",
                              fontStyle: "italic",
                            }}
                          >
                            Sin N°
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={getPaymentFactura(registro) || ""}
                          readOnly
                          style={{
                            width: "10ch",
                            textAlign: "center",
                            backgroundColor: "#f8f9fa",
                            cursor: "not-allowed",
                            color: "#6c757d",
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {registro.numerodefactura ? (
                          <button
                            onClick={() =>
                              paymentRapido(registro.numerodefactura)
                            }
                            className="payment-rapido-btn"
                            title={`Payment rápido para factura ${registro.numerodefactura}`}
                          >
                            Payment
                          </button>
                        ) : (
                          <span
                            className="estado-pago-span"
                            style={{
                              color: "#ccc",
                              fontSize: "11px",
                              fontStyle: "italic",
                            }}
                          >
                            Sin factura
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={registro.pago === "Pago"}
                          readOnly
                          style={{
                            width: "3ch",
                            height: "3ch",
                            marginLeft: "28%",
                            pointerEvents: "none",
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {registro.factura && registro.numerodefactura ? (
                          <button
                            onClick={() =>
                              cancelInvoice(
                                item.fecha,
                                registro.id,
                                registro.numerodefactura,
                                registro.origin
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
                            title={`Cancelar factura ${registro.numerodefactura}`}
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
          className="button-container"
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            width: "100%",
            marginBottom: "0",
            marginTop: "5px",
          }}
        >
          <button
            style={{ backgroundColor: "#5271ff" }}
            onClick={TotalServiciosPorTrabajador}
            className="filter-button"
          >
            Servicios Por Trabajador
          </button>
          <button
            style={{ backgroundColor: "#ff5252" }}
            onClick={EliminarServicio}
            className="filter-button"
          >
            {!showSelection
              ? "Eliminar Servicio"
              : selectedKey
              ? "Eliminar Servicio"
              : "Ocultar casillas"}
          </button>
          <button
            style={{ backgroundColor: "#0a7e00ff" }}
            onClick={GestionarCobranza}
            className="filter-button"
          >
            {!showCobranzaSelection
              ? "Cobranza"
              : cobranzaSelectedRows
              ? "Enviar a Cobranza"
              : "Ocultar casillas"}
          </button>
        </div>
      </div>

      <button
        className="generate-button3"
        onClick={generateAndMaybeEmitFactura}
      >
        <img
          className="generate-button-imagen3"
          src={guardarfactura}
          alt="Generar y Emitir Factura"
        />
      </button>
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

export default React.memo(Hojadefechas);
