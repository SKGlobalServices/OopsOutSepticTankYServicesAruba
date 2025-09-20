import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { decryptData } from "../utils/security";
import { validateSessionForAction } from "../utils/sessionValidator";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import filtericon from "../assets/img/filters_icon.jpg";
import excel_icon from "../assets/img/excel_icon.jpg";
import pdf_icon from "../assets/img/pdf_icon.jpg";
import Select from "react-select";
// import FacturaViewEditTra from "./FacturaViewEditTra"; (no usado en este informe)

// Función auxiliar para formatear números
const formatCurrency = (amount) => {
  return Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const Informedeserviciosextras = () => {
  const navigate = useNavigate();

  // Verificación de autorización
  useEffect(() => {
    const userData = decryptData(localStorage.getItem("user"));
    if (!userData || userData.role !== "admin") {
      navigate("/");
      return;
    }
  }, [navigate]);

  // Estados de carga
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedRegistro, setLoadedRegistro] = useState(false);
  const [loadedFacturas, setLoadedFacturas] = useState(false);

  // Datos
  const [dataBranch, setDataBranch] = useState([]);
  const [dataRegistroFechas, setDataRegistroFechas] = useState([]);
  const [facturas, setFacturas] = useState({});
  const [todos, setTodos] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadedUsers, setLoadedUsers] = useState(false);

  // UI Estados
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

  // Modal de factura (no usado en este informe)
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [showFacturaModal, setShowFacturaModal] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtros
  const defaultFilters = {
    realizadopor: [],
    anombrede: [],
    servicioextra: [],
    direccion: [],
    servicio: [],
    cubicos: [],
    valor: [],
    pago: [],
    fechaInicio: null,
    fechaFin: null,
  };

  const [filters, setFilters] = useState(defaultFilters);

  // DatePicker
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Cargar datos de "data" con autorización
  useEffect(() => {
    const loadData = async () => {
      const isAuthorized = await validateSessionForAction("cargar datos");
      if (!isAuthorized) return;

      const dbRef = ref(database, "data");
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
          setLoadedData(true);
        }
      });
      return unsubscribe;
    };

    loadData();
  }, []);

  // Cargar datos de "registrofechas"
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
        setLoadedRegistro(true);
      }
    });
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

  // Cargar usuarios (para mostrar nombre en 'Realizado Por')
  useEffect(() => {
    const usersRef = ref(database, "users");
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetched = Object.entries(snapshot.val()).map(([id, u]) => ({
          id,
          ...u,
        }));
        fetched.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setUsers(fetched);
        setLoadedUsers(true);
      } else {
        setUsers([]);
        setLoadedUsers(true);
      }
    });
    return unsubscribeUsers;
  }, []);

  // Cuando todas las fuentes estén listas
  useEffect(() => {
    if (loadedData && loadedRegistro && loadedFacturas) {
      setLoading(false);
    }
  }, [loadedData, loadedRegistro, loadedFacturas]);

  // Combinar y filtrar datos
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

  // Filtrar registros que tengan servicioextra (campo no vacío)
  const serviciosextras = todos.filter((registro) => {
    // Requerir que servicioextra exista y no sea vacío
    if (
      !registro.servicioextra ||
      (registro.servicioextra ?? "").toString().trim() === ""
    )
      return false;

    // Filtrar por rango de fecha si aplica
    if (filters.fechaInicio && filters.fechaFin) {
      const [d, m, y] = registro.fecha.split("-");
      const f = new Date(y, m - 1, d);
      if (f < filters.fechaInicio || f > filters.fechaFin) return false;
    }

    const matchMulti = (arr, field) =>
      !arr.length ||
      arr.some((opt) => {
        const val = (registro[field] ?? "").toString().toLowerCase();
        const optValue = (opt.value ?? "").toString().toLowerCase();
        return val === optValue;
      });

    if (!matchMulti(filters.realizadopor, "realizadopor")) return false;
    if (!matchMulti(filters.anombrede, "anombrede")) return false;
    if (!matchMulti(filters.direccion, "direccion")) return false;
    if (!matchMulti(filters.servicio, "servicio")) return false;
    if (!matchMulti(filters.servicioextra, "servicioextra")) return false;
    if (!matchMulti(filters.cubicos, "cubicos")) return false;
    if (!matchMulti(filters.valor, "valor")) return false;
    if (!matchMulti(filters.pago, "pago")) return false;

    if (
      filters.numerodefactura &&
      !(registro.numerodefactura || "")
        .toLowerCase()
        .includes(filters.numerodefactura.toLowerCase())
    )
      return false;

    return true;
  });

  // Agrupar por fecha
  const grouped = serviciosextras.reduce((acc, r) => {
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

  // Paginación
  const allRecords = filteredData.flatMap((group) => group.registros);
  const totalItems = allRecords.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageRecords = allRecords.slice(startIndex, endIndex);

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

  // Opciones para filtros
  const allServiciosextras = serviciosextras;

  // Índice de users para lookup id -> name
  const usersIndex = new Map(users.map((u) => [u.id, u]));

  const direccionOptions = [
    ...Array.from(
      new Set(allServiciosextras.map((r) => r.direccion).filter(Boolean))
    )
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  const realizadoporOptions = [
    ...Array.from(
      new Set(allServiciosextras.map((r) => r.realizadopor).filter(Boolean))
    )
      .map((id) => ({ value: id, label: usersIndex.get(id)?.name || id }))
      .sort((a, b) => (a.label || "").toString().localeCompare(b.label || "")),
  ];

  const anombredeOptions = [
    ...Array.from(
      new Set(allServiciosextras.map((r) => r.anombrede).filter(Boolean))
    )
      .sort((a, b) => (a || "").toString().localeCompare(b || ""))
      .map((v) => ({ value: v, label: v })),
  ];

  const servicioOptions = [
    ...Array.from(
      new Set(allServiciosextras.map((r) => r.servicio).filter(Boolean))
    )
      .sort((a, b) => (a || "").toString().localeCompare(b || ""))
      .map((v) => ({ value: v, label: v })),
  ];

  const servicioextraOptions = [
    ...Array.from(
      new Set(allServiciosextras.map((r) => r.servicioextra).filter(Boolean))
    )
      .sort((a, b) => (a || "").toString().localeCompare(b || ""))
      .map((v) => ({ value: v, label: v })),
  ];

  const cubicosOptions = [
    ...Array.from(
      new Set(allServiciosextras.map((r) => r.cubicos).filter(Boolean))
    )
      .sort((a, b) => (Number(a) || 0) - (Number(b) || 0))
      .map((v) => ({ value: v.toString(), label: v.toString() })),
  ];

  const pagoOptions = [
    ...Array.from(
      new Set(allServiciosextras.map((r) => r.pago).filter(Boolean))
    )
      .sort((a, b) => (a || "").toString().localeCompare(b || ""))
      .map((v) => ({ value: v, label: v })),
  ];

  const valorOptions = [
    ...Array.from(
      new Set(allServiciosextras.map((r) => r.valor).filter(Boolean))
    )
      .sort((a, b) => a - b)
      .map((v) => ({ value: v.toString(), label: formatCurrency(v) })),
  ];

  // Navegación de páginas
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  // Resetear página cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Manejo de DatePicker
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

  // Exportar a Excel
  const generateXLSX = async () => {
    const exportData = filteredData.flatMap((item) =>
      item.registros.map((registro) => ({
        Fecha: item.fecha,
        "Realizado Por":
          usersIndex.get(registro.realizadopor)?.name ||
          registro.realizadopor ||
          "",
        "A Nombre De": registro.anombrede || "",
        "Servicio Extra": registro.servicioextra || "",
        Dirección: registro.direccion || "",
        Servicio: registro.servicio || "",
        Cúbicos: registro.cubicos || "",
        Valor: registro.valor || "",
        Pago: registro.pago || "",
      }))
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Servicios Extras");

    const headers = [
      "Fecha",
      "Realizado Por",
      "A Nombre De",
      "Servicio Extra",
      "Dirección",
      "Servicio",
      "Cúbicos",
      "Valor",
      "Pago",
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

    worksheet.columns = [
      { width: 12 },
      { width: 20 },
      { width: 20 },
      { width: 30 },
      { width: 20 },
      { width: 8 },
      { width: 12 },
      { width: 12 },
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
    a.download = "Informe_ServiciosExtras.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Exportar a PDF
  const generatePDF = () => {
    const exportData = filteredData.flatMap((item) =>
      item.registros.map((registro) => ({
        Fecha: item.fecha,
        "Realizado Por":
          usersIndex.get(registro.realizadopor)?.name ||
          registro.realizadopor ||
          "",
        "A Nombre De": registro.anombrede || "",
        Dirección: registro.direccion || "",
        Servicio: registro.servicio || "",
        Cúbicos: registro.cubicos || "",
        Valor: registro.valor || "",
        Pago: registro.pago || "",
      }))
    );

    const doc = new jsPDF("p", "mm", "a4");

    // Título
    doc.setFontSize(16);
    doc.text("Informe de Servicios Extras", 105, 20, { align: "center" });

    // Agregar suma Total General antes de la tabla
    const totalGeneral = serviciosextras.reduce(
      (sum, r) => sum + (parseFloat(r.valor) || 0),
      0
    );
    doc.setFontSize(10);
    let yPosition = 35;
    doc.text(`Total General: AWG ${totalGeneral.toFixed(2)}`, 20, yPosition);
    yPosition += 10;

    // Headers de la tabla
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
      ],
    ];

    const dataRows = exportData.map((item) => [
      item.Fecha,
      item["Realizado Por"],
      item["A Nombre De"],
      item.Dirección,
      item.Servicio,
      item["Cúbicos"],
      item.Valor,
      item.Pago,
    ]);

    autoTable(doc, {
      head: headers,
      body: dataRows,
      startY: yPosition,
      theme: "grid",
      headStyles: { fillColor: [79, 129, 189], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      margin: { top: 30, left: 10, right: 10 },
    });

    doc.save("Informe_ServiciosExtras.pdf");
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

  // Función para abrir modal de factura
  const openFacturaModal = (numeroFactura) => {
    setSelectedFactura(numeroFactura);
    setShowFacturaModal(true);
  };

  const closeFacturaModal = () => {
    setSelectedFactura(null);
    setShowFacturaModal(false);
  };

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

        <label>Realizado Por</label>
        <Select
          isClearable
          isMulti
          options={realizadoporOptions}
          value={filters.realizadopor}
          onChange={(opts) =>
            setFilters({ ...filters, realizadopor: opts || [] })
          }
          placeholder="Realizado por..."
        />

        <label>A Nombre De</label>
        <Select
          isClearable
          isMulti
          options={anombredeOptions}
          value={filters.anombrede}
          onChange={(opts) => setFilters({ ...filters, anombrede: opts || [] })}
          placeholder="A nombre de..."
        />

        <label>Servicio Extra</label>
        <Select
          isClearable
          isMulti
          options={servicioextraOptions}
          value={filters.servicioextra}
          onChange={(opts) =>
            setFilters({ ...filters, servicioextra: opts || [] })
          }
          placeholder="Servicio extra..."
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
          placeholder="Cúbicos..."
        />

        <label>Pago</label>
        <Select
          isClearable
          isMulti
          options={pagoOptions}
          value={filters.pago}
          onChange={(opts) => setFilters({ ...filters, pago: opts || [] })}
          placeholder="Pago..."
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

        <button
          className="discard-filter-button"
          onClick={() => {
            setFilters(defaultFilters);
            setCurrentPage(1);
            setShowFilterSlidebar(false);
          }}
        >
          Descartar Filtros
        </button>
      </div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Informe de Servicios Extras</h1>
          <div className="current-date">
            <div style={{ cursor: "default" }}>
              {new Date().toLocaleDateString()}
            </div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              color: "#fff",
              borderRadius: "6px",
              padding: "8px",
              flex: 1,
              textAlign: "center",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              backgroundColor: "#28a745",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.backgroundColor = "#218838";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.backgroundColor = "#28a745";
            }}
          >
            <p
              style={{
                margin: "0",
                fontSize: "12px",
                pointerEvents: "none",
                fontWeight: "bold",
              }}
            >
              Total General Valor
            </p>
            <p
              style={{
                margin: "0",
                fontSize: "12px",
                pointerEvents: "none",
                fontWeight: "bold",
              }}
            >
              AWG{" "}
              {serviciosextras
                .reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0)
                .toFixed(2)}
            </p>
          </div>
        </div>
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Realizado Por</th>
                <th>A Nombre De</th>
                <th>Servicio Extra</th>
                <th>Dirección</th>
                <th>Servicio</th>
                <th>Cúbicos</th>
                <th>Valor</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <React.Fragment key={item.fecha}>
                  {item.registros.map((registro) => (
                    <tr key={`${registro.origin}_${item.fecha}_${registro.id}`}>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          padding: "5px",
                        }}
                      >
                        {item.fecha}
                      </td>
                      <td style={{ paddingRight: "10px", paddingLeft: "10px" }}>
                        {usersIndex.get(registro.realizadopor)?.name ||
                          registro.realizadopor ||
                          ""}
                      </td>
                      <td style={{ paddingRight: "10px", paddingLeft: "10px" }}>
                        {registro.anombrede || ""}
                      </td>
                      <td style={{ paddingRight: "10px", paddingLeft: "10px" }}>
                        {registro.servicioextra || ""}
                      </td>
                      <td style={{ paddingRight: "10px", paddingLeft: "10px" }}>
                        {registro.direccion || ""}
                      </td>
                      <td style={{ paddingRight: "10px", paddingLeft: "10px" }}>
                        {registro.servicio || ""}
                      </td>
                      <td
                        style={{
                          paddingRight: "10px",
                          paddingLeft: "10px",
                          textAlign: "center",
                        }}
                      >
                        {registro.cubicos || ""}
                      </td>
                      <td
                        style={{
                          paddingRight: "10px",
                          paddingLeft: "10px",
                          textAlign: "center",
                        }}
                      >
                        {formatCurrency(registro.valor || 0)}
                      </td>
                      <td style={{ paddingRight: "10px", paddingLeft: "10px" }}>
                        {registro.pago || ""}
                      </td>
                      {/* columna N° Factura removida */}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
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
      </div>

      {/* Botones de exportar */}
      <button className="generate-button1" onClick={generateXLSX}>
        <img className="generate-button-imagen1" src={excel_icon} alt="Excel" />
      </button>
      <button className="generate-button2" onClick={generatePDF}>
        <img className="generate-button-imagen2" src={pdf_icon} alt="PDF" />
      </button>

      {/* Modal de Factura no usado en este informe */}
    </div>
  );
};

export default React.memo(Informedeserviciosextras);
