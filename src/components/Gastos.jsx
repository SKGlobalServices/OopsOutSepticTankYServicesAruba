import React, { useEffect, useMemo, useRef, useState } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue, push, remove, set } from "firebase/database";
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
import Swal from "sweetalert2";

const Gastos = () => {
  /* ---------- Estado UI y datos ---------- */
  const [cargando, setCargando] = useState(true);
  const [mostrarSlidebar, setMostrarSlidebar] = useState(false);
  const [mostrarSlidebarFiltros, setMostrarSlidebarFiltros] = useState(false);
  const refSlidebar = useRef(null);
  const refSlidebarFiltros = useRef(null);
  const [mostrarDatePicker, setMostrarDatePicker] = useState(false);
  const [valoresLocales, setValoresLocales] = useState({});
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(50);
  const [gastos, setGastos] = useState([]);

  /* ---------- Filtros y paginación ---------- */
  const [filtros, setFiltros] = useState({
    categoria: [],
    metodoPago: [],
    banco: [],
    proveedor: [],
    responsable: [],
    numFactura: "",
    fechaInicio: null,
    fechaFin: null,
  });

  /* =========================
   Utilidades y Catálogos
   ========================= */
  const formatearDinero = (n) =>
    typeof n === "number"
      ? `AWS ${n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "AWS 0.00";

  const formatearFecha = (d) => {
    const day = ("0" + d.getDate()).slice(-2);
    const month = ("0" + (d.getMonth() + 1)).slice(-2);
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const METODOS_PAGO = ["Efectivo", "Transferencia", "Tarjeta"];

  /* ---------- Cargar desde Firebase ---------- */
  useEffect(() => {
    const cargar = async () => {
      const dbRef = ref(database, "gastos");
      const unsub = onValue(dbRef, (snap) => {
        if (!snap.exists()) {
          setGastos([]);
          setCargando(false);
          return;
        }
        const val = snap.val();
        const lista = Object.entries(val).map(([id, r]) => ({ id, ...r }));
        lista.forEach((g) => {
          if (!g.fecha)
            g.fecha = formatearFecha(new Date(g.timestamp || Date.now()));
        });
        lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setGastos(lista);
        setCargando(false);
      });
      return unsub;
    };
    cargar();
  }, []);

  /* ---------- Opciones dinámicas para filtros ---------- */
  const opcionesCategoria = useMemo(
    () =>
      Array.from(new Set(gastos.map((g) => g.categoria).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v })),
    [gastos]
  );

  const opcionesMetodo = useMemo(
    () =>
      Array.from(new Set(gastos.map((g) => g.metodoPago).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v })),
    [gastos]
  );

  const opcionesBanco = useMemo(
    () =>
      Array.from(new Set(gastos.map((g) => g.banco).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v })),
    [gastos]
  );

  const opcionesProveedor = useMemo(
    () =>
      Array.from(new Set(gastos.map((g) => g.proveedor).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v })),
    [gastos]
  );

  const opcionesResponsable = useMemo(
    () =>
      Array.from(new Set(gastos.map((g) => g.responsable).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v })),
    [gastos]
  );

  /* ---------- Filtrado ---------- */
  const datosFiltrados = useMemo(() => {
    const coincideMulti = (arr, val) =>
      !arr.length ||
      arr.some(
        (opt) =>
          (val ?? "").toString().toLowerCase() ===
          (opt.value ?? "").toString().toLowerCase()
      );

    return gastos.filter((g) => {
      if (filtros.fechaInicio && filtros.fechaFin) {
        const [d, m, y] = (g.fecha || "").split("-");
        const f = new Date(y, (m || 1) - 1, d || 1);
        if (f < filtros.fechaInicio || f > filtros.fechaFin) return false;
      }
      if (!coincideMulti(filtros.categoria, g.categoria)) return false;
      if (!coincideMulti(filtros.metodoPago, g.metodoPago)) return false;
      if (!coincideMulti(filtros.banco, g.banco)) return false;
      if (!coincideMulti(filtros.proveedor, g.proveedor)) return false;
      if (!coincideMulti(filtros.responsable, g.responsable)) return false;

      if (
        filtros.numFactura &&
        !(g.numFactura || "")
          .toString()
          .toLowerCase()
          .includes(filtros.numFactura.toLowerCase())
      )
        return false;

      return true;
    });
  }, [gastos, filtros]);

  /* ---------- Agrupado por fecha ---------- */
  const agrupado = useMemo(() => {
    const acc = {};
    datosFiltrados.forEach((g) => {
      (acc[g.fecha] = acc[g.fecha] || []).push(g);
    });
    return Object.entries(acc)
      .map(([fecha, registros]) => ({ fecha, registros }))
      .sort((a, b) => {
        const [d1, m1, y1] = a.fecha.split("-");
        const [d2, m2, y2] = b.fecha.split("-");
        return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
      });
  }, [datosFiltrados]);

  /* ---------- Paginación ---------- */
  const todosRegistros = agrupado.flatMap((g) => g.registros);
  const totalItems = todosRegistros.length;
  const totalPaginas = Math.ceil(Math.max(1, totalItems) / itemsPorPagina);
  const indiceInicio = (paginaActual - 1) * itemsPorPagina;
  const indiceFin = indiceInicio + itemsPorPagina;
  const registrosPagina = todosRegistros.slice(indiceInicio, indiceFin);

  const agrupadoPaginado = registrosPagina.reduce((acc, r) => {
    (acc[r.fecha] = acc[r.fecha] || []).push(r);
    return acc;
  }, {});
  const datosPaginados = Object.entries(agrupadoPaginado)
    .map(([fecha, registros]) => ({ fecha, registros }))
    .sort((a, b) => {
      const [d1, m1, y1] = a.fecha.split("-");
      const [d2, m2, y2] = b.fecha.split("-");
      return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    });

  /* ---------- Totales ---------- */
  const totalGeneral = useMemo(
    () => datosFiltrados.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0),
    [datosFiltrados]
  );
  const totalEfectivo = useMemo(
    () =>
      datosFiltrados
        .filter((g) => g.metodoPago === "Efectivo")
        .reduce((s, g) => s + (parseFloat(g.monto) || 0), 0),
    [datosFiltrados]
  );
  const totalTransferencia = useMemo(
    () =>
      datosFiltrados
        .filter((g) => g.metodoPago === "Transferencia")
        .reduce((s, g) => s + (parseFloat(g.monto) || 0), 0),
    [datosFiltrados]
  );
  const totalTarjeta = useMemo(
    () =>
      datosFiltrados
        .filter((g) => g.metodoPago === "Tarjeta")
        .reduce((s, g) => s + (parseFloat(g.monto) || 0), 0),
    [datosFiltrados]
  );

  /* ---------- Navegación de páginas ---------- */
  const irAPagina = (p) => p >= 1 && p <= totalPaginas && setPaginaActual(p);
  const irAPrimeraPagina = () => irAPagina(1);
  const irAUltimaPagina = () => irAPagina(totalPaginas);
  const irAPaginaAnterior = () => irAPagina(paginaActual - 1);
  const irAPaginaSiguiente = () => irAPagina(paginaActual + 1);
  const cambiarItemsPorPagina = (n) => {
    setItemsPorPagina(n);
    setPaginaActual(1);
  };
  useEffect(() => {
    setPaginaActual(1);
  }, [filtros]);

  /* ---------- Cierre de slidebars al click fuera ---------- */
  useEffect(() => {
    const onDoc = (e) => {
      if (
        refSlidebar.current &&
        !refSlidebar.current.contains(e.target) &&
        !e.target.closest(".show-slidebar-button")
      )
        setMostrarSlidebar(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => {
    const onDoc = (e) => {
      if (
        refSlidebarFiltros.current &&
        !refSlidebarFiltros.current.contains(e.target) &&
        !e.target.closest(".show-filter-slidebar-button")
      )
        setMostrarSlidebarFiltros(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /* ---------- Rango de fechas ---------- */
  const cambiarRangoFechas = (dates) => {
    const [start, end] = dates;
    setFiltros((prev) => ({
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

  /* ---------- Exportar Excel ---------- */
  const generarXLSX = async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Gastos");

    const filas = agrupado.flatMap((g) =>
      g.registros.map((r) => ({
        Fecha: g.fecha,
        Categoría: r.categoria || "",
        Descripción: r.descripcion || "",
        Proveedor: r.proveedor || "",
        "Método de Pago": r.metodoPago || "",
        Banco: r.banco || "",
        Monto: parseFloat(r.monto) || 0,
        "N° Factura": r.numFactura || "",
        Responsable: r.responsable || "",
      }))
    );

    const encabezados = Object.keys(
      filas[0] || {
        Fecha: "",
        Categoría: "",
        Descripción: "",
        Proveedor: "",
        "Método de Pago": "",
        Banco: "",
        Monto: 0,
        "N° Factura": "",
        Responsable: "",
      }
    );

    const filaHead = hoja.addRow(encabezados);
    filaHead.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F81BD" },
      };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: encabezados.length },
    };
    hoja.columns = [
      { width: 12 },
      { width: 18 },
      { width: 40 },
      { width: 22 },
      { width: 18 },
      { width: 24 },
      { width: 14 },
      { width: 16 },
      { width: 22 },
    ];

    filas.forEach((r) => {
      const row = hoja.addRow(encabezados.map((h) => r[h]));
      row.getCell(7).numFmt = '"AWS" #,##0.00';
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    const buffer = await libro.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Reporte_Gastos.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Exportar PDF ---------- */
  const generarPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(16);
    doc.text("Reporte de Gastos", 105, 18, { align: "center" });
    doc.setFontSize(10);

    let y = 28;
    doc.text(`Total General De Gastos: ${formatearDinero(totalGeneral)}`, 14, y);
    y += 6;
    doc.text(`Efectivo: ${formatearDinero(totalEfectivo)}`, 14, y);
    y += 6;
    doc.text(`Transferencia: ${formatearDinero(totalTransferencia)}`, 14, y);
    y += 6;
    doc.text(`Tarjeta: ${formatearDinero(totalTarjeta)}`, 14, y);
    y += 6;

    const filas = agrupado.flatMap((g) =>
      g.registros.map((r) => [
        g.fecha,
        r.categoria || "",
        r.descripcion || "",
        r.proveedor || "",
        r.metodoPago || "",
        r.banco || "",
        (parseFloat(r.monto) || 0).toFixed(2),
        r.numFactura || "",
        r.responsable || "",
      ])
    );

    autoTable(doc, {
      startY: y + 4,
      head: [
        [
          "Fecha",
          "Categoría",
          "Descripción",
          "Proveedor",
          "Método",
          "Banco",
          "Monto",
          "N° Factura",
          "Responsable",
        ],
      ],
      body: filas,
      theme: "grid",
      headStyles: { fillColor: [79, 129, 189], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      margin: { top: 18, left: 8, right: 8 },
      columnStyles: {
        2: { cellWidth: 48 },
        3: { cellWidth: 26 },
        5: { cellWidth: 26 },
      },
    });

    doc.save("Reporte_Gastos.pdf");
  };

  /* ---------- Función para actualizar un campo en Firebase y en el estado local */
  const actualizarCampo = (id, campo, valor) => {
    set(ref(database, `gastos/${id}/${campo}`), valor);
    setGastos((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [campo]: valor } : g))
    );
  };

  /* ---------- Loading ---------- */
  if (cargando) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  /* ---------- Render ---------- */
  return (
    <div className="homepage-container">
      <Slidebar />
      <div onClick={() => mostrarSlidebar((v) => !v)}></div>

      {/* FILTROS */}
      <div onClick={() => setMostrarSlidebarFiltros((v) => !v)}>
        <img
          src={filtericon}
          className="show-filter-slidebar-button"
          alt="Filtros"
        />
      </div>

      <div
        ref={refSlidebarFiltros}
        className={`filter-slidebar ${mostrarSlidebarFiltros ? "show" : ""}`}
      >
        <h2>Filtros</h2>
        <br />
        <hr />
        <button
          onClick={() => setMostrarDatePicker((v) => !v)}
          className="filter-button"
        >
          {mostrarDatePicker
            ? "Ocultar selector de fechas"
            : "Filtrar por rango de fechas"}
        </button>
        {mostrarDatePicker && (
          <DatePicker
            selected={filtros.fechaInicio}
            onChange={cambiarRangoFechas}
            startDate={filtros.fechaInicio}
            endDate={filtros.fechaFin}
            selectsRange
            inline
          />
        )}

        <label>Categoría</label>
        <Select
          isClearable
          isMulti
          options={opcionesCategoria}
          value={filtros.categoria}
          onChange={(opts) => setFiltros({ ...filtros, categoria: opts || [] })}
          placeholder="Categoría(s)..."
        />

        <label>Método de Pago</label>
        <Select
          isClearable
          isMulti
          options={opcionesMetodo}
          value={filtros.metodoPago}
          onChange={(opts) =>
            setFiltros({ ...filtros, metodoPago: opts || [] })
          }
          placeholder="Método(s)..."
        />

        <label>Banco</label>
        <Select
          isClearable
          isMulti
          options={opcionesBanco}
          value={filtros.banco}
          onChange={(opts) => setFiltros({ ...filtros, banco: opts || [] })}
          placeholder="Banco(s)..."
        />

        <label>Proveedor</label>
        <Select
          isClearable
          isMulti
          options={opcionesProveedor}
          value={filtros.proveedor}
          onChange={(opts) => setFiltros({ ...filtros, proveedor: opts || [] })}
          placeholder="Proveedor(es)..."
        />

        <label>Responsable</label>
        <Select
          isClearable
          isMulti
          options={opcionesResponsable}
          value={filtros.responsable}
          onChange={(opts) =>
            setFiltros({ ...filtros, responsable: opts || [] })
          }
          placeholder="Responsable(s)..."
        />

        <label>N° de Factura</label>
        <input
          type="text"
          placeholder="Buscar número de factura..."
          value={filtros.numFactura}
          onChange={(e) =>
            setFiltros({ ...filtros, numFactura: e.target.value })
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
            setFiltros({
              categoria: [],
              metodoPago: [],
              banco: [],
              proveedor: [],
              responsable: [],
              numFactura: "",
              fechaInicio: null,
              fechaFin: null,
            })
          }
        >
          Descartar Filtros
        </button>
      </div>

      {/* Título / Fecha */}
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Gastos</h1>
          <div className="current-date">
            <div>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      {/* Tarjetas resumen */}
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
              backgroundColor: "#dc3545",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              e.currentTarget.style.backgroundColor = "#bb2d3b";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              e.currentTarget.style.backgroundColor = "#dc3545";
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>
              Total General De Gastos
            </p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>
              {formatearDinero(totalGeneral)}
            </p>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              color: "#fff",
              borderRadius: "6px",
              padding: "8px",
              flex: 1,
              textAlign: "center",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              backgroundColor: "#6c757d",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              e.currentTarget.style.backgroundColor = "#5c636a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              e.currentTarget.style.backgroundColor = "#6c757d";
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>
              Efectivo
            </p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>
              {formatearDinero(totalEfectivo)}
            </p>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              color: "#fff",
              borderRadius: "6px",
              padding: "8px",
              flex: 1,
              textAlign: "center",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              backgroundColor: "#5271ff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              e.currentTarget.style.backgroundColor = "#375bff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              e.currentTarget.style.backgroundColor = "#5271ff";
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>
              Transferencia
            </p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>
              {formatearDinero(totalTransferencia)}
            </p>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              color: "#fff",
              borderRadius: "6px",
              padding: "8px",
              flex: 1,
              textAlign: "center",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              backgroundColor: "#198754",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              e.currentTarget.style.backgroundColor = "#157347";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              e.currentTarget.style.backgroundColor = "#198754";
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>
              Tarjeta
            </p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>
              {formatearDinero(totalTarjeta)}
            </p>
          </div>
        </div>

        {/* Tabla */}
        <div className="table-container" style={{ marginTop: 10 }}>
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Proveedor</th>
                <th>Método</th>
                <th>Banco</th>
                <th>Monto</th>
                <th>N° Factura</th>
                <th>Responsable</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {datosPaginados.map((g) => (
                <React.Fragment key={g.fecha}>
                  {g.registros.map((r) => (
                    <tr key={r.id}>
                      {/* Fecha */}
                      <td>
                        <input
                          type="text"
                          value={
                            valoresLocales[`${r.id}_fecha`] ?? r.fecha ?? ""
                          }
                          onChange={(e) =>
                            setValoresLocales((prev) => ({
                              ...prev,
                              [`${r.id}_fecha`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.fecha || "")) {
                              actualizarCampo(r.id, "fecha", e.target.value);
                            }
                          }}
                          style={{ width: "10ch" }}
                        />
                      </td>
                      {/* Categoría */}
                      <td>
                        <input
                          type="text"
                          value={
                            valoresLocales[`${r.id}_categoria`] ??
                            r.categoria ??
                            ""
                          }
                          onChange={(e) =>
                            setValoresLocales((prev) => ({
                              ...prev,
                              [`${r.id}_categoria`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.categoria || "")) {
                              actualizarCampo(
                                r.id,
                                "categoria",
                                e.target.value
                              );
                            }
                          }}
                          style={{ width: "14ch" }}
                        />
                      </td>
                      {/* Descripción */}
                      <td>
                        <input
                          type="text"
                          value={
                            valoresLocales[`${r.id}_descripcion`] ??
                            r.descripcion ??
                            ""
                          }
                          onChange={(e) =>
                            setValoresLocales((prev) => ({
                              ...prev,
                              [`${r.id}_descripcion`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.descripcion || "")) {
                              actualizarCampo(
                                r.id,
                                "descripcion",
                                e.target.value
                              );
                            }
                          }}
                          style={{ width: "24ch" }}
                        />
                      </td>
                      {/* Proveedor */}
                      <td>
                        <input
                          type="text"
                          value={
                            valoresLocales[`${r.id}_proveedor`] ??
                            r.proveedor ??
                            ""
                          }
                          onChange={(e) =>
                            setValoresLocales((prev) => ({
                              ...prev,
                              [`${r.id}_proveedor`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.proveedor || "")) {
                              actualizarCampo(
                                r.id,
                                "proveedor",
                                e.target.value
                              );
                            }
                          }}
                          style={{ width: "14ch" }}
                        />
                      </td>
                      {/* Método de Pago */}
                      <td>
                        <select
                          value={r.metodoPago || ""}
                          onChange={(e) =>
                            actualizarCampo(r.id, "metodoPago", e.target.value)
                          }
                          style={{ width: "12ch" }}
                        >
                          <option value=""></option>
                          {METODOS_PAGO.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </td>
                      {/* Banco */}
                      <td>
                        <select
                          value={r.banco || ""}
                          onChange={(e) =>
                            actualizarCampo(r.id, "banco", e.target.value)
                          }
                          style={{ width: "18ch" }}
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
                      {/* Monto */}
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="number"
                          step="0.01"
                          value={
                            valoresLocales[`${r.id}_monto`] ?? r.monto ?? ""
                          }
                          onChange={(e) =>
                            setValoresLocales((prev) => ({
                              ...prev,
                              [`${r.id}_monto`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.monto || "")) {
                              actualizarCampo(r.id, "monto", e.target.value);
                            }
                          }}
                          style={{ width: "10ch", textAlign: "right" }}
                        />
                      </td>
                      {/* N° Factura */}
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="text"
                          value={
                            valoresLocales[`${r.id}_numFactura`] ??
                            r.numFactura ??
                            ""
                          }
                          onChange={(e) =>
                            setValoresLocales((prev) => ({
                              ...prev,
                              [`${r.id}_numFactura`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.numFactura || "")) {
                              actualizarCampo(
                                r.id,
                                "numFactura",
                                e.target.value
                              );
                            }
                          }}
                          style={{ width: "10ch" }}
                        />
                      </td>
                      {/* Responsable */}
                      <td>
                        <input
                          type="text"
                          value={
                            valoresLocales[`${r.id}_responsable`] ??
                            r.responsable ??
                            ""
                          }
                          onChange={(e) =>
                            setValoresLocales((prev) => ({
                              ...prev,
                              [`${r.id}_responsable`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.responsable || "")) {
                              actualizarCampo(
                                r.id,
                                "responsable",
                                e.target.value
                              );
                            }
                          }}
                          style={{ width: "14ch" }}
                        />
                      </td>
                      {/* Eliminar */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="edit-button"
                          style={{
                            marginLeft: "5px",
                            backgroundColor: "red",
                            color: "white",
                          }}
                          onClick={() => {
                            Swal.fire({
                              title: "¿Eliminar registro?",
                              text: "Esta acción no se puede deshacer.",
                              icon: "warning",
                              showCancelButton: true,
                              confirmButtonText: "Sí, eliminar",
                              cancelButtonText: "Cancelar",
                            }).then((result) => {
                              if (result.isConfirmed) {
                                remove(ref(database, `gastos/${r.id}`)).catch(
                                  (err) =>
                                    console.error(
                                      "Error al eliminar:",
                                      err.message
                                    )
                                );
                              }
                            });
                          }}
                        >
                          Borrar
                        </button>
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
              Mostrando {totalItems === 0 ? 0 : indiceInicio + 1}-
              {Math.min(indiceFin, totalItems)} de {totalItems} gastos
            </span>
            <div className="items-per-page">
              <label>Mostrar:</label>
              <select
                value={itemsPorPagina}
                onChange={(e) => cambiarItemsPorPagina(Number(e.target.value))}
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
              onClick={irAPrimeraPagina}
              disabled={paginaActual === 1}
              title="Primera página"
            >
              ««
            </button>
            <button
              onClick={irAPaginaAnterior}
              disabled={paginaActual === 1}
              title="Página anterior"
            >
              «
            </button>
            <span>
              Página {paginaActual} de {totalPaginas || 1}
            </span>
            <button
              onClick={irAPaginaSiguiente}
              disabled={paginaActual === totalPaginas}
              title="Página siguiente"
            >
              »
            </button>
            <button
              onClick={irAUltimaPagina}
              disabled={paginaActual === totalPaginas}
              title="Última página"
            >
              »»
            </button>
          </div>
        </div>
      </div>

      {/* Botones de exportación */}
      <button className="generate-button1" onClick={generarXLSX}>
        <img className="generate-button-imagen1" src={excel_icon} alt="Excel" />
      </button>
      <button className="generate-button2" onClick={generarPDF}>
        <img className="generate-button-imagen2" src={pdf_icon} alt="PDF" />
      </button>

      <button
        className="create-table-button"
        onClick={async () => {
          // Crea un gasto vacío en la rama "gastos"
          const nuevoRef = push(ref(database, "gastos"));
          await set(nuevoRef, {
            fecha: formatearFecha(new Date()),
            categoria: "",
            descripcion: "",
            proveedor: "",
            metodoPago: "",
            banco: "",
            monto: "",
            moneda: "AWS",
            numFactura: "",
            responsable: "",
            timestamp: Date.now(),
          });
        }}
      >
        +
      </button>
    </div>
  );
};

export default Gastos;
