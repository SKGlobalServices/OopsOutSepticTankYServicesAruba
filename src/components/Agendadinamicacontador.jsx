import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, onValue } from "firebase/database";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Slidebarcontador from "./Slidebarcontador";
import Clock from "./Clock";
import Swal from "sweetalert2";
import filtericon from "../assets/img/filters_icon.jpg";
import excel_icon from "../assets/img/excel_icon.jpg";
import pdf_icon from "../assets/img/pdf_icon.jpg";
import Select from "react-select";
import { ToggleButtonGroup } from "react-bootstrap";

const Agendadinamicacontador = () => {
  // Estados para los datos:
  const [dataRegistroFechas, setDataRegistroFechas] = useState([]);
  const [dataBranch, setDataBranch] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
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
    formadepago: [],
    metododepago: [],
    efectivo: [],
    factura: "",
    fechaInicio: null,
    fechaFin: null,
    item: [],
    descripcion: "",
    qtyMin: "",
    qtyMax: "",
    rateMin: "",
    rateMax: "",
    amountMin: "",
    amountMax: "",
  });

  // Selección de filas
  const [selectedRows, setSelectedRows] = useState({});
  const [selectAll, setSelectAll] = useState(false);

  // Cargar datos de la rama "registrofechas"
  useEffect(() => {
    const dbRef = ref(database, "registrofechas");
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
        // Se ordena por fecha (convertida a Date) de forma descendente
        formattedData.sort((a, b) => {
          const [dayA, monthA, yearA] = a.fecha.split("-");
          const [dayB, monthB, yearB] = b.fecha.split("-");
          const dateA = new Date(yearA, monthA - 1, dayA);
          const dateB = new Date(yearB, monthB - 1, dayB);
          return dateB - dateA;
        });
        setDataRegistroFechas(formattedData);
      } else {
        setDataRegistroFechas([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Cargar datos de la rama "data"
  useEffect(() => {
    const dbRef = ref(database, "data");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const dataVal = snapshot.val();
        const dataList = Object.entries(dataVal).map(([id, record]) => {
          // Para cada registro de la rama "data" se asigna la fecha de hoy,
          // independientemente del timestamp almacenado
          const today = new Date();
          const day = ("0" + today.getDate()).slice(-2);
          const month = ("0" + (today.getMonth() + 1)).slice(-2);
          const year = today.getFullYear();
          const fecha = `${day}-${month}-${year}`;

          return { id, ...record, fecha };
        });
        // Ordena la lista de datos de forma descendente por el campo timestamp
        dataList.sort((a, b) => b.timestamp - a.timestamp);
        setDataBranch(dataList);
      } else {
        setDataBranch([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Cargar usuarios
  useEffect(() => {
    const dbRef = ref(database, "users");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedUsers = Object.entries(snapshot.val())
          .filter(([_, user]) => user.role !== "admin")
          .filter(([_, user]) => user.role !== "contador")
          .map(([id, user]) => ({ id, name: user.name }));
        fetchedUsers.sort((a, b) => a.name.localeCompare(b.name));
        setUsers(fetchedUsers);
      } else {
        setUsers([]);
      }
    });
    return () => unsubscribe();
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
      } else {
        setClients([]);
      }
    });
    return () => unsubscribe();
  }, []);

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

  // —————————————————————————————
  // 1) APLANA TODOS LOS REGISTROS EN UN ARRAY PLANO
  const vivos = dataBranch.map((r) => ({ ...r, fecha: r.fecha }));
  const historicos = dataRegistroFechas.flatMap((grupo) =>
    grupo.registros.map((r) => ({ ...r, fecha: grupo.fecha }))
  );
  const todos = [...vivos, ...historicos];

  const itemOptions = Array.from(
    new Set(
      // extrae todos los valores de `item` (que no sean falsy)
      todos.map((r) => r.item).filter(Boolean)
    )
  ).map((v) => ({ value: v, label: v }));

  // 2) FILTRA ESE ARRAY
  const filtrados = todos.filter((registro) => {
    // Rango de fechas
    if (filters.fechaInicio && filters.fechaFin) {
      const [d, m, y] = registro.fecha.split("-");
      const f = new Date(y, m - 1, d);
      if (f < filters.fechaInicio || f > filters.fechaFin) return false;
    }
    // Función de match
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
    if (!match(filters.metododepago, "metododepago")) return false;
    if (!match(filters.efectivo, "efectivo", true)) return false;
    // Factura
    if (
      filters.factura !== "" &&
      Boolean(registro.factura) !== (filters.factura === "true")
    )
      return false;
    // ITEM
    if (
      filters.item.length &&
      !filters.item.some((o) => o.value === registro.item)
    )
      return false;
    // DESCRIPCIÓN (substring)
    if (
      filters.descripcion &&
      !registro.descripcion
        ?.toLowerCase()
        .includes(filters.descripcion.toLowerCase())
    )
      return false;
    // QTY rango numérico
    const qty = parseFloat(registro.qty) || 0;
    if (filters.qtyMin && qty < parseFloat(filters.qtyMin)) return false;
    if (filters.qtyMax && qty > parseFloat(filters.qtyMax)) return false;
    // RATE rango numérico
    const rate = parseFloat(registro.rate) || 0;
    if (filters.rateMin && rate < parseFloat(filters.rateMin)) return false;
    if (filters.rateMax && rate > parseFloat(filters.rateMax)) return false;
    // AMOUNT rango numérico
    const amount = parseFloat(registro.amount) || 0;
    if (filters.amountMin && amount < parseFloat(filters.amountMin))
      return false;
    if (filters.amountMax && amount > parseFloat(filters.amountMax))
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

  // Gestión de colores para trabajadores
  const [workerColors, setWorkerColors] = useState({});
  useEffect(() => {
    const dbRefColors = ref(database, "workerColors");
    onValue(dbRefColors, (snapshot) => {
      if (snapshot.exists()) {
        setWorkerColors(snapshot.val());
      }
    });
  }, []);

  const predefinedColors = [
    "#FF5733",
    "#33FF57",
    "#3357FF",
    "#FF33A1",
    "#FFD700",
    "#800080",
    "#FF4500",
    "#2E8B57",
    "#1E90FF",
    "#DC143C",
    "#00FA9A",
    "#8A2BE2",
    "#FF8C00",
    "#228B22",
    "#DAA520",
    "#9932CC",
    "#FF1493",
    "#FF6347",
    "#40E0D0",
    "#ADFF2F",
    "#BA55D3",
    "#00CED1",
    "#3CB371",
    "#FF00FF",
    "#7FFF00",
    "#B22222",
    "#20B2AA",
    "#6B8E23",
    "#FFA07A",
    "#8B0000",
    "#00BFFF",
    "#4682B4",
    "#32CD32",
    "#A52A2A",
    "#9400D3",
    "#7B68EE",
    "#5F9EA0",
    "#FF69B4",
    "#9ACD32",
    "#E9967A",
    "#6495ED",
    "#8B4513",
    "#FA8072",
    "#B0C4DE",
    "#D2691E",
    "#FFDEAD",
    "#F08080",
    "#FFDAB9",
    "#98FB98",
    "#DDA0DD",
  ];

  const getWorkerColor = (userId) => {
    if (!userId) return "#f9f9f9";
    if (workerColors[userId]) return workerColors[userId];

    const dbRefWorker = ref(database, `workerColors/${userId}`);
    onValue(
      dbRefWorker,
      (snapshot) => {
        if (snapshot.exists()) {
          const savedColor = snapshot.val();
          setWorkerColors((prevColors) => ({
            ...prevColors,
            [userId]: savedColor,
          }));
        } else {
          const availableColors = predefinedColors.filter(
            (color) => !Object.values(workerColors).includes(color)
          );
          const newColor =
            availableColors.length > 0
              ? availableColors[
                  Math.floor(Math.random() * availableColors.length)
                ]
              : predefinedColors[
                  Math.floor(Math.random() * predefinedColors.length)
                ];
          setWorkerColors((prevColors) => ({
            ...prevColors,
            [userId]: newColor,
          }));
          set(dbRefWorker, newColor).catch((error) => {
            console.error("Error saving color to Firebase: ", error);
          });
        }
      },
      { onlyOnce: true }
    );
    return workerColors[userId] || "#f9f9f9";
  };

  const getPagoColor = (pago) => {
    switch (pago) {
      case "Debe":
        return "red";
      case "Pago":
        return "green";
      case "Pendiente":
      case "Pendiente Fin De Mes":
        return "yellow";
      default:
        return "transparent";
    }
  };

  const getMetodoPagoColor = (metododepago) => {
    if (metododepago === "efectivo") return "purple";
    if (metododepago === "cancelado") return "red";
    if (metododepago === "credito") return "green";
    return "transparent";
  };

  const getUserName = (userId) => {
    const found = users.find((u) => u.id === userId);
    return found ? found.name : "";
  };

  // Función para editar descripción con Swal
  const handleDescriptionClick = (fecha, registroId, currentDesc) => {
    Swal.fire({
      title: "Descripción",
      input: "textarea",
      inputValue: currentDesc || "",
      inputAttributes: {
        readOnly: true,
      },
      showCancelButton: false,
      confirmButtonText: "Cerrar",
    });
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
        "Forma De Pago": registro.formadepago || "",
        Notas: registro.notas || "",
        "Método de Pago": registro.metododepago || "",
        Efectivo: registro.efectivo || "",
        Item: registro.item || "",
        Descripción: registro.descripcion || "",
        Qty: registro.qty != null ? registro.qty : "",
        Rate: registro.rate != null ? Number(registro.rate).toFixed(2) : "",
        Amount:
          registro.amount != null ? Number(registro.amount).toFixed(2) : "",
        Factura: registro.factura ? "Sí" : "No",
      }))
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Servicios");

    // Encabezados
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
      "Notas",
      "Método de Pago",
      "Efectivo",
      "Item",
      "Descripción",
      "Qty",
      "Rate",
      "Amount",
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

    // Ajuste de anchos (puedes tweakear estas medidas)
    worksheet.columns = [
      { width: 12 }, // Fecha
      { width: 20 }, // Realizado Por
      { width: 20 }, // A Nombre De
      { width: 30 }, // Dirección
      { width: 18 }, // Servicio
      { width: 12 }, // Cúbicos
      { width: 12 }, // Valor
      { width: 16 }, // Pago
      { width: 18 }, // Forma De Pago
      { width: 15 }, // Notas
      { width: 18 }, // Método de Pago
      { width: 12 }, // Efectivo
      { width: 12 }, // Item
      { width: 40 }, // Descripción
      { width: 8 }, // Qty
      { width: 10 }, // Rate
      { width: 10 }, // Amount
      { width: 8 }, // Factura
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

    // Descargar
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

    // Cabecera de tabla
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
        "Notas",
        "Método de Pago",
        "Efectivo",
        "Item",
        "Descripción",
        "Qty",
        "Rate",
        "Amount",
        "Factura",
      ],
    ];

    // Filas
    const dataRows = filteredData.flatMap((item) =>
      item.registros.map((registro) => [
        item.fecha,
        getUserName(registro.realizadopor) || "",
        registro.anombrede || "",
        registro.direccion || "",
        registro.servicio || "",
        registro.cubicos || "",
        registro.valor || "",
        registro.pago || "",
        registro.formadepago || "",
        registro.notas || "",
        registro.metododepago || "",
        registro.efectivo || "",
        registro.item || "",
        registro.descripcion || "",
        registro.qty != null ? registro.qty.toString() : "",
        registro.rate != null ? registro.rate.toFixed(2) : "",
        registro.amount != null ? registro.amount.toFixed(2) : "",
        registro.factura ? "Sí" : "No",
      ])
    );

    autoTable(doc, {
      head: headers,
      body: dataRows,
      startY: 30,
      theme: "grid",
      headStyles: { fillColor: [79, 129, 189], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
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

  return (
    <div className="homepage-container">
      <Slidebarcontador />
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
          value={realizadoporOptions.filter((opt) =>
            filters.realizadopor.some((sel) => sel.value === opt.value)
          )}
          placeholder="Usuario(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              realizadopor: opts || [],
            }))
          }
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
                <th>Dirección</th>
                <th>Servicio</th>
                <th>Cúbicos</th>
                <th>Valor</th>
                <th>Pago</th>
                <th>Forma De Pago</th>
                <th style={{ backgroundColor: "#6200ffb4" }}>Notas</th>
                <th style={{ backgroundColor: "#6200ffb4" }}>Método De Pago</th>
                <th style={{ backgroundColor: "#6200ffb4" }}>Efectivo</th>
                <th style={{ backgroundColor: "#00ad00" }}>ITEM</th>
                <th style={{ backgroundColor: "#00ad00" }}>DESCRIPCIÓN</th>
                <th style={{ backgroundColor: "#00ad00" }}>QTY</th>
                <th style={{ backgroundColor: "#00ad00" }}>RATE</th>
                <th style={{ backgroundColor: "#00ad00" }}>AMOUNT</th>
                <th style={{ backgroundColor: "#00ad00" }}>Factura</th>
                <th style={{ backgroundColor: "#00ad00" }}>Pago</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length ? (
                filteredData.map((item) => (
                  <React.Fragment key={item.fecha}>
                    {item.registros.map((r) => (
                      <tr key={r.id}>
                        <td
                          style={{
                            minWidth: "75px",
                            textAlign: "center",
                            fontWeight: "bold",
                            padding: "5px",
                          }}
                        >
                          {item.fecha}
                        </td>
                        <td
                          style={{
                            backgroundColor: getWorkerColor(r.realizadopor),
                            padding: "5px",
                          }}
                        >
                          {getUserName(r.realizadopor)}
                        </td>
                        <td style={{ padding: "5px" }}>{r.anombrede || ""}</td>
                        <td style={{ padding: "5px" }}>{r.direccion || ""}</td>
                        <td style={{ padding: "5px" }}>{r.servicio || ""}</td>
                        <td style={{ textAlign: "center", padding: "5px" }}>
                          {r.cubicos || ""}
                        </td>
                        <td style={{ textAlign: "center", padding: "5px" }}>
                          {r.valor || ""}
                        </td>
                        <td
                          style={{
                            backgroundColor: getPagoColor(r.pago),
                            padding: "5px",
                          }}
                        >
                          {r.pago || ""}
                        </td>
                        <td style={{ padding: "5px" }}>
                          {r.formadepago || ""}
                        </td>
                        <td style={{ padding: "5px" }}>{r.notas || ""}</td>
                        <td
                          style={{
                            backgroundColor: getMetodoPagoColor(r.metododepago),
                            textAlign: "center",
                            padding: "5px",
                          }}
                        >
                          {r.metododepago || ""}
                        </td>
                        <td style={{ textAlign: "center", padding: "5px" }}>
                          {r.efectivo || ""}
                        </td>
                        <td style={{ textAlign: "center", padding: "5px" }}>
                          {r.item || ""}
                        </td>
                        {/* Reemplaza tu <td style={{ padding: "5px" }}>…</td> por este: */}
                        <td
                          style={{
                            display: "flex",
                            alignItems: "center",
                            maxWidth: "60ch",
                            paddingTop: "1px",
                            paddingBottom: "2px",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              background: "#f5f5f5",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                            }}
                          >
                            {r.descripcion || ""}
                          </p>
                          <button
                            style={{
                              border: "none",
                              backgroundColor: "#5271ff",
                              borderRadius: "5px",
                              color: "white",
                              padding: "3px",
                              margin: "3px",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              handleDescriptionClick(
                                item.fecha,
                                r.id,
                                r.descripcion
                              )
                            }
                          >
                            Ver
                          </button>
                        </td>

                        <td style={{ textAlign: "center", padding: "5px" }}>
                          {r.qty != null ? r.qty : ""}
                        </td>
                        <td style={{ textAlign: "center", padding: "5px" }}>
                          {r.rate != null ? Number(r.rate).toFixed(2) : ""}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            fontWeight: "bold",
                            padding: "5px",
                          }}
                        >
                          {r.amount != null
                            ? Number(r.amount).toFixed(2)
                            : "0.00"}
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={r.factura ? "Sí" : "No"}
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
                            checked={r.pago === "Pago"}
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
      <button className="generate-button1" onClick={generateXLSX}>
        <img className="generate-button-imagen1" src={excel_icon} alt="Excel" />
      </button>
      <button className="generate-button2" onClick={generatePDF}>
        <img className="generate-button-imagen2" src={pdf_icon} alt="PDF" />
      </button>
    </div>
  );
};

export default Agendadinamicacontador;
