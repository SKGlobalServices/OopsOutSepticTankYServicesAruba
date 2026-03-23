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

const mobileStyles = `
  @media (max-width: 768px) {
    /* Inputs y selects generales */
    .filter-slidebar input,
    .filter-slidebar select,
    .pagination-container select {
      font-size: 13px !important;
      padding: 4px 6px !important;
      min-height: 30px !important;
    }

    /* Botones */
    .filter-button,
    .discard-filter-button,
    .pagination-controls button,
    .generate-button1,
    .generate-button2 {
      font-size: 13px !important;
      padding: 6px 12px !important;
      min-height: 35px !important;
    }

    /* Labels y texto general */
    .filter-slidebar label,
    .pagination-info span,
    .pagination-info label,
    .service-table th,
    .service-table td {
      font-size: 13px !important;
    }

    /* Headers de tabla */
    .service-table th {
      padding: 8px 4px !important;
      min-width: 80px !important;
    }

    /* Celdas de tabla */
    .service-table td {
      padding: 6px 4px !important;
      font-size: 12px !important;
    }

    /* DatePicker específico */
    .react-datepicker-wrapper input {
      font-size: 13px !important;
      padding: 4px 6px !important;
      min-height: 30px !important;
    }

    .react-datepicker {
      font-size: 13px !important;
    }

    /* Contenedor de paginación */
    .pagination-container {
      flex-direction: column !important;
      gap: 10px !important;
    }

    .pagination-info {
      flex-direction: column !important;
      gap: 8px !important;
      text-align: center !important;
    }

    .items-per-page {
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      gap: 5px !important;
    }

    /* Tarjetas de totales */
    .homepage-card p {
      font-size: 12px !important;
    }

    /* Botones de exportar */
    .generate-button1,
    .generate-button2 {
      width: 45px !important;
      height: 45px !important;
    }

    .generate-button-imagen1,
    .generate-button-imagen2 {
      width: 25px !important;
      height: 25px !important;
    }

    /* Select filters React-Select */
    .filter-slidebar .css-control,
    .filter-slidebar .css-menu {
      font-size: 13px !important;
    }

    /* Título de página */
    .title-page {
      font-size: 18px !important;
    }

    /* Ajustes específicos para tabla responsive */
    .table-container {
      overflow-x: auto !important;
    }

    .service-table {
      min-width: 800px !important;
    }
  }
`;

// Función auxiliar para formatear números
const formatCurrency = (amount) => {
  return Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const Clientesnuevos = () => {
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

  // Datos
  const [facturas, setFacturas] = useState({});

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
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Filtros
  const defaultFilters = {
    mes: [],
    anio: [],
    direccion: [],
    cubicos: [],
  };

  const [filters, setFilters] = useState(defaultFilters);

  // Cargar clientesnuevos
  useEffect(() => {
    const dbRef = ref(database, "clientesnuevos");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        setFacturas(snapshot.val());
      } else {
        setFacturas({});
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Convertir facturas a array y filtrar
  const todos = Object.values(facturas).filter(Boolean);

  const clientesFiltrados = todos.filter((cliente) => {
    // Filtrar por mes y año
    if (cliente.fechaTraslado) {
      const [d, m, y] = cliente.fechaTraslado.split("-");
      
      if (filters.mes.length > 0) {
        const mesMatch = filters.mes.some(opt => opt.value === m);
        if (!mesMatch) return false;
      }
      
      if (filters.anio.length > 0) {
        const anioMatch = filters.anio.some(opt => opt.value === y);
        if (!anioMatch) return false;
      }
    }

    const matchMulti = (arr, field) =>
      !arr.length ||
      arr.some((opt) => {
        const val = (cliente[field] ?? "").toString().toLowerCase();
        const optValue = (opt.value ?? "").toString().toLowerCase();
        return val === optValue;
      });

    if (!matchMulti(filters.direccion, "direccion")) return false;
    if (!matchMulti(filters.cubicos, "cubicos")) return false;

    return true;
  });

  // Paginación directa
  const totalItems = clientesFiltrados.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = clientesFiltrados.slice(startIndex, endIndex);

  // Opciones para filtros
  const mesOptions = [
    { value: "01", label: "Enero" },
    { value: "02", label: "Febrero" },
    { value: "03", label: "Marzo" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Mayo" },
    { value: "06", label: "Junio" },
    { value: "07", label: "Julio" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ];

  const anioOptions = [
    ...Array.from(
      new Set(
        todos
          .map((r) => r.fechaTraslado?.split("-")[2])
          .filter(Boolean)
      )
    )
      .sort((a, b) => b.localeCompare(a))
      .map((v) => ({ value: v, label: v })),
  ];

  const direccionOptions = [
    ...Array.from(
      new Set(clientesFiltrados.map((r) => r.direccion).filter(Boolean))
    )
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v })),
  ];

  const cubicosOptions = [
    ...Array.from(
      new Set(clientesFiltrados.map((r) => r.cubicos).filter(Boolean))
    )
      .sort((a, b) => (Number(a) || 0) - (Number(b) || 0))
      .map((v) => ({ value: v.toString(), label: v.toString() })),
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


  const generateXLSX = async () => {
    const exportData = clientesFiltrados.map((cliente) => ({
      "Fecha de Traslado": cliente.fechaTraslado || "",
      "Hora de Traslado": cliente.horaTraslado || "",
      Dirección: cliente.direccion || "",
      Cúbicos: cliente.cubicos || "",
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Clientes Nuevos");

    const headers = ["Fecha de Traslado", "Hora de Traslado", "Dirección", "Cúbicos"];

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

    worksheet.columns = [{ width: 15 }, { width: 15 }, { width: 30 }, { width: 12 }];

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
    a.download = "Informe_ClientesNuevos.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Exportar a PDF
  const generatePDF = () => {
    const exportData = clientesFiltrados.map((cliente) => ({
      "Fecha de Traslado": cliente.fechaTraslado || "",
      "Hora de Traslado": cliente.horaTraslado || "",
      Dirección: cliente.direccion || "",
      Cúbicos: cliente.cubicos || "",
    }));

    const doc = new jsPDF("p", "mm", "a4");

    doc.setFontSize(16);
    doc.text("Clientes Nuevos", 105, 20, { align: "center" });

    doc.setFontSize(10);
    let yPosition = 35;

    const headers = [["Fecha de Traslado", "Hora de Traslado", "Dirección", "Cúbicos"]];

    const dataRows = exportData.map((item) => [item["Fecha de Traslado"], item["Hora de Traslado"], item.Dirección, item["Cúbicos"]]);

    autoTable(doc, {
      head: headers,
      body: dataRows,
      startY: yPosition,
      theme: "grid",
      headStyles: { fillColor: [79, 129, 189], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      margin: { top: 30, left: 10, right: 10 },
    });

    doc.save("Informe_ClientesNuevos.pdf");
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
        <h2 style={{ color: "white" }}>Filtros</h2>
        <br />
        <hr />

        <label>Mes</label>
        <Select
          isClearable
          isMulti
          options={mesOptions}
          value={filters.mes}
          onChange={(opts) => setFilters({ ...filters, mes: opts || [] })}
          placeholder="Mes(es)..."
        />

        <label>Año</label>
        <Select
          isClearable
          isMulti
          options={anioOptions}
          value={filters.anio}
          onChange={(opts) => setFilters({ ...filters, anio: opts || [] })}
          placeholder="Año(s)..."
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

        <label>Cúbicos</label>
        <Select
          isClearable
          isMulti
          options={cubicosOptions}
          value={filters.cubicos}
          onChange={(opts) => setFilters({ ...filters, cubicos: opts || [] })}
          placeholder="Cúbicos..."
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
          <h1 className="title-page">Clientes Nuevos</h1>
          <div className="current-date">
            <div style={{ cursor: "default" }}>
              {new Date().toLocaleDateString()}
            </div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">

        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha de Traslado</th>
                <th>Hora de Traslado</th>
                <th>Dirección</th>
                <th>Cúbicos</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((cliente, index) => (
                <tr key={index}>
                  <td style={{ paddingRight: "10px", paddingLeft: "10px", textAlign: "center" }}>
                    {cliente.fechaTraslado || ""}
                  </td>
                  <td style={{ paddingRight: "10px", paddingLeft: "10px", textAlign: "center" }}>
                    {cliente.horaTraslado || ""}
                  </td>
                  <td style={{ paddingRight: "10px", paddingLeft: "10px" }}>
                    {cliente.direccion || ""}
                  </td>
                  <td
                    style={{
                      paddingRight: "10px",
                      paddingLeft: "10px",
                      textAlign: "center",
                    }}
                  >
                    {cliente.cubicos || ""}
                  </td>
                </tr>
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
                <option value={25}>25</option>
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

export default React.memo(Clientesnuevos);
