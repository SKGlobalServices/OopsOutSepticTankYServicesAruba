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
import guardarfactura from "../assets/img/guardarfactura_icon.jpg";
import Select from "react-select";
import logotipo from "../assets/img/logo.png";

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
  // Estados para los datos:
  const [dataBranch, setDataBranch] = useState([]);
  const [dataRegistroFechas, setDataRegistroFechas] = useState([]);
  const [todos, setTodos] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});
  const [selectAll, setSelectAll] = useState(false);
  const [showPagoDatePicker, setShowPagoDatePicker] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

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
    factura: "",
    fechaInicio: null,
    fechaFin: null,
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
    const dbRef = ref(database, "clientes");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedClients = Object.entries(snapshot.val()).map(
          ([id, client]) => ({ id, direccion: client.direccion })
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
        const val = toStr
          ? (registro[field] ?? "").toString()
          : (registro[field] ?? "").toLowerCase();
        return val === (toStr ? opt.value : opt.value.toLowerCase());
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

  // A partir de aquí utiliza filteredData para mapear tu tabla…

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

    // 5) Campos especiales: "realizadopor" y "servicio"
    if (field === "realizadopor" || field === "servicio") {
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
          if (current) syncWithClients(current.direccion, current.cubicos);
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
          if (current) syncWithClients(current.direccion, current.cubicos);
        }
      }
      return;
    }

    // 6) Cualquier otro campo → sólo actualizamos ese campo
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
        Pago: registro.pago === "Pago" ? "Sí" : "No",
        "Forma De Pago": registro.formadepago || "",
        Banco: registro.banco || "",
        Notas: registro.notas || "",
        "Método De Pago": registro.metododepago || "",
        Efectivo: registro.efectivo || "",
        Factura: registro.factura ? "Sí" : "No",
      }))
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data");

    const headers = [
      "Fecha",
      "Realizado Por",
      "A Nombre De",
      "Dirección",
      "Servicio",
      "Cúbicos",
      "Valor",
      "Pago",
      "Forma De Pago",
      "Banco",
      "Notas",
      "Método De Pago",
      "Efectivo",
      "Factura",
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
    worksheet.columns = headers.map(() => ({ width: 15 }));

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
    a.download = "Servicios.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Manejo del DatePicker para rango de fechas
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  // ② Carga desde Firebase (“configuraciondefactura”)
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
    // pagoDate,
  }) => {
    // Validar que invoiceConfig tenga datos
    if (!invoiceConfig.companyName) {
      console.warn("Configuración de factura no cargada completamente");
      // Esperar un poco más para que se cargue la configuración
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

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
    const numStr = numeroFactura.toString();
    const invoiceNumber = numStr.padStart(4, "0");
    // ... continúa con la lógica para añadir datos al PDF como filas, totales, etc.
    const textX = mL + logoWidth + 5;

    // 1) Calcula YYMM + secuencia de 4 dígitos
    const today = new Date();
    const yy = today.getFullYear().toString().slice(-2); // "25"
    const mm = String(today.getMonth() + 1).padStart(2, "0"); // "06"
    const seq = numeroFactura.toString().padStart(4, "0"); // "0001"
    const invoiceId = `${yy}${mm}${seq}`; // "25060001"

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

    // — Total —
    const afterY = pdf.lastAutoTable.finalY;

    // BALANCE DUE únicamente se pone en 0 si pagoStatus === "Pago"
    // — Total —
    // siempre mantenemos balance como number, y formateamos con tu helper:
    const balance = pagoStatus === "Pago" ? 0 : totalAmount;
    pdf.setFontSize(10);
    pdf.text(
      `BALANCE DUE: AWG ${formatCurrency(balance)}`, // ahora siempre pasas un string
      152,
      afterY + 6
    );

    pdf.setFontSize(10).text(`BALANCE DUE: AWG ${balance}`, 152, afterY + 6);

    // — Bank Info y footer —
    const bankY = afterY + 12;
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

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, wPt, hPt);

      // — PAYMENT total —
      pdf
        .setFontSize(10)
        .text(`PAYMENT: AWG ${formatCurrency(totalAmount)}`, 152, afterY + 12);

      // — Fecha de pago debajo del sello —
      // pdf
      //   .setFontSize(12)
      //   .setTextColor(0, 128, 0)
      //   .text(`${pagoDate}`, wPt / 2, hPt / 2 + 15, {
      //     align: "center",
      //   });
    }

    // — Guarda el PDF —
    pdf.save(`Invoice-${invoiceId}.pdf`);
  };

  const generateAndMaybeEmitFactura = async () => {
    // 1) Validar selección
    // EN generateAndMaybeEmitFactura, justo antes de "const base = selectedData[0];"
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

    const base = selectedData[0];

    // 2) Solicitar datos de la factura (Bill To + linea de detalle)
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
          </div>
        </div>` +
        `<label>Bill To:</label>` +
        `<select id="bill-to-type" class="swal2-select" style="width:75%;">
         <option value="" disabled selected>Elija...</option>
         <option value="anombrede">A Nombre De</option>
         <option value="direccion">Dirección</option>
         <option value="personalizado">Personalizado</option>
       </select>` +
        `<input id="bill-to-custom" class="swal2-input" placeholder="Texto personalizado" style="display:none; width:70%; margin:0.5em auto 0;" />` +
        `<hr/>` +
        `<label>Item:</label>` +
        `<select id="swal-item" class="swal2-select" style="width:75%;">
         <option value="" disabled selected>Seleccione...</option>
         ${Object.keys(ITEM_RATES)
           .map((i) => `<option value="${i}">${i}</option>`)
           .join("\n")}
       </select>` +
        `<textarea id="swal-description" class="swal2-textarea" placeholder="Descripción del servicio" style="width:60%;min-height:80px;resize:vertical;"></textarea>` +
        `<input id="swal-qty" type="number" min="0" class="swal2-input" placeholder="Qty" />` +
        `<input id="swal-rate" type="number" min="0" step="0.01" class="swal2-input" placeholder="Rate" />` +
        `<input id="swal-amount" class="swal2-input" placeholder="Amount" readonly />`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const billToType = document.getElementById("bill-to-type").value;
        const customValue = document
          .getElementById("bill-to-custom")
          .value.trim();
        const item = document.getElementById("swal-item").value;
        const description = document
          .getElementById("swal-description")
          .value.trim();
        const qty = parseFloat(document.getElementById("swal-qty").value) || 0;
        const rate =
          parseFloat(document.getElementById("swal-rate").value) || 0;
        const amount =
          parseFloat(
            document.getElementById("swal-amount").value.replace(/[^\d.-]/g, "")
          ) || 0;

        // Validaciones básicas
        if (!billToType)
          Swal.showValidationMessage("Seleccione un tipo de Bill To");
        if (billToType === "personalizado" && !customValue)
          Swal.showValidationMessage(
            "Ingrese texto personalizado para Bill To"
          );
        if (!item) Swal.showValidationMessage("Seleccione un item");
        if (!description) Swal.showValidationMessage("Ingrese una descripción");
        if (qty <= 0) Swal.showValidationMessage("Qty debe ser mayor que 0");
        return {
          billToType,
          customValue,
          item,
          description,
          qty,
          rate,
          amount,
        };
      },
      didOpen: () => {
        // Mostrar input personalizado si corresponde
        const sel = document.getElementById("bill-to-type");
        const inp = document.getElementById("bill-to-custom");
        sel.addEventListener("change", (e) => {
          inp.style.display =
            e.target.value === "personalizado" ? "block" : "none";
        });

        // Cálculo automático de Rate -> Amount
        const itemSel = document.getElementById("swal-item");
        const qtyInp = document.getElementById("swal-qty");
        const rateInp = document.getElementById("swal-rate");
        const amtInp = document.getElementById("swal-amount");
        itemSel.addEventListener("change", (e) => {
          const defaultRate = ITEM_RATES[e.target.value] ?? 0;
          rateInp.value = defaultRate.toFixed(2);
          const calculatedAmount =
            defaultRate * (parseFloat(qtyInp.value) || 0);
          amtInp.value = formatCurrency(calculatedAmount);
        });
        [qtyInp, rateInp].forEach((field) =>
          field.addEventListener("input", () => {
            const q = parseFloat(qtyInp.value) || 0;
            const r = parseFloat(rateInp.value) || 0;
            const calculatedAmount = q * r;
            amtInp.value = formatCurrency(calculatedAmount);
          })
        );
      },
    });
    if (!res) return; // Usuario canceló

    // 3) Calcular valor de Bill To
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

    // 4) Escribir en Firebase: una entrada por cada registro seleccionado
    // const factRef = ref(database, "facturasemitidas");
    // selectedData.forEach((r) => {
    //   const newRef = push(factRef);
    //   set(newRef, {
    //     ...r,
    //     item: res.item,
    //     descripcion: res.description,
    //     qty: res.qty,
    //     rate: res.rate,
    //     amount: res.amount,
    //     billTo: billToValue,
    //     timestamp: Date.now(),
    //     pago: r.pago === "Pago",
    //     factura: true,
    //   }).catch(console.error);
    // });

    // 5) Preparar filas con los datos ingresados en el modal
    const filas = selectedData.map((r) => [
      r.fecha,
      res.item,
      res.description,
      res.qty,
      res.rate,
      formatCurrency(res.amount),
    ]);

    // 6) Calcular totalAmount sumando los campos 'amount' de los registros seleccionados
    const totalAmount = res.amount * selectedData.length;

    // 7) Incrementar contador en Firebase y obtener número
    const contadorRef = ref(database, "contadorFactura");
    const tx = await runTransaction(contadorRef, (curr) => (curr || 0) + 1);
    const numeroFactura = tx.snapshot.val();

    // 8) Preguntar si queremos emitir antes de generar el PDF
    const { isConfirmed, isDenied } = await Swal.fire({
      title: "¿Deseas emitir las facturas?",
      icon: "question",
      showDenyButton: true,
      confirmButtonText: "Sí",
      denyButtonText: "No",
    });

    if (isConfirmed) {
      // 8a) Si el usuario dice Sí → emitimos primero
      const factRef = ref(database, "facturasemitidas");
      selectedData.forEach((r) => {
        const newRef = push(factRef);
        set(newRef, {
          ...r,
          item: res.item,
          descripcion: res.description,
          qty: res.qty,
          rate: res.rate,
          amount: res.amount,
          billTo: billToValue,
          timestamp: Date.now(),
          pago: r.pago === "Pago",
          factura: true,
          numerodefactura: numeroFactura,
          fecha: r.fecha,
        }).catch(console.error);
      });
      await emitirFacturasSeleccionadas();
      // 9a) Cuando terminen de emitir, generar el PDF
      await generarPDFconDatos({
        filas,
        totalAmount: totalAmount,
        billToValue,
        numeroFactura,
        pagoStatus: base.pago,
        agoDate: base.fechapago,
        item: res.item,
        description: res.description,
        qty: res.qty,
        rate: res.rate,
        amount: res.amount,
      });
    } else if (isDenied) {
      // 8b) Si el usuario dice No → generar el PDF sin emitir
      await generarPDFconDatos({
        filas,
        totalAmount: totalAmount,
        billToValue,
        numeroFactura,
        pagoStatus: base.pago,
        pagoDate: base.fechapago,
        item: res.item,
        description: res.description,
        qty: res.qty,
        rate: res.rate,
        amount: res.amount,
      });
    }
  };

  const emitirFacturasSeleccionadas = async () => {
    // 1) Recoge las claves (fecha_id) de los registros seleccionados
    const seleccionadas = Object.entries(selectedRows)
      .filter(([_, sel]) => sel)
      .map(([key]) => key);

    if (!seleccionadas.length) {
      return Swal.fire({
        title: "No hay registros seleccionados",
        text: "Selecciona al menos un registro para emitir facturas.",
        icon: "warning",
        confirmButtonText: "Aceptar",
      });
    }

    Swal.fire({
      title: "Emitiendo facturas...",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    // 2) Para cada registro seleccionado solo actualiza el campo factura
    for (const key of seleccionadas) {
      const [fecha, registroId] = key.split("_");
      // Determina si viene de data o de registrofechas
      const origin = dataBranch.some((r) => r.id === registroId)
        ? "data"
        : "registrofechas";
      const path =
        origin === "data"
          ? `data/${registroId}`
          : `registrofechas/${fecha}/${registroId}`;

      // Actualiza solo el campo factura
      await update(ref(database, path), { factura: true });
      // Opcional: refleja el cambio en el estado local
      handleFieldChange(fecha, registroId, "factura", true, origin);
    }

    // 3) Limpia la selección y cierra el loading
    setSelectedRows({});
    Swal.close();
    Swal.fire({
      icon: "success",
      title: "Facturas emitidas correctamente",
      text: "Todas las facturas seleccionadas han sido emitidas.",
      confirmButtonText: "Genial",
    });
  };

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
        <h2>Filtros</h2>
        <label>Rango de Fechas</label>
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
              factura: "",
              fechaInicio: null,
              fechaFin: null,
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
                <th>Fecha</th>
                <th>Realizado Por</th>
                <th>A Nombre De</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Servicio</th>
                <th>Cúbicos</th>
                <th>Valor</th>
                <th>Pago</th>
                <th>Forma De Pago</th>
                <th>Banco</th>
                <th style={{ backgroundColor: "#6200ffb4" }}>Notas</th>
                <th style={{ backgroundColor: "#6200ffb4" }}>Método De Pago</th>
                <th style={{ backgroundColor: "#6200ffb4" }}>Efectivo</th>
                <th style={{ backgroundColor: "#00ad00" }}>Emitir</th>
                <th style={{ backgroundColor: "#00ad00" }}>Factura</th>
                <th style={{ backgroundColor: "#00ad00" }}>Pago</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <React.Fragment key={item.fecha}>
                  {item.registros.map((registro) => (
                    <tr key={`${registro.origin}_${item.fecha}_${registro.id}`}>
                      <td
                        style={{
                          minWidth: "75px",
                          textAlign: "center",
                          fontWeight: "bold",
                        }}
                      >
                        {item.fecha}
                      </td>
                      <td>
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
                        >
                          <option value=""></option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          style={{ width: "16ch" }}
                          type="text"
                          value={registro.anombrede || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              "anombrede",
                              e.target.value,
                              registro.origin
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
                            value={registro.direccion || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                item.fecha,
                                registro.id,
                                "direccion",
                                e.target.value,
                                registro.origin
                              )
                            }
                            list={`direccion-options-${registro.id}`}
                          />
                          {/* <datalist id={`direccion-options-${registro.id}`}>
                              {clients.map((client, index) => (
                                <option key={index} value={client.direccion}>
                                  {client.direccion}
                                </option>
                              ))}
                            </datalist> */}
                        </div>
                      </td>
                      <td>
                        <select
                          value={registro.servicio || ""}
                          style={{ width: "18ch" }}
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
                          value={registro.cubicos || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              "cubicos",
                              e.target.value,
                              registro.origin
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ width: "10ch" }}
                          value={registro.valor || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              "valor",
                              e.target.value,
                              registro.origin
                            )
                          }
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
                          style={{ width: "18ch" }}
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
                          value={registro.efectivo || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              item.fecha,
                              registro.id,
                              "efectivo",
                              e.target.value,
                              registro.origin
                            )
                          }
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
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
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
    </div>
  );
};

export default Hojadefechas;
