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
import FacturaViewEditTra from "./FacturaViewEditTra";

// Función auxiliar para formatear números
const formatCurrency = (amount) => {
  return Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const Informedetransferencias = () => {
  const navigate = useNavigate();

  // CSS embebido para mejoras móviles
  const mobileStyles = `
    /* Media Queries - Estilos para móviles (768px y menos) */
    @media (max-width: 768px) {
      /* Inputs y Selects más grandes en móviles */
      .filter-slidebar input, .filter-slidebar select {
        font-size: 13px !important;
        padding: 6px 8px;
        min-height: 32px;
      }

      /* Botones más grandes en móviles */
      .filter-button, .discard-filter-button {
        font-size: 13px;
        padding: 6px 12px;
        min-height: 32px;
      }

      .generate-button1, .generate-button2 {
        width: 55px;
        height: 55px;
      }

      .numero-factura-btn {
        font-size: 13px !important;
        padding: 4px 8px !important;
        min-height: 30px;
      }

      /* Texto de párrafos más grande */
      p {
        font-size: 13px !important;
      }

      /* Labels más grandes */
      label {
        font-size: 13px;
      }

      /* Headers de tabla más grandes */
      .service-table th {
        font-size: 13px !important;
        padding: 6px 4px;
      }

      /* Contenido de celdas de tabla */
      .service-table td {
        font-size: 13px !important;
        padding: 4px 3px;
      }

      /* Controles de paginación más grandes */
      .pagination-info span {
        font-size: 13px;
      }

      .pagination-controls button {
        font-size: 13px;
        padding: 4px 8px;
        min-height: 32px;
      }

      .pagination-controls span {
        font-size: 13px;
        padding: 4px 10px;
      }

      .items-per-page label,
      .items-per-page span {
        font-size: 13px;
      }

      .items-per-page select {
        font-size: 13px;
        padding: 6px 8px;
        min-height: 32px;
      }

      /* Filtros en slidebar */
      .filter-slidebar h2 {
        font-size: 16px;
      }

      .filter-slidebar label {
        font-size: 13px;
      }

      /* Asegurar que todos los elementos de tabla sean legibles */
      .service-table {
        font-size: 13px;
      }

      /* React-Select components */
      .css-1s2u09g-control,
      .css-1pahdxg-control {
        min-height: 32px !important;
        font-size: 13px !important;
      }

      .css-1wa3eu0-placeholder,
      .css-1dimb5e-singleValue {
        font-size: 13px !important;
      }

      /* DatePicker */
      .react-datepicker {
        font-size: 13px !important;
      }

      .react-datepicker__day,
      .react-datepicker__day-name,
      .react-datepicker__current-month {
        font-size: 13px !important;
      }

      /* Summary cards */
      .homepage-card div[style*="display: flex"] div {
        font-size: 13px !important;
      }

      .homepage-card div[style*="display: flex"] div p {
        font-size: 13px !important;
      }

      /* Title */
      .title-page {
        font-size: 20px !important;
      }

      .current-date {
        font-size: 13px !important;
      }
    }
  `;
  
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

  // UI Estados
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

  // Modal de factura
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [showFacturaModal, setShowFacturaModal] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtros
  const [filters, setFilters] = useState({
    direccion: [],
    valor: [],
    banco: [],
    numerodefactura: "",
    fechaInicio: null,
    fechaFin: null,
  });

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

  // Filtrar solo transferencias
  const transferencias = todos.filter((registro) => {
    // Solo mostrar registros con formadepago = "Transferencia"
    if (registro.formadepago !== "Transferencia") return false;

    // Aplicar filtros adicionales
    if (filters.fechaInicio && filters.fechaFin) {
      const [d, m, y] = registro.fecha.split("-");
      const f = new Date(y, m - 1, d);
      if (f < filters.fechaInicio || f > filters.fechaFin) return false;
    }

    const match = (arr, field) =>
      !arr.length ||
      arr.some((opt) => {
        const val = (registro[field] ?? "").toString().toLowerCase();
        const optValue = (opt.value ?? "").toString().toLowerCase();
        return val === optValue;
      });

    if (!match(filters.direccion, "direccion")) return false;
    if (!match(filters.valor, "valor")) return false;
    if (!match(filters.banco, "banco")) return false;

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
  const grouped = transferencias.reduce((acc, r) => {
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
  const allTransferencias = transferencias;

  const direccionOptions = [
    ...Array.from(
      new Set(allTransferencias.map((r) => r.direccion).filter(Boolean))
    )
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  const valorOptions = [
    ...Array.from(
      new Set(allTransferencias.map((r) => r.valor).filter(Boolean))
    )
      .sort((a, b) => a - b)
      .map((v) => ({ value: v.toString(), label: formatCurrency(v) })),
  ];

  const bancoOptions = [
    ...Array.from(
      new Set(allTransferencias.map((r) => r.banco).filter(Boolean))
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
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
        Dirección: registro.direccion || "",
        Valor: registro.valor || "",
        "Forma De Pago": registro.formadepago || "",
        Banco: registro.banco || "",
        "N° Factura": registro.numerodefactura || "",
      }))
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transferencias");

    const headers = [
      "Fecha",
      "Dirección",
      "Valor",
      "Forma De Pago",
      "Banco",
      "N° Factura",
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
      { width: 30 },
      { width: 12 },
      { width: 18 },
      { width: 25 },
      { width: 16 },
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
    a.download = "Informe_Transferencias.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Exportar a PDF
  const generatePDF = () => {
    const exportData = filteredData.flatMap((item) =>
      item.registros.map((registro) => ({
        Fecha: item.fecha,
        Dirección: registro.direccion || "",
        Valor: registro.valor || "",
        "Forma De Pago": registro.formadepago || "",
        Banco: registro.banco || "",
        "N° Factura": registro.numerodefactura || "",
      }))
    );

    const doc = new jsPDF("p", "mm", "a4");
    
    // Título
    doc.setFontSize(16);
    doc.text("Informe de Transferencias", 105, 20, { align: "center" });
    
    // Calcular sumas por banco
    const totalGeneral = transferencias.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    const totalAruba = transferencias.filter((r) => r.banco === "Aruba Bank N.V.").reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    const totalCaribbean = transferencias.filter((r) => r.banco === "Caribbean Mercantile Bank N.V.").reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    const totalRBC = transferencias.filter((r) => r.banco === "RBC Royal Bank N.V.").reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    
    // Agregar sumas antes de la tabla
    doc.setFontSize(10);
    let yPosition = 35;
    doc.text(`Total General: AWG ${totalGeneral.toFixed(2)}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Aruba Bank N.V.: AWG ${totalAruba.toFixed(2)}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Caribbean Mercantile Bank N.V.: AWG ${totalCaribbean.toFixed(2)}`, 20, yPosition);
    yPosition += 7;
    doc.text(`RBC Royal Bank N.V.: AWG ${totalRBC.toFixed(2)}`, 20, yPosition);
    yPosition += 10;
    
    // Headers de la tabla
    const headers = [[
      "Fecha",
      "Dirección",
      "Valor",
      "Forma De Pago",
      "Banco",
      "N° Factura",
    ]];

    const dataRows = exportData.map((item) => [
      item.Fecha,
      item.Dirección,
      item.Valor,
      item["Forma De Pago"],
      item.Banco,
      item["N° Factura"],
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
    
    doc.save("Informe_Transferencias.pdf");
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
      {/* Inyectar estilos CSS para móviles */}
      <style>{mobileStyles}</style>
      
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
        <h2 style={{color:"white"}}>Filtros</h2>
        <br/>
        <hr/>

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

        <label>Dirección</label>
        <Select
          isClearable
          isMulti
          options={direccionOptions}
          value={filters.direccion}
          onChange={(opts) => setFilters({ ...filters, direccion: opts || [] })}
          placeholder="Dirección(es)..."
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

        <label>Banco</label>
        <Select
          isClearable
          isMulti
          options={bancoOptions}
          value={filters.banco}
          onChange={(opts) => setFilters({ ...filters, banco: opts || [] })}
          placeholder="Banco(s)..."
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
            width: "100%",
          }}
        />

        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              direccion: [],
              valor: [],
              banco: [],
              numerodefactura: "",
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
          <h1 className="title-page">Informe de Transferencias</h1>
          <div className="current-date">
            <div style={{cursor:"default"}}>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{
            border: '1px solid #ddd',
            color:"#fff",
            borderRadius: '6px',
            padding: '8px',
            flex: 1,
            textAlign: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundColor: '#28a745',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.backgroundColor = '#218838';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.backgroundColor = '#28a745';
          }}>
            <p style={{ margin: '0', fontSize: '12px', pointerEvents: 'none', fontWeight: 'bold' }}>Total General</p>
            <p style={{ margin: '0', fontSize: '12px', pointerEvents: 'none', fontWeight: 'bold' }}>AWG {transferencias.reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0).toFixed(2)}</p>
          </div>
          <div style={{
            border: '1px solid #ddd',
            color:"#fff",
            borderRadius: '6px',
            padding: '8px',
            flex: 1,
            textAlign: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundColor: '#5271ff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.backgroundColor = '#375bffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.backgroundColor = '#5271ff';
          }}>
            <p style={{ margin: '0', fontSize: '12px', pointerEvents: 'none', fontWeight: 'bold' }}>Aruba Bank N.V.</p>
            <p style={{ margin: '0', fontSize: '12px', pointerEvents: 'none', fontWeight: 'bold' }}>AWG {transferencias.filter((r) => r.banco === "Aruba Bank N.V.").reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0).toFixed(2)}</p>
          </div>
          <div style={{
            border: '1px solid #ddd',
            color:"#fff",
            borderRadius: '6px',
            padding: '8px',
            flex: 1,
            textAlign: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundColor: '#5271ff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.backgroundColor = '#375bffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.backgroundColor = '#5271ff';
          }}>
            <p style={{ margin: '0', fontSize: '12px', pointerEvents: 'none', fontWeight: 'bold' }}>Caribbean Mercantile Bank N.V.</p>
            <p style={{ margin: '0', fontSize: '12px', pointerEvents: 'none', fontWeight: 'bold' }}>AWG {transferencias.filter((r) => r.banco === "Caribbean Mercantile Bank N.V.").reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0).toFixed(2)}</p>
          </div>
          <div style={{
            border: '1px solid #ddd',
            color:"#fff",
            borderRadius: '6px',
            padding: '8px',
            flex: 1,
            textAlign: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundColor: '#5271ff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.backgroundColor = '#375bffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.backgroundColor = '#5271ff';
          }}>
            <p style={{ margin: '0', fontSize: '12px', pointerEvents: 'none', fontWeight: 'bold' }}>RBC Royal Bank N.V.</p>
            <p style={{ margin: '0', fontSize: '12px', pointerEvents: 'none', fontWeight: 'bold' }}>AWG {transferencias.filter((r) => r.banco === "RBC Royal Bank N.V.").reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0).toFixed(2)}</p>
          </div>
        </div>
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Dirección</th>
                <th>Valor</th>
                <th>Forma De Pago</th>
                <th>Banco</th>
                <th>N° Factura</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <React.Fragment key={item.fecha}>
                  {item.registros.map((registro) => (
                    <tr key={`${registro.origin}_${item.fecha}_${registro.id}`}>
                      <td style={{ textAlign: "center", fontWeight: "bold",padding:"5px", paddingRight:"10px", paddingRight:"10px" }}>
                        {item.fecha}
                      </td>
                      <td style={{paddingRight:"10px",paddingLeft:"10px"}}>{registro.direccion || ""}</td>
                      <td style={{paddingRight:"10px",paddingLeft:"10px", textAlign: "center" }}>
                        {formatCurrency(registro.valor || 0)}
                      </td>
                      <td style={{paddingRight:"10px",paddingLeft:"10px"}}>{registro.formadepago || ""}</td>
                      <td style={{paddingRight:"10px",paddingLeft:"10px"}}>{registro.banco || ""}</td>
                      <td style={{paddingRight:"10px",paddingLeft:"10px", textAlign: "center"}}>
                        {registro.numerodefactura ? (
                          <button
                            onClick={() =>
                              openFacturaModal(registro.numerodefactura)
                            }
                            className="numero-factura-btn"
                            title={`Ver Factura N° ${registro.numerodefactura}`}
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
              {totalItems} transferencias
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

      {/* Modal de Vista/Edición de Factura */}
      {showFacturaModal && selectedFactura && (
        <FacturaViewEditTra
          numeroFactura={selectedFactura}
          onClose={closeFacturaModal}
        />
      )}
    </div>
  );
};

export default React.memo(Informedetransferencias);
