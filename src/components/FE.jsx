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
import pdf_icon from "../assets/img/pdf_icon.jpg";
import guardarfactura from "../assets/img/guardarfactura_icon.jpg";
import Select from "react-select";
import logotipo from "../assets/img/logo.png";

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
    item: [],
    factura: "",
    descripcion: "",
    qtyMin: "",
    qtyMax: "",
    rateMin: "",
    rateMax: "",
    amountMin: "",
    amountMax: "",
    fechaInicio: null,
    fechaFin: null,
    fechaPagoInicio: null,
    fechaPagoFin: null,
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
  // AQUÍ: OPCIONES DE ITEM PARA EL FILTRO
  const itemOptions = Array.from(
    new Set(
      // extrae todos los valores de `item` (que no sean falsy)
      todos.map((r) => r.item).filter(Boolean)
    )
  ).map((v) => ({ value: v, label: v }));

  // 2) FILTRA ESE ARRAY
  const filtrados = todos.filter((registro) => {
    // 0) Filtro por rango de fecha de pago
    if (filters.fechaPagoInicio && filters.fechaPagoFin) {
      if (!registro.fechapago) return false;
      const pagoDate = new Date(registro.fechapago); // asumiendo "YYYY-MM-DD"
      if (pagoDate < filters.fechaPagoInicio || pagoDate > filters.fechaPagoFin)
        return false;
    }
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

    // 3) Factura sí/no
    if (
      filters.factura !== "" &&
      Boolean(registro.factura) !== (filters.factura === "true")
    )
      return false;

    // 4) ITEM
    if (
      filters.item.length &&
      !filters.item.some((o) => o.value === registro.item)
    )
      return false;

    // 5) DESCRIPCIÓN (subcadena, case-insensitive)
    if (
      filters.descripcion &&
      !registro.descripcion
        ?.toLowerCase()
        .includes(filters.descripcion.toLowerCase())
    )
      return false;

    // 6) QTY (rango numérico)
    const qty = parseFloat(registro.qty) || 0;
    if (filters.qtyMin && qty < parseFloat(filters.qtyMin)) return false;
    if (filters.qtyMax && qty > parseFloat(filters.qtyMax)) return false;

    // 7) RATE (rango numérico)
    const rate = parseFloat(registro.rate) || 0;
    if (filters.rateMin && rate < parseFloat(filters.rateMin)) return false;
    if (filters.rateMax && rate > parseFloat(filters.rateMax)) return false;

    // 8) AMOUNT (rango numérico)
    const amount = parseFloat(registro.amount) || 0;
    if (filters.amountMin && amount < parseFloat(filters.amountMin))
      return false;
    if (filters.amountMax && amount > parseFloat(filters.amountMax))
      return false;

    // Si pasa todos los filtros, lo incluimos
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
        Item: registro.item || "",
        Descripción: registro.descripcion || "",
        Qty: registro.qty != null ? registro.qty : "",
        Rate:
          registro.rate != null
            ? (parseFloat(registro.rate) || 0).toFixed(2)
            : "",
        Amount:
          registro.amount != null
            ? (parseFloat(registro.amount) || 0).toFixed(2)
            : "",
        Factura: registro.factura ? "Sí" : "No",
        "Fecha De Pago": registro.fechapago || "",
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
      "Item",
      "Descripción",
      "Qty",
      "Rate",
      "Amount",
      "Factura",
      "Fecha De Pago",
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

  // EXPORTAR PDF
  const generatePDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(16);
    doc.text("Servicios", 105, 20, { align: "center" });
    doc.setFontSize(10);

    const headers = [
      [
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
        "Item",
        "Descripción",
        "Qty",
        "Rate",
        "Amount",
        "Factura",
        "Fecha De Pago",
      ],
    ];

    const dataRows = filteredData.flatMap((item) =>
      item.registros.map((registro) => {
        const rateNum = parseFloat(registro.rate) || 0;
        const amountNum = parseFloat(registro.amount) || 0;
        return [
          item.fecha,
          getUserName(registro.realizadopor) || "",
          registro.anombrede || "",
          registro.direccion || "",
          registro.servicio || "",
          registro.cubicos || "",
          registro.valor || "",
          registro.pago === "Pago" ? "Sí" : "No",
          registro.formadepago || "",
          registro.banco || "",
          registro.notas || "",
          registro.metododepago || "",
          registro.efectivo || "",
          registro.item || "",
          registro.descripcion || "",
          registro.qty != null ? registro.qty.toString() : "",
          rateNum.toFixed(2),
          amountNum.toFixed(2),
          registro.factura ? "Sí" : "No",
          registro.fechapago || "",
        ];
      })
    );

    autoTable(doc, {
      head: headers,
      body: dataRows,
      startY: 30,
      theme: "grid",
      headStyles: { fillColor: [79, 129, 189], textColor: [255, 255, 255] },
      styles: {
        fontSize: 8,
        overflow: "linebreak", // permite el wrapping
      },
      columnStyles: {
        // índice 14 = columna "Descripción" (empezando en 0)
        14: {
          cellWidth: 50, // ancho máximo en mm
          overflow: "linebreak", // asegurarse de que wrappee
        },
      },
      margin: { top: 30, left: 10, right: 10 },
    });

    doc.save("Servicios.pdf");
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

  // Función auxiliar: genera y guarda el PDF usando los datos que ya calculaste.
  const generarPDFconDatos = async ({
    filas,
    totalAmount,
    billToValue,
    numeroFactura,
    pagoStatus,
  }) => {
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

    // — Cabecera con número y fecha —
    pdf
      .setFontSize(12)
      .text(`INVOICE NO: ${invoiceId}`, 160, mT + 35)
      .text(`DATE: ${today.toLocaleDateString()}`, 160, mT + 40);

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
    const afterY = pdf.lastAutoTable.finalY + 8;
    // — Total —
    // PAYMENT siempre es el totalAmount
    pdf
      .setFontSize(10)
      .text(`PAYMENT: AWG${totalAmount.toFixed(2)}`, 160, afterY);

    // BALANCE DUE únicamente se pone en 0 si pagoStatus === "Pago"
    const balance = pagoStatus === "Pago" ? 0 : totalAmount;
    pdf
      .setFontSize(10)
      .text(`BALANCE DUE: AWG${balance.toFixed(2)}`, 160, afterY + 6);

    // — Bank Info y footer —
    const bankY = afterY;
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

    // — Marca de agua PAID (si aplica) —
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
    }

    pdf.save(`Invoice-${invoiceId}.pdf`);
  };

  const generateAndMaybeEmitFactura = async () => {
    // 1) Validar selección
    if (!Object.values(selectedRows).some(Boolean)) {
      return Swal.fire({
        title: "No hay registros seleccionados",
        text: "Selecciona al menos un registro para generar la factura.",
        icon: "warning",
        confirmButtonText: "Aceptar",
      });
    }

    // 2) Pedir Bill To…
    const { value: billToResult } = await Swal.fire({
      title: "Bill To:",
      html: `
      <select id="bill-to-type" class="swal2-select" style="width:75%">
        <option value="" disabled selected>Elija...</option>
        <option value="anombrede">A Nombre De</option>
        <option value="direccion">Dirección</option>
        <option value="personalizado">Personalizado</option>
      </select>
      <input id="bill-to-custom" class="swal2-input" placeholder="Texto personalizado" style="display: none; width: 75%; margin: 6px auto; text-align: center;" />`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const type = document.getElementById("bill-to-type").value;
        const custom = document.getElementById("bill-to-custom").value;
        if (!type) Swal.showValidationMessage("Selecciona un tipo");
        if (type === "personalizado" && !custom)
          Swal.showValidationMessage("Escribe el texto personalizado");
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
    if (!billToResult) return;

    // 3) Extraer registros seleccionados
    const selectedData = filteredData.flatMap((item) =>
      item.registros.filter((r) => selectedRows[`${item.fecha}_${r.id}`])
    );
    const base = selectedData[0] || {};

    // 4) Calcular Bill To
    let billToValue = "";
    switch (billToResult.billToType) {
      case "anombrede":
        billToValue = base.anombrede || "";
        break;
      case "direccion":
        billToValue = base.direccion || "";
        break;
      case "personalizado":
        billToValue = billToResult.customValue;
    }

    // 5) Preparar filas
    const filas = selectedData.map((r) => {
      const rateNum = parseFloat(r.rate) || 0;
      const amountNum = parseFloat(r.amount) || 0;
      return [
        r.fecha,
        r.item || "",
        r.descripcion || "",
        r.qty != null ? r.qty.toString() : "",
        r.rate != null ? rateNum.toFixed(2) : "",
        r.amount != null ? amountNum.toFixed(2) : "",
      ];
    });

    // 6) Calcular totalAmount sumando los campos 'amount' de los registros seleccionados
    const totalAmount = selectedData.reduce(
      (sum, r) => sum + (parseFloat(r.amount) || 0),
      0
    );

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
      await emitirFacturasSeleccionadas();
      // 9a) Cuando terminen de emitir, generar el PDF
      await generarPDFconDatos({
        filas,
        totalAmount,
        billToValue,
        numeroFactura,
        pagoStatus: base.pago,
      });
    } else if (isDenied) {
      // 8b) Si el usuario dice No → generar el PDF sin emitir
      await generarPDFconDatos({
        filas,
        totalAmount,
        billToValue,
        numeroFactura,
        pagoStatus: base.pago,
      });
    }
  };

  // EMITIR FACTURAS SELECCIONADAS
  const emitirFacturasSeleccionadas = async () => {
    const anySelected = Object.values(selectedRows).some(Boolean);
    if (!anySelected) {
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

    for (const [key, isSel] of Object.entries(selectedRows)) {
      if (!isSel) continue;
      const separador = key.indexOf("_");
      const fecha = key.substring(0, separador);
      const registroId = key.substring(separador + 1);
      const item = filteredData.find((i) => i.fecha === fecha);
      const registro = item?.registros.find((r) => r.id === registroId);
      if (!registro) continue;

      // (1) Obtener número, (2) preparar facturaData, (3) push y set, (4) marcar en registro, (5) deseleccionar...
      const contadorRef = ref(database, "contadorFactura");
      const tx = await runTransaction(contadorRef, (curr) => (curr || 0) + 1);
      const numeroFactura = tx.snapshot.val();

      const facturaData = {
        anombrede: registro.anombrede || "",
        cubicos: registro.cubicos ?? "",
        direccion: registro.direccion || "",
        fecha,
        numerodefactura: numeroFactura,
        servicio: registro.servicio || "",
        timestamp: Date.now(),
        valor: registro.valor ?? "",
        item: registro.item || "",
        descripcion: registro.descripcion || "",
        qty: registro.qty != null ? registro.qty : "",
        rate: registro.rate != null ? registro.rate : "",
        amount: registro.amount != null ? registro.amount : "",
        fechapago: registro.fechapago || "",
      };
      if (registro.pago === "Pago") facturaData.pago = true;

      const factRef = push(ref(database, "facturasemitidas"));
      await set(factRef, facturaData);

      const esData = dataBranch.some((d) => d.id === registroId);
      const path = esData
        ? `data/${registroId}`
        : `registrofechas/${fecha}/${registroId}`;
      await update(ref(database, path), { factura: true });
      handleFieldChange(fecha, registroId, "factura", true);

      setSelectedRows((prev) => ({ ...prev, [key]: false }));
    }

    // Devuelve esta promesa para hacer `await emitirFacturasSeleccionadas()`
    return Swal.fire({
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
        <label>Rango Fecha de Pago</label>
        <button
          onClick={() => setShowPagoDatePicker(!showPagoDatePicker)}
          className="filter-button"
        >
          {showPagoDatePicker
            ? "Ocultar selector de Fecha de Pago"
            : "Filtrar por Fecha de Pago"}
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
        <label>Item</label>
        <Select
          isClearable
          isMulti
          options={itemOptions}
          value={filters.item}
          onChange={(opts) => setFilters({ ...filters, item: opts || [] })}
          placeholder="Item(s)..."
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
              item: [],
              factura: "",
              descripcion: "",
              qtyMin: "",
              qtyMax: "",
              rateMin: "",
              rateMax: "",
              amountMin: "",
              amountMax: "",
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
                <th style={{ backgroundColor: "#00ad00" }}>ITEM</th>
                <th style={{ backgroundColor: "#00ad00" }}>DESCRIPCIÓN</th>
                <th style={{ backgroundColor: "#00ad00" }}>QTY</th>
                <th style={{ backgroundColor: "#00ad00" }}>RATE</th>
                <th style={{ backgroundColor: "#00ad00" }}>AMOUNT</th>
                <th style={{ backgroundColor: "#00ad00" }}>Emitir</th>
                <th style={{ backgroundColor: "#00ad00" }}>Factura</th>
                <th style={{ backgroundColor: "#00ad00" }}>Fecha De Pago</th>
                <th style={{ backgroundColor: "#00ad00" }}>Pago</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <React.Fragment key={item.fecha}>
                    {item.registros.map((registro) => (
                      <tr key={registro.id}>
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
                            type="text"
                            style={{
                              width: `${Math.max(
                                registro.anombrede?.length || 1,
                                15
                              )}ch`,
                            }}
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
                              type="text"
                              style={{
                                width: `${Math.max(
                                  registro.direccion?.length || 1,
                                  15
                                )}ch`,
                              }}
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
                            <option value="Poso + Tuberia">
                              Poso + Tuberia
                            </option>
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
                          <input
                            type="text"
                            style={{
                              width: `${Math.max(
                                registro.notas?.length || 1,
                                15
                              )}ch`,
                            }}
                            value={registro.notas || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                item.fecha,
                                registro.id,
                                "notas",
                                e.target.value,
                                registro.origin
                              )
                            }
                          />
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
                          <select
                            value={registro.item || ""}
                            style={{ width: "28ch" }}
                            onChange={(e) =>
                              handleItemSelect(
                                item.fecha,
                                registro.id,
                                e.target.value
                              )
                            }
                          >
                            <option value=""></option>
                            <option value="Septic Tank">Septic Tank</option>
                            <option value="Pipes Cleaning">
                              Pipes Cleaning
                            </option>
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
                            style={{
                              border: "none",
                              backgroundColor: "transparent",
                              borderRadius: "0.25em",
                              color: "black",
                              padding: "0.2em 0.5em",
                              cursor: "pointer",
                              fontSize: "1em",
                              maxWidth: "100%",
                              alignSelf: "center",
                            }}
                            onClick={() =>
                              handleDescriptionClick(
                                item.fecha,
                                registro.id,
                                registro.descripcion
                              )
                            }
                          >
                            {registro.descripcion ? (
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
                                {registro.descripcion || ""}
                              </p>
                            ) : (
                              "ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ"
                            )}
                          </button>
                        </td>

                        <td>
                          <input
                            type="number"
                            step="1"
                            style={{ width: "6ch" }}
                            value={registro.qty || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                item.fecha,
                                registro.id,
                                "qty",
                                e.target.value,
                                registro.origin
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            style={{ width: "10ch" }}
                            value={
                              registro.rate != null
                                ? parseFloat(registro.rate).toFixed(2)
                                : ""
                            }
                            onChange={(e) =>
                              handleRateChange(
                                item.fecha,
                                registro.id,
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>
                          {registro.amount != null
                            ? parseFloat(registro.amount).toFixed(2)
                            : "0.00"}
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
                            type="date"
                            value={registro.fechapago || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                item.fecha,
                                registro.id,
                                "fechapago",
                                e.target.value,
                                registro.origin
                              )
                            }
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
                ))
              ) : (
                <tr>
                  <td colSpan="14">No hay datos disponibles.</td>
                </tr>
              )}
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
      <button className="generate-button1" onClick={generateXLSX}>
        <img className="generate-button-imagen1" src={excel_icon} alt="Excel" />
      </button>
      <button className="generate-button2" onClick={generatePDF}>
        <img className="generate-button-imagen2" src={pdf_icon} alt="PDF" />
      </button>
    </div>
  );
};

export default Hojadefechas;
