import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, set, push, remove, update, onValue } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { decryptData } from "../utils/security";
import { validateSessionForAction } from "../utils/sessionValidator";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Select from "react-select";
import Slidebar from "./Slidebar";
import Clock from "./Clock";
import filtericon from "../assets/img/filters_icon.jpg";
import excel_icon from "../assets/img/excel_icon.jpg";
import pdf_icon from "../assets/img/pdf_icon.jpg";

const Homepage = () => {
  const navigate = useNavigate();

  // Verificación de autorización
  useEffect(() => {
    const userData = decryptData(localStorage.getItem("user"));
    if (!userData || userData.role !== "admin") {
      navigate("/");
      return;
    }
  }, [navigate]);

  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);
  const [data, setData] = useState([]); // Cada elemento es: [id, item]
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);
  const [showDireccionAlert, setShowDireccionAlert] = useState(true);

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const [filters, setFilters] = useState({
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
  });

  // Estados locales para campos editables (onBlur)
  const [localValues, setLocalValues] = useState({});

  // Cargar la rama "data"
  useEffect(() => {
    const dbRef = ref(database, "data");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedData = Object.entries(snapshot.val());
        const con = fetchedData.filter(([, it]) => !!it.realizadopor);
        const sin = fetchedData.filter(([, it]) => !it.realizadopor);

        setData([
          ...con.sort(([, a], [, b]) =>
            a.realizadopor.localeCompare(b.realizadopor)
          ),
          ...sin,
        ]);
      } else {
        setData([]);
      }
      setLoadedData(true);
    });
    return () => unsubscribe();
  }, []);

  // Cargar "users" con autorización
  useEffect(() => {
    const loadUsers = async () => {
      const isAuthorized = await validateSessionForAction("cargar usuarios");
      if (!isAuthorized) return;

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
        setLoadedUsers(true);
      });
      return () => unsubscribe();
    };

    loadUsers();
  }, []);

  // Cargar "clientes"
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
      } else {
        setClients([]);
      }
      setLoadedClients(true);
    });
    return () => unsubscribe();
  }, []);

  // Sincronizar registros de "data" si el campo "realizadopor" contiene un nombre en lugar de un id
  useEffect(() => {
    if (users.length === 0) return;
    data.forEach(([id, item]) => {
      if (item.realizadopor && !users.some((u) => u.id === item.realizadopor)) {
        const matchedUser = users.find(
          (u) =>
            u.name.toLowerCase() === item.realizadopor.toString().toLowerCase()
        );
        if (matchedUser) {
          handleFieldChange(id, "realizadopor", matchedUser.id);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, data]);

  // Opciones para filtros:

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
      new Set(data.map(([_, item]) => item.anombrede).filter(Boolean))
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const direccionOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map(([_, item]) => item.direccion).filter(Boolean))
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const servicioOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map(([_, item]) => item.servicio).filter(Boolean))
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const cubicosOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map(([_, item]) => item.cubicos).filter(Boolean))
    )
      .sort((a, b) => a - b)
      .map((v) => ({ value: v.toString(), label: v.toString() })),
  ];

  const valorOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(new Set(data.map(([_, item]) => item.valor).filter(Boolean)))
      .sort((a, b) => a - b)
      .map((v) => ({ value: v.toString(), label: v.toString() })),
  ];

  const pagoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(new Set(data.map(([_, item]) => item.pago).filter(Boolean)))
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const formadePagoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map(([_, item]) => item.formadepago).filter(Boolean))
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const BancoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(new Set(data.map(([_, item]) => item.banco).filter(Boolean)))
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const metodoPagoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map(([_, item]) => item.metododepago).filter(Boolean))
    )
      .sort()
      .map((v) => ({ value: v, label: v })),
  ];

  const efectivoOptions = [
    { value: "__EMPTY__", label: "🚫 Vacío" },
    ...Array.from(
      new Set(data.map(([_, item]) => item.efectivo).filter(Boolean))
    )
      .sort((a, b) => a - b)
      .map((v) => ({ value: v.toString(), label: v.toString() })),
  ];

  const reorderData = (sinRealizadopor, conRealizadopor) => [
    ...conRealizadopor.sort(([, a], [, b]) =>
      a.realizadopor.localeCompare(b.realizadopor)
    ),
    ...sinRealizadopor,
  ];

  // Función para agregar un nuevo servicio
  const addData = async (
    realizadopor,
    anombrede,
    direccion,
    servicio,
    cubicos,
    valor,
    pago,
    formadepago,
    banco,
    notas,
    metododepago,
    efectivo,
    factura
  ) => {
    const dbRef = ref(database, "data");
    const newDataRef = push(dbRef);
    const newData = {
      realizadopor,
      anombrede,
      direccion,
      servicio,
      cubicos,
      valor,
      pago,
      formadepago,
      banco,
      notas,
      metododepago,
      efectivo,
      factura,
    };
    // Guarda en Firebase
    await set(newDataRef, newData).catch(console.error);
  };

  // Función para actualizar campos en Firebase
  // Se modificó para aceptar un objeto de campos cuando se requiera actualizar más de uno a la vez.
  // Dentro de tu componente...

  // 1) handleFieldChange: ajustado para el flujo deseado
  const handleFieldChange = (id, field, value) => {
    // actualizamos el campo en data
    const safeValue = value == null ? "" : value;
    const dbRefItem = ref(database, `data/${id}`);
    update(dbRefItem, { [field]: safeValue }).catch(console.error);

    // actualizamos estado local y reordenamos
    setData((d) => {
      // 1) Reemplazamos el elemento modificado
      const updated = d.map(([iid, it]) =>
        iid === id ? [iid, { ...it, [field]: safeValue }] : [iid, it]
      );

      // 2) Separamos:
      const sinRealizadopor = updated.filter(([, it]) => !it.realizadopor);
      const conRealizadopor = updated
        .filter(([, it]) => !!it.realizadopor)
        .sort(([, a], [, b]) => a.realizadopor.localeCompare(b.realizadopor));

      // 3) Concatenamos, sin volver a “tocar” el bloque de vacíos:
      return [...conRealizadopor, ...sinRealizadopor];
    });

    // --- Lógica específica para servicio ---
    if (field === "servicio") {
      // solo si se asignó un servicio no vacío
      if (safeValue) {
        const item = data.find(([iid]) => iid === id)[1];
        const direccion = item.direccion;
        if (direccion) {
          const existing = clients.find((c) => c.direccion === direccion);
          if (!existing) {
            // insertar nuevo cliente
            const newClientRef = push(ref(database, "clientes"));
            set(newClientRef, {
              direccion,
              cubicos:
                item.cubicos != null && item.cubicos !== ""
                  ? item.cubicos
                  : null,
            }).catch(console.error);
          }
          // luego, cargar cubicos desde clientes (si existe)
          loadClientFields(direccion, id);
        }
      } else {
        handleFieldChange(id, "cubicos", "");
      }
    }

    // --- Lógica específica para direccion ---
    if (field === "direccion") {
      // al cambiar dirección, siempre recargamos cubicos desde clientes
      loadClientFields(safeValue, id);
    }
  };

  // 2) Función de solo lectura de cúbicos, valor y a nombre de desde clientes
  const loadClientFields = (direccion, dataId) => {
    const cli = clients.find((c) => c.direccion === direccion);
    const dbRefItem = ref(database, `data/${dataId}`);
    if (cli) {
      // si existe el cliente, actualiza cubicos, valor y anombrede
      update(dbRefItem, {
        cubicos: cli.cubicos ?? 0,
        valor: cli.valor ?? 0,
        anombrede: cli.anombrede ?? "",
      }).catch(console.error);
      setData((d) =>
        d.map(([iid, it]) =>
          iid === dataId
            ? [
                iid,
                {
                  ...it,
                  cubicos: cli.cubicos,
                  valor: cli.valor,
                  anombrede: cli.anombrede,
                },
              ]
            : [iid, it]
        )
      );
    } else {
      // si no existe, limpia los tres campos
      update(dbRefItem, { cubicos: "", valor: "", anombrede: "" }).catch(
        console.error
      );
      setData((d) =>
        d.map(([iid, it]) =>
          iid === dataId
            ? [iid, { ...it, cubicos: "", valor: "", anombrede: "" }]
            : [iid, it]
        )
      );
    }
  };

  // Función para eliminar un servicio
  const deleteData = (id) => {
    const dbRefItem = ref(database, `data/${id}`);
    remove(dbRefItem).catch(console.error);

    // 1) Filtra el estado actual para eliminar el id
    const remaining = data.filter(([itemId]) => itemId !== id);

    // 2) Separa vacíos y con valor
    const sin = remaining.filter(([, it]) => !it.realizadopor);
    const con = remaining.filter(([, it]) => !!it.realizadopor);

    // 3) Reordena y actualiza estado
    setData(reorderData(sin, con));
  };

  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);
  const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);

  const handleClickOutside = (e) => {
    if (
      slidebarRef.current &&
      !slidebarRef.current.contains(e.target) &&
      !e.target.closest(".show-slidebar-button")
    ) {
      setShowSlidebar(false);
    }
  };

  useEffect(() => {
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

  const getRowClass = (metodoPago) => {
    if (metodoPago === "efectivo") return "efectivo";
    else if (metodoPago === "cancelado") return "cancelado";
    else if (metodoPago === "credito") return "credito";
    return "";
  };

  // Para exportar XLSX y PDF, mapeamos el id de "realizadopor" al nombre correspondiente
  const getUserName = (userId) => {
    const found = users.find((u) => u.id === userId);
    return found ? found.name : "";
  };

  // Función para generar XLSX con ExcelJS
  const generateXLSX = async () => {
    const exportData = filteredData.map(([id, item]) => ({
      "Realizado Por": getUserName(item.realizadopor) || "",
      "A Nombre De": item.anombrede || "",
      Dirección: item.direccion || "",
      Servicio: item.servicio || "",
      Cúbicos: item.cubicos || "",
      Valor: item.valor || "",
      Pago: item.pago || "",
      "Forma De Pago": item.formadepago || "",
      Banco: item.banco || "",
      Notas: item.notas || "",
      "Método de Pago": item.metododepago || "",
      Efectivo: item.efectivo || "",
      Factura: item.factura ? "Sí" : "No",
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data");

    const headers = [
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
      "Método de Pago",
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

    worksheet.columns = [
      { width: 20 },
      { width: 20 },
      { width: 30 },
      { width: 18 },
      { width: 12 },
      { width: 12 },
      { width: 16 },
      { width: 18 },
      { width: 18 },
      { width: 15 },
      { width: 18 },
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
    a.download = "Servicios De Hoy.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Función para generar PDF usando jsPDF y autoTable
  const generatePDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(16);
    doc.text("Servicios De Hoy", 105, 20, { align: "center" });
    doc.setFontSize(10);
    const headers = [
      [
        "Realizado Por",
        "A Nombre De",
        "Dirección",
        "Servicio",
        "Cúbicos",
        "Valor",
        "Pago",
        "Forma de pago",
        "Banco",
        "Notas",
        "Método de Pago",
        "Efectivo",
        "Factura",
      ],
    ];
    const dataRows = filteredData.map(([id, item]) => [
      getUserName(item.realizadopor) || "",
      item.anombrede || "",
      item.direccion || "",
      item.servicio || "",
      item.cubicos || "",
      item.valor || "",
      item.pago || "",
      item.formadepago || "",
      item.banco || "",
      item.notas || "",
      item.metododepago || "",
      item.efectivo || "",
      item.factura ? "Sí" : "No",
    ]);

    autoTable(doc, {
      head: headers,
      body: dataRows,
      startY: 30,
      theme: "grid",
      headStyles: { fillColor: [79, 129, 189], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      margin: { top: 30, left: 10, right: 10 },
    });
    doc.save("Servicios De Hoy.pdf");
  };

  // Filtrado de la data según los filtros establecidos.
  const filteredData = data.filter(([_, item]) => {
    const matchMulti = (filterArr, field) =>
      filterArr.length === 0 ||
      filterArr.some((f) => {
        // Si el filtro es "__EMPTY__", verificamos si el campo está vacío
        if (f.value === "__EMPTY__") {
          const fieldValue = item[field];
          return (
            !fieldValue ||
            fieldValue === "" ||
            fieldValue === null ||
            fieldValue === undefined
          );
        }
        // para numéricos, comparamos string con item[field]

        return (
          item[field]?.toString().toLowerCase() ===
          f.value.toString().toLowerCase()
        );
      });

    if (!matchMulti(filters.realizadopor, "realizadopor")) return false;
    if (!matchMulti(filters.anombrede, "anombrede")) return false;
    if (!matchMulti(filters.direccion, "direccion")) return false;
    if (!matchMulti(filters.servicio, "servicio")) return false;
    if (!matchMulti(filters.cubicos, "cubicos")) return false;
    if (!matchMulti(filters.valor, "valor")) return false;
    if (!matchMulti(filters.pago, "pago")) return false;
    if (!matchMulti(filters.formadepago, "formadepago")) return false;
    if (!matchMulti(filters.banco, "banco")) return false;
    if (!matchMulti(filters.metododepago, "metododepago")) return false;
    if (!matchMulti(filters.efectivo, "efectivo")) return false;

    // Factura (single)
    if (
      filters.factura !== "" &&
      Boolean(item.factura) !== (filters.factura === "true")
    )
      return false;

    return true;
  });

  // Contar ocurrencias de cada dirección en los datos filtrados
  const direccionCounts = {};
  filteredData.forEach(([_, item]) => {
    const dir = (item.direccion || "").trim();
    if (dir) {
      direccionCounts[dir] = (direccionCounts[dir] || 0) + 1;
    }
  });

  // Cálculos de paginación
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredData.slice(startIndex, endIndex);

  // Funciones de navegación
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
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
  };

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleNotesClick = (id, currentNotes) => {
    console.log(id);
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
        const notes = result.value;
        handleFieldChange(id, "notas", notes);
        Swal.fire("Guardado", "Notas guardadas correctamente", "success");
      }
    });
  };

  const TotalServiciosPorTrabajador = () => {
    // 1) Calculamos los totales por trabajador asignado
    const counts = filteredData.reduce((acc, [_, item]) => {
      const uid = item.realizadopor;
      if (uid) acc[uid] = (acc[uid] || 0) + 1;
      return acc;
    }, {});

    // 2) Calculamos cuántos servicios no tienen 'realizadopor'
    const unassignedCount = filteredData.filter(
      ([_, item]) => !item.realizadopor
    ).length;

    // 3) Armamos la tabla HTML
    let html = `
    <table style="
      width: 100%;
      border-collapse: collapse;
      font-family: sans-serif;
      text-align: left;
    ">
      <thead>
        <tr>
          <th style="
            background-color: #5271ff;
            color: white;
            padding: 8px;
            border: 1px solid #ddd;
          ">Trabajador</th>
          <th style="
            background-color: #5271ff;
            color: white;
            padding: 8px;
            border: 1px solid #ddd;
          ">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

    // 4) Una fila por cada usuario (incluso con 0)
    users.forEach((u) => {
      const cnt = counts[u.id] || 0;
      html += `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${u.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center">${cnt}</td>
      </tr>
    `;
    });

    // 5) Fila para los servicios sin asignar
    html += `
    <tr>
      <th style="padding: 8px; border: 1px solid #ddd; background-color: #5271ff; color: white; text-align: left">Sin Asignar</th>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center">${unassignedCount}</td>
    </tr>
  `;

    // 6) Calcula el gran total (debe coincidir con filteredData.length)
    const grandTotal = filteredData.length;
    html += `
      <tr style="font-weight: bold;">
        <th style="padding: 8px; border: 1px solid #ddd; background-color: #5271ff; color: white; text-align: left">Total:</th>
        <th style="padding: 8px; border: 1px solid #ddd; background-color: #5271ff; color: white; text-align: center">${grandTotal}</th>
      </tr>
    </tbody>
  </table>
  `;

    // 7) Mostramos el Swal
    Swal.fire({
      title: "Total de servicios por trabajador",
      html,
      width: "600px",
      showCloseButton: true,
      focusConfirm: false,
      confirmButtonText: "Cerrar",
    });
  };

  useEffect(() => {
    if (loadedData && loadedUsers && loadedClients) {
      setLoading(false);
    }
  }, [loadedData, loadedUsers, loadedClients]);

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

      {/* Boton De Filtros */}
      <div onClick={toggleFilterSlidebar}>
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

        {/** Realizado Por **/}
        <label>Realizado Por</label>
        <Select
          isClearable
          isMulti
          options={realizadoporOptions}
          value={filters.realizadopor}
          onChange={(opts) =>
            setFilters({ ...filters, realizadopor: opts || [] })
          }
          placeholder="Selecciona usuario(s)..."
        />

        {/** A Nombre De **/}
        <label>A Nombre De</label>
        <Select
          isClearable
          isMulti
          options={anombredeOptions}
          value={filters.anombrede}
          onChange={(opts) => setFilters({ ...filters, anombrede: opts || [] })}
          placeholder="Selecciona nombre(s)..."
        />

        {/** Dirección **/}
        <label>Dirección</label>
        <Select
          isClearable
          isMulti
          options={direccionOptions}
          value={filters.direccion}
          onChange={(opts) => setFilters({ ...filters, direccion: opts || [] })}
          placeholder="Selecciona dirección(es)..."
        />

        {/** Servicio **/}
        <label>Servicio</label>
        <Select
          isClearable
          isMulti
          options={servicioOptions}
          value={filters.servicio}
          onChange={(opts) => setFilters({ ...filters, servicio: opts || [] })}
          placeholder="Selecciona servicio(s)..."
        />

        {/** Cúbicos **/}
        <label>Cúbicos</label>
        <Select
          isClearable
          isMulti
          options={cubicosOptions}
          value={filters.cubicos}
          onChange={(opts) => setFilters({ ...filters, cubicos: opts || [] })}
          placeholder="Selecciona valor(es)..."
        />

        {/** Valor **/}
        <label>Valor</label>
        <Select
          isClearable
          isMulti
          options={valorOptions}
          value={filters.valor}
          onChange={(opts) => setFilters({ ...filters, valor: opts || [] })}
          placeholder="Selecciona valor(es)..."
        />

        {/** Pago **/}
        <label>Pago</label>
        <Select
          isClearable
          isMulti
          options={pagoOptions}
          value={filters.pago}
          onChange={(opts) => setFilters({ ...filters, pago: opts || [] })}
          placeholder="Selecciona estado(s)..."
        />

        {/** Forma De Pago **/}
        <label>Forma De Pago</label>
        <Select
          isClearable
          isMulti
          options={formadePagoOptions}
          value={filters.formadepago}
          onChange={(opts) =>
            setFilters({ ...filters, formadepago: opts || [] })
          }
          placeholder="Selecciona formas(s)..."
        />

        {/** Banco **/}
        <label>Banco</label>
        <Select
          isClearable
          isMulti
          options={BancoOptions}
          value={filters.banco}
          onChange={(opts) => setFilters({ ...filters, banco: opts || [] })}
          placeholder="Selecciona formas(s)..."
        />

        {/** Método de Pago **/}
        <label>Método de Pago</label>
        <Select
          isClearable
          isMulti
          options={metodoPagoOptions}
          value={filters.metododepago}
          onChange={(opts) =>
            setFilters({ ...filters, metododepago: opts || [] })
          }
          placeholder="Selecciona método(s)..."
        />

        {/** Efectivo **/}
        <label>Efectivo</label>
        <Select
          isClearable
          isMulti
          options={efectivoOptions}
          value={filters.efectivo}
          onChange={(opts) => setFilters({ ...filters, efectivo: opts || [] })}
          placeholder="Selecciona monto(s)..."
        />

        {/** Factura (single) **/}
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
            })
          }
        >
          Descartar Filtros
        </button>
      </div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Servicios De Hoy</h1>
          <div className="current-date">
            <div>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        {showDireccionAlert &&
          Object.keys(direccionCounts).filter((dir) => direccionCounts[dir] > 1)
            .length > 0 && (
            <div
              style={{
                background: "#fff3cd",
                color: "#856404",
                border: "1px solid #ffeeba",
                borderRadius: "6px",
                padding: "10px 16px",
                marginBottom: "12px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "15px",
                position: "relative",
              }}
            >
              <span style={{ fontSize: "1.3em" }}>⚠️</span>
              <span style={{ flex: 1 }}>
                <b>¡Atención!</b> Hay direcciones duplicadas en los servicios:
                <ul
                  style={{
                    margin: "6px 0 0 18px",
                    fontWeight: "normal",
                    fontSize: "14px",
                  }}
                >
                  {Object.entries(direccionCounts)
                    .filter(([_, count]) => count > 1)
                    .map(([dir, count]) => (
                      <li key={dir}>
                        <b>{dir}</b> ({count} veces)
                      </li>
                    ))}
                </ul>
              </span>
              <button
                onClick={() => setShowDireccionAlert(false)}
                style={{
                  background: "#ffeeba",
                  color: "#856404",
                  border: "1px solid #ffeeba",
                  borderRadius: "4px",
                  padding: "2px 10px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "13px",
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                }}
              >
                Ocultar
              </button>
            </div>
          )}
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Realizado Por</th>
                <th>A Nombre De</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>Servicio</th>
                <th>Cúbicos</th>
                <th>Valor</th>
                <th>Pago</th>
                <th>Forma De Pago</th>
                <th>Banco</th>
                <th>Acciones</th>
                <th
                  style={{
                    backgroundColor: "#6200ffb4",
                  }}
                >
                  Notas
                </th>
                <th
                  style={{
                    backgroundColor: "#6200ffb4",
                  }}
                >
                  Método De Pago
                </th>
                <th
                  style={{
                    backgroundColor: "#6200ffb4",
                  }}
                >
                  Efectivo
                </th>
                <th
                  style={{
                    backgroundColor: "#6200ffb4",
                  }}
                >
                  Factura
                </th>
              </tr>
            </thead>
            <tbody>
              {currentPageData && currentPageData.length > 0 ? (
                currentPageData.map(([id, item]) => {
                  const rowClass = getRowClass(item.metododepago);
                  const isDireccionDuplicada =
                    direccionCounts[(item.direccion || "").trim()] > 1;
                  return (
                    <tr
                      key={id}
                      className={`${rowClass} ${
                        isDireccionDuplicada ? "direccion-duplicada" : ""
                      }`}
                    >
                      {/* Select para "Realizado Por" */}
                      <td>
                        <select
                          style={{
                            width: "fit-content",
                            minWidth: "24ch",
                            maxWidth: "100%",
                            paddingRight: "3ch",
                          }}
                          value={item.realizadopor || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              id,
                              "realizadopor",
                              e.target.value
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
                              item.anombrede?.length || 1,
                              20
                            )}ch`,
                          }}
                          value={
                            localValues[`${id}_anombrede`] ??
                            item.anombrede ??
                            ""
                          }
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${id}_anombrede`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (item.anombrede || "")) {
                              handleFieldChange(
                                id,
                                "anombrede",
                                e.target.value
                              );
                            }
                          }}
                        />
                      </td>
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            className="direccion-fixed-input custom-select-input"
                            type="text"
                            style={{ width: "20ch" }}
                            value={
                              localValues[`${id}_direccion`] ??
                              item.direccion ??
                              ""
                            }
                            onChange={(e) =>
                              setLocalValues((prev) => ({
                                ...prev,
                                [`${id}_direccion`]: e.target.value,
                              }))
                            }
                            onFocus={(e) =>
                              e.target.setAttribute(
                                "list",
                                `direccion-options-${id}`
                              )
                            }
                            onBlur={(e) => {
                              setTimeout(
                                () => e.target.removeAttribute("list"),
                                200
                              );
                              if (e.target.value !== (item.direccion || "")) {
                                handleFieldChange(
                                  id,
                                  "direccion",
                                  e.target.value
                                );
                              }
                            }}
                          />
                          {direccionCounts[(item.direccion || "").trim()] >
                            1 && (
                            <span
                              title="Dirección duplicada"
                              style={{
                                color: "#d9534f",
                                fontWeight: "bold",
                                marginLeft: "6px",
                                fontSize: "1.2em",
                                verticalAlign: "middle",
                              }}
                            >
                              &#9888;
                            </span>
                          )}

                          <datalist
                            id={`direccion-options-${id}`}
                            style={{
                              height: "20px",
                              maxHeight: "20px",
                              overflowY: "auto",
                            }}
                          >
                            {Array.from(
                              new Set(
                                clients
                                  .map((client) => client.direccion)
                                  .filter(Boolean)
                              )
                            )
                              .sort((a, b) => a.localeCompare(b))
                              .map((direccion, index) => (
                                <option key={index} value={direccion} />
                              ))}
                          </datalist>
                        </div>
                      </td>
                      <td style={{ minWidth: "22ch" }}>
                        <select
                          value={item.servicio}
                          style={{ width: "22ch" }}
                          onChange={(e) =>
                            handleFieldChange(id, "servicio", e.target.value)
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
                          <option value="pool">Pool</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ width: "10ch", textAlign: "center" }}
                          value={
                            localValues[`${id}_cubicos`] ?? item.cubicos ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${id}_cubicos`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (item.cubicos || "")) {
                              handleFieldChange(id, "cubicos", e.target.value);
                            }
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ width: "10ch", textAlign: "center" }}
                          value={localValues[`${id}_valor`] ?? item.valor ?? ""}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${id}_valor`]: newValue,
                            }));
                            if (item.metododepago === "efectivo") {
                              setLocalValues((prev) => ({
                                ...prev,
                                [`${id}_efectivo`]: newValue,
                              }));
                            }
                          }}
                          onBlur={(e) => {
                            const newValue = e.target.value;
                            if (newValue !== (item.valor || "")) {
                              handleFieldChange(id, "valor", newValue);
                              if (item.metododepago === "efectivo") {
                                handleFieldChange(id, "efectivo", newValue);
                              }
                            }
                          }}
                        />
                      </td>
                      <td>
                        <select
                          value={item.pago}
                          style={{ width: "12ch" }}
                          onChange={(e) =>
                            handleFieldChange(id, "pago", e.target.value)
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
                          value={item.formadepago}
                          style={{ width: "15ch" }}
                          onChange={(e) =>
                            handleFieldChange(id, "formadepago", e.target.value)
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
                          value={item.banco}
                          style={{ width: "15ch" }}
                          onChange={(e) =>
                            handleFieldChange(id, "banco", e.target.value)
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
                          className="delete-button"
                          style={{ marginLeft: "10px", marginRight: "6px" }}
                          onClick={() => {
                            const direccion =
                              item.direccion || "No especificada";
                            const servicio = item.servicio || "No especificado";
                            Swal.fire({
                              title: "¿Estás seguro de eliminar este servicio?",
                              html: `
                                <div>Esta acción no se puede deshacer.</div>
                                <div style="text-align: left; margin-top: 1em; padding: 8px; background-color: #f5f5f5; border-radius: 4px;">
                                  <strong>Dirección:</strong> ${direccion}<br>
                                  <strong>Servicio:</strong> ${servicio}<br>
                                </div>
                              `,
                              icon: "warning",
                              showCancelButton: true,
                              confirmButtonColor: "#d33",
                              cancelButtonColor: "#3085d6",
                              confirmButtonText: "Sí, eliminar",
                              cancelButtonText: "Cancelar",
                              position: "center",
                              backdrop: "rgba(0,0,0,0.4)",
                              allowOutsideClick: false,
                              allowEscapeKey: false,
                              stopKeydownPropagation: false,
                              heightAuto: false,
                            }).then((result) => {
                              if (result.isConfirmed) {
                                deleteData(id);
                                Swal.fire({
                                  title: "¡Registro eliminado!",
                                  text: "El registro ha sido eliminado exitosamente.",
                                  icon: "success",
                                  position: "center",
                                  backdrop: "rgba(0,0,0,0.4)",
                                  timer: 2000,
                                  showConfirmButton: false,
                                  heightAuto: false,
                                  didOpen: () => {
                                    document.body.style.overflow = "auto";
                                  },
                                  willClose: () => {
                                    document.body.style.overflow = "";
                                  },
                                });
                              }
                            });
                          }}
                        >
                          Eliminar
                        </button>
                      </td>

                      <td>
                        <button
                          style={{
                            border: "none",
                            backgroundColor: "transparent",
                            borderRadius: "0.25em",
                            color: "black",
                            cursor: "pointer",
                            fontSize: "1em",
                            maxWidth: "20ch",
                            textAlign: "left",
                            width: "100%",
                          }}
                          onClick={() => handleNotesClick(id, item.notas)}
                        >
                          {item.notas ? (
                            <p className="texto-ajustable">
                              {item.notas || ""}
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
                          value={item.metododepago || ""}
                          onChange={(e) => {
                            const metodoDePago = e.target.value;
                            handleFieldChange(id, "metododepago", metodoDePago);
                            // si quieres además sincronizar efectivo:
                            if (metodoDePago === "efectivo") {
                              handleFieldChange(
                                id,
                                "efectivo",
                                item.valor || ""
                              );
                            }
                          }}
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
                          style={{ width: "12ch", textAlign: "center" }}
                          value={
                            localValues[`${id}_efectivo`] ?? item.efectivo ?? ""
                          }
                          onChange={(e) =>
                            setLocalValues((prev) => ({
                              ...prev,
                              [`${id}_efectivo`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (item.efectivo || "")) {
                              handleFieldChange(id, "efectivo", e.target.value);
                            }
                          }}
                          disabled={item.metododepago !== "efectivo"}
                        />
                      </td>
                      <td style={{ cursor: "no-drop" }}>
                        <input
                          type="checkbox"
                          readOnly
                          style={{
                            width: "3ch",
                            height: "3ch",
                            marginLeft: "35%",
                            pointerEvents: "none",
                          }}
                          checked={item.factura === true}
                          onChange={(e) =>
                            handleFieldChange(id, "factura", e.target.checked)
                          }
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="no-data">
                  <td colSpan="12">No hay datos disponibles.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de paginación */}
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
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <button
            style={{ backgroundColor: "#5271ff" }}
            onClick={TotalServiciosPorTrabajador}
            className="filter-button"
          >
            Servicios Por Trabajador
          </button>
        </div>
      </div>

      <button className="generate-button1" onClick={generateXLSX}>
        <img className="generate-button-imagen1" src={excel_icon} />
      </button>
      <button className="generate-button2" onClick={generatePDF}>
        <img className="generate-button-imagen2" src={pdf_icon} />
      </button>
      <button
        className="create-table-button"
        onClick={() =>
          addData("", "", "", "", "", "", "", "", "", "", "", "", "")
        }
      >
        +
      </button>
    </div>
  );
};

export default React.memo(Homepage);
