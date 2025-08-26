import React, { useState, useEffect, useRef, useMemo } from "react";
import { database } from "../Database/firebaseConfig";
import {
  ref,
  set,
  onValue,
  onChildRemoved,
  onChildChanged,
  push,
  update,
  remove,
} from "firebase/database";
import { sanitizeForLog } from "../utils/security";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";
import excel_icon from "../assets/img/excel_icon.jpg";
import pdf_icon from "../assets/img/pdf_icon.jpg";
import Select from "react-select";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Swal from "sweetalert2";
import Clock from "./Clock";

// Función para formatear una fecha en "dd-mm-yyyy"
const formatDateWithHyphen = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const Informedeefectivo = () => {
  const [registroFechasData, setRegistroFechasData] = useState([]);
  const [dataData, setDataData] = useState([]);
  const [dataInformedeefectivoData, setInformedeefectivoData] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [directions, setDirections] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadedRegistroFechas, setLoadedRegistroFechas] = useState(false);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedInformeEfectivo, setLoadedInformeEfectivo] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Estados para filtros
  const [filters, setFilters] = useState({
    realizadopor: [],
    direccion: [],
    metododepago: "efectivo",
    fechaInicio: null,
    fechaFin: null,
  });
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const filterSlidebarRef = useRef(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Estados para edición y último id agregado
  const [lastAddedId, setLastAddedId] = useState(null);
  const [editingRows, setEditingRows] = useState({});

  // Estados locales para campos editables (onBlur)
  const [localValues, setLocalValues] = useState({});

  // Alternar modo edición
  const toggleEditRow = (id) => {
    setEditingRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // --- CARGA DE DATOS ---
  // 1) Escuchar "registrofechas" (agenda dinámica)
  useEffect(() => {
    const dbRef = ref(database, "registrofechas");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const allData = snapshot.val();
        const formattedData = Object.entries(allData).flatMap(
          ([fecha, registros]) =>
            Object.entries(registros).map(([id, registro]) => ({
              id,
              fecha,
              origin: "registrofechas",
              // dejamos registro.realizadopor tal cual (contiene la ID)
              realizadopor: registro.realizadopor || "",
              ...registro,
            }))
        );
        setRegistroFechasData(formattedData);
      } else {
        setRegistroFechasData([]);
      }
      setLoadedRegistroFechas(true);
    });
    return () => unsubscribe();
  }, []);

  // 2) Escuchar "data" (servicios de hoy)
  useEffect(() => {
    const dbRef = ref(database, "data");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const allData = snapshot.val();
        const today = formatDateWithHyphen(new Date());
        const formattedData = Object.entries(allData).map(([id, registro]) => ({
          id,
          fecha: today,
          origin: "data",
          // usamos registro.realizadopor directamente
          realizadopor: registro.realizadopor || "",
          ...registro,
        }));
        setDataData(formattedData);
      } else {
        setDataData([]);
      }
      setLoadedData(true);
    });
    return () => unsubscribe();
  }, []);

  // 3) Escuchar "informedeefectivo" (tabla intermedia)
  useEffect(() => {
    const dbRef = ref(database, "informedeefectivo");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const allData = snapshot.val();
        const formattedData = Object.entries(allData).map(([id, registro]) => ({
          id,
          origin: registro.origin || "informedeefectivo",
          // mantenemos registro.realizadopor como ID
          realizadopor: registro.realizadopor || "",
          ...registro,
        }));
        setInformedeefectivoData(formattedData);
      } else {
        setInformedeefectivoData([]);
      }
      setLoadedInformeEfectivo(true);
    });
    return () => unsubscribe();
  }, []);

  // Cargar "users" (excluyendo administradores y contadores)
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
      setLoadedUsers(true);
    });
    return () => unsubscribe();
  }, []);

  // 5) Cargar "clientes" para el datalist de dirección
  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedClients = Object.entries(snapshot.val()).map(
          ([id, client]) => ({
            id,
            direccion: client.direccion,
            cubicos: client.cubicos,
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

  // Actualizar la lista de direcciones combinando todos los registros
  useEffect(() => {
    const newDirections = new Set();
    // Agregar direcciones de todos los datos
    [...registroFechasData, ...dataData, ...dataInformedeefectivoData].forEach((record) => {
      if (record.direccion && record.direccion.trim() !== "") {
        newDirections.add(record.direccion);
      }
    });
    setDirections([...newDirections].sort());
  }, [registroFechasData, dataData, dataInformedeefectivoData]);

  // --- SINCRONIZAR A "informedeefectivo" (bidireccional) ---
  // Desde registrofechas (creación y cambios)
  useEffect(() => {
    registroFechasData.forEach((record) => {
      set(ref(database, `informedeefectivo/${record.id}`), {
        ...record,
        timestamp: record.timestamp ?? Date.now(),
        origin: "registrofechas",
      }).catch((error) => {
        console.error(
          "Error sincronizando registrofechas → informedeefectivo:",
          sanitizeForLog(error.message)
        );
      });
    });
  }, [registroFechasData]);

  // Desde data (creación y cambios)
  useEffect(() => {
    dataData.forEach((record) => {
      set(ref(database, `informedeefectivo/${record.id}`), {
        ...record,
        timestamp: record.timestamp ?? Date.now(),
        origin: "data",
      }).catch((error) => {
        console.error("Error sincronizando data → informedeefectivo:", sanitizeForLog(error.message));
      });
    });
  }, [dataData]);

  // --- PROPAGAR CAMBIOS Y ELIMINACIONES DESDE informedeefectivo ---
  // Actualizaciones
  useEffect(() => {
    const infRef = ref(database, "informedeefectivo");
    const unsubscribeChange = onChildChanged(infRef, (snapshot) => {
      const record = snapshot.val();
      const id = snapshot.key;
      if (record.origin === "registrofechas" && record.fecha) {
        update(
          ref(database, `registrofechas/${record.fecha}/${id}`),
          record
        ).catch((err) => console.error("Error update → registrofechas:", sanitizeForLog(err.message)));
      }
      if (record.origin === "data") {
        update(ref(database, `data/${id}`), record).catch((err) =>
          console.error("Error update → data:", sanitizeForLog(err.message))
        );
      }
    });
    const unsubscribeRemove = onChildRemoved(infRef, (snapshot) => {
      const record = snapshot.val();
      const id = snapshot.key;
      if (record.origin === "registrofechas" && record.fecha) {
        remove(ref(database, `registrofechas/${record.fecha}/${id}`)).catch(
          (err) => console.error("Error remove → registrofechas:", sanitizeForLog(err.message))
        );
      }
      if (record.origin === "data") {
        remove(ref(database, `data/${id}`)).catch((err) =>
          console.error("Error remove → data:", sanitizeForLog(err.message))
        );
      }
    });
    return () => {
      unsubscribeChange();
      unsubscribeRemove();
    };
  }, []);

  // --- PROPAGAR ELIMINACIONES DESDE registrofechas → informedeefectivo ---
  useEffect(() => {
    const registroRef = ref(database, "registrofechas");
    const unsubscribe = onChildRemoved(registroRef, (snapshot) => {
      const removedId = snapshot.key;
      remove(ref(database, `informedeefectivo/${removedId}`)).catch((error) =>
        console.error("Error remove → informedeefectivo:", sanitizeForLog(error.message))
      );
    });
    return () => unsubscribe();
  }, []);

  // --- DEFINICIÓN DE displayedRecords ---
  // Se calculan a partir de dataInformedeefectivoData, mostrando tanto los registros sincronizados
  // como los agregados manualmente y aplicando los filtros.
  const displayedRecords = useMemo(() => {
    const filteredRecords = dataInformedeefectivoData.filter(
      (record) => record.fecha && record.fecha !== "Sin Fecha"
    );
    const filtered = filteredRecords.filter((record) => {
      if (filters.fechaInicio && filters.fechaFin) {
        const [day, month, year] = record.fecha.split("-");
        const itemDate = new Date(year, month - 1, day);
        if (itemDate < filters.fechaInicio || itemDate > filters.fechaFin)
          return false;
      }

      // Filtro para "realizadopor" con soporte para vacíos
      if (filters.realizadopor.length > 0) {
        const matchRealizado = filters.realizadopor.some((filterValue) => {
          if (filterValue === "__EMPTY__") {
            return !record.realizadopor || record.realizadopor.trim() === "";
          }
          return record.realizadopor === filterValue;
        });
        if (!matchRealizado) return false;
      }

      // Filtro para "direccion" con soporte para vacíos
      if (filters.direccion.length > 0) {
        const matchDireccion = filters.direccion.some((filterValue) => {
          if (filterValue === "__EMPTY__") {
            return !record.direccion || record.direccion.trim() === "";
          }
          return record.direccion === filterValue;
        });
        if (!matchDireccion) return false;
      }

      if (filters.metododepago && record.metododepago !== filters.metododepago)
        return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const [dayA, monthA, yearA] = a.fecha.split("-");
      const [dayB, monthB, yearB] = b.fecha.split("-");
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateB - dateA;
    });
  }, [dataInformedeefectivoData, filters]);

  // --- CALCULAR EL SALDO ACUMULADO ---
  // Se ordenan de forma ascendente para calcular el saldo acumulado, luego se invierte el arreglo para la tabla.
  const computedRecords = useMemo(() => {
    const ascRecords = [...displayedRecords].sort((a, b) => {
      const [dA, mA, yA] = a.fecha.split("-");
      const [dB, mB, yB] = b.fecha.split("-");
      const dateA = new Date(parseInt(yA), parseInt(mA) - 1, parseInt(dA));
      const dateB = new Date(parseInt(yB), parseInt(mB) - 1, parseInt(dB));
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }
      return a.timestamp - b.timestamp;
    });
    let runningBalance = 0;
    const withSaldo = ascRecords.map((record) => {
      runningBalance += parseFloat(record.efectivo) || 0;
      return { ...record, saldo: runningBalance };
    });
    return withSaldo.reverse();
  }, [displayedRecords]);

  // Cálculos de paginación
  const totalItems = computedRecords.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = computedRecords.slice(startIndex, endIndex);

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

  // --- FUNCIONALIDAD DE EXPORTACIÓN ---
  const getExportRecords = () => {
    const exportRecords = [];
    for (const rec of computedRecords) {
      if (rec.saldo <= 0) break;
      exportRecords.push(rec);
    }
    return exportRecords;
  };

  // --- ACTUALIZAR CAMPOS CON OPTIMISTIC UPDATE ---
  const handleFieldChange = (fecha, id, field, value, origin) => {
    // Preparamos el objeto de campos a actualizar
    let updateFields = { [field]: value };
    if (field === "realizadopor") {
      updateFields = { realizadopor: value };
    }

    // Función auxiliar que actualiza el estado local y Firebase
    const actualizar = (dataSetter, dbPath) => {
      dataSetter((prev) =>
        prev.map((record) =>
          record.id === id ? { ...record, ...updateFields } : record
        )
      );
      update(ref(database, `${dbPath}/${id}`), updateFields).catch((error) => {
        console.error(`Error updating ${dbPath}: `, error);
      });
    };

    // 1) Registros que vienen de "registrofechas"
    if (origin === "registrofechas") {
      // Estado local de registrofechas
      setRegistroFechasData((prev) =>
        prev.map((record) =>
          record.id === id ? { ...record, ...updateFields } : record
        )
      );
      // Firebase en registrofechas/{fecha}/{id}
      if (fecha && fecha !== "Sin Fecha") {
        update(
          ref(database, `registrofechas/${fecha}/${id}`),
          updateFields
        ).catch((error) => {
          console.error("Error updating registrofechas: ", error);
        });
      }
      // Estado local e intermedia
      actualizar(setInformedeefectivoData, "informedeefectivo");
    }
    // 2) Registros que vienen de "informedeefectivo"
    else if (origin === "informedeefectivo") {
      actualizar(setInformedeefectivoData, "informedeefectivo");
    }
    // 3) Registros que vienen de "data"
    else if (origin === "data") {
      // Actualizamos la rama "data"
      actualizar(setDataData, "data");
      // Y también la intermedia "informedeefectivo"
      actualizar(setInformedeefectivoData, "informedeefectivo");
    }

    // Lógica especial para cuando cambiamos la dirección: sincronizar cúbicos
    if (field === "direccion") {
      const matchingClient = clients.find(
        (client) => client.direccion === value
      );
      if (matchingClient) {
        const updateCubicos = { cubicos: matchingClient.cubicos };

        // Si viene de registrofechas
        if (origin === "registrofechas") {
          // Estado local registrofechas
          setRegistroFechasData((prev) =>
            prev.map((record) =>
              record.id === id ? { ...record, ...updateCubicos } : record
            )
          );
          // Firebase registrofechas/{fecha}/{id}
          if (fecha && fecha !== "Sin Fecha") {
            update(
              ref(database, `registrofechas/${fecha}/${id}`),
              updateCubicos
            ).catch((error) => {
              console.error(
                "Error updating cubicos in registrofechas: ",
                error
              );
            });
          }
          // Estado local e intermedia
          setInformedeefectivoData((prev) =>
            prev.map((record) =>
              record.id === id ? { ...record, ...updateCubicos } : record
            )
          );
          update(ref(database, `informedeefectivo/${id}`), updateCubicos).catch(
            (error) => {
              console.error(
                "Error updating cubicos in informedeefectivo: ",
                error
              );
            }
          );
        }
        // Si viene de informedeefectivo
        else if (origin === "informedeefectivo") {
          setInformedeefectivoData((prev) =>
            prev.map((record) =>
              record.id === id ? { ...record, ...updateCubicos } : record
            )
          );
          update(ref(database, `informedeefectivo/${id}`), updateCubicos).catch(
            (error) => {
              console.error(
                "Error updating cubicos in informedeefectivo: ",
                error
              );
            }
          );
        }
        // Si viene de data
        else if (origin === "data") {
          // Actualizamos cúbicos en data
          setDataData((prev) =>
            prev.map((record) =>
              record.id === id ? { ...record, ...updateCubicos } : record
            )
          );
          update(ref(database, `data/${id}`), updateCubicos).catch((error) => {
            console.error("Error updating cubicos in data: ", error);
          });
          // Y en informedeefectivo
          setInformedeefectivoData((prev) =>
            prev.map((record) =>
              record.id === id ? { ...record, ...updateCubicos } : record
            )
          );
          update(ref(database, `informedeefectivo/${id}`), updateCubicos).catch(
            (error) => {
              console.error(
                "Error updating cubicos in informedeefectivo: ",
                error
              );
            }
          );
        }
      }
    }
  };

  const getUserName = (userId) => {
    const found = users.find((u) => u.id === userId);
    return found ? found.name : "";
  };

  // FUNCION AUXILIAR PARA EXPORTAR REGISTROS EN XLSX
  const generateXLSX = async () => {
    const exportRecords = getExportRecords();
    const exportData = exportRecords.map((item) => ({
      Fecha: item.fecha || "",
      "Realizado Por": getUserName(item.realizadopor) || "",
      Dirección: item.direccion || "",
      "Método de Pago": item.metododepago || "",
      Efectivo: item.efectivo || "",
      Saldo: item.saldo !== undefined ? item.saldo.toFixed(2) : "0.00",
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data");

    const headers = [
      "Fecha",
      "Realizado Por",
      "Dirección",
      "Método de Pago",
      "Efectivo",
      "Saldo",
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
      { width: 15 },
      { width: 20 },
      { width: 30 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
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
    a.download = "Informe De Efectivo.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // FUNCION PARA GENERAR PDF USANDO jsPDF Y autoTable
  const generatePDF = () => {
    const exportRecords = getExportRecords();
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(16);
    doc.text("Informe De Efectivo", 105, 20, { align: "center" });
    doc.setFontSize(10);
    const headers = [
      [
        "Fecha",
        "Realizado Por",
        "Dirección",
        "Método de Pago",
        "Efectivo",
        "Saldo",
      ],
    ];

    const dataRows = exportRecords.map((item) => [
      item.fecha || "",
      getUserName(item.realizadopor) || "",
      item.direccion || "",
      item.metododepago || "",
      item.efectivo || "",
      item.saldo !== undefined ? item.saldo.toFixed(2) : "0.00",
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
    doc.save("Informe De Efectivo.pdf");
  };

  // FUNCION PARA MOSTRAR RESUMEN DE "EFECTIVO TOTAL" POR TRABAJADOR
  const handleEfectivoTotal = () => {
    const filteredData = displayedRecords.filter(
      (record) => record.realizadopor.trim() !== ""
    );

    const totals = {};
    filteredData.forEach((record) => {
      const key = record.realizadopor;
      const efectivoValue = parseFloat(record.efectivo) || 0;
      totals[key] = totals[key] ? totals[key] + efectivoValue : efectivoValue;
    });

    const overallTotal = filteredData.reduce(
      (acc, record) => acc + (parseFloat(record.efectivo) || 0),
      0
    );

    const tableRows = Object.entries(totals)
      .map(([userId, total]) => {
        const userName = getUserName(userId) || "Desconocido";
        return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${userName}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${total.toFixed(
            2
          )}</td>
        </tr>
      `;
      })
      .join("");

    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px;">Trabajador</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Total Efectivo</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${overallTotal.toFixed(
              2
            )}</th>
          </tr>
        </tbody>
      </table>
    `;

    Swal.fire({
      title: "Suma Total De Efectivo Por Trabajador",
      html: tableHTML,
      width: "50%",
      showCloseButton: true,
    });
  };

  // Manejo del rango de fechas
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

  // Slidebar: mostrar/ocultar y detectar clics fuera
  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);
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

  // Slidebar de filtros
  const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);
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

  // FUNCION DE AGREGAR DATOS:
  // Se agrega directamente a la rama "informedeefectivo" (con el origen "informedeefectivo")
  const addData = async (realizadopor, direccion, metododepago, efectivo) => {
    // Se escribe a la rama "data" en vez de "informedeefectivo"
    const dbRef = ref(database, "informedeefectivo");
    const newDataRef = push(dbRef);
    const currentFecha = formatDateWithHyphen(new Date());
    const newData = {
      realizadopor: realizadopor, // aquí guardas la ID
      fecha: currentFecha,
      metododepago,
      efectivo,
      timestamp: Date.now(),
      origin: "informedeefectivo",
    };
    await set(newDataRef, newData).catch((error) => {
      console.error("Error adding data: ", sanitizeForLog(error.message));
    });
    setLastAddedId(newDataRef.key);
  };

  const getMetodoPagoColor = (metododepago) => {
    switch (metododepago) {
      case "efectivo":
        return "purple";
      case "cancelado":
        return "red";
      case "credito":
        return "green";
      default:
        return "transparent";
    }
  };

  useEffect(() => {
    if (
      loadedRegistroFechas &&
      loadedData &&
      loadedInformeEfectivo &&
      loadedUsers &&
      loadedClients
    ) {
      setLoading(false);
    }
  }, [
    loadedRegistroFechas,
    loadedData,
    loadedInformeEfectivo,
    loadedUsers,
    loadedClients,
  ]);

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
      <div
        className="filter-toggle"
        onClick={() => setShowFilterSlidebar(!showFilterSlidebar)}
      >
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
        <label>Realizado Por</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: "__EMPTY__", label: "🚫 Vacío" },
            ...users.map((u) => ({ value: u.id, label: u.name })),
          ]}
          placeholder="Usuario(s)..."
          onChange={(opts) =>
            setFilters((f) => ({
              ...f,
              realizadopor: opts ? opts.map((o) => o.value) : [],
            }))
          }
          value={filters.realizadopor.map((id) => ({
            value: id,
            label:
              id === "__EMPTY__"
                ? "🚫 Vacío"
                : users.find((u) => u.id === id)?.name || id,
          }))}
        />
        <label>Dirección/Nota</label>
        <Select
          isClearable
          isMulti
          options={[
            { value: "__EMPTY__", label: "🚫 Vacío" },
            ...directions.map((direccion) => ({
              value: direccion,
              label: direccion,
            })),
          ]}
          placeholder="Selecciona dirección(es)..."
          onChange={(selectedOptions) =>
            setFilters({
              ...filters,
              direccion: selectedOptions
                ? selectedOptions.map((o) => o.value)
                : [],
            })
          }
          value={filters.direccion.map((dir) => ({
            value: dir,
            label: dir === "__EMPTY__" ? "🚫 Vacío" : dir,
          }))}
        />
        <button
          className="discard-filter-button"
          onClick={() =>
            setFilters({
              realizadopor: [],
              direccion: [],
              metododepago: "efectivo",
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
          <h1 className="title-page">Informe De Efectivo</h1>
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
                <th className="direccion-fixed-th">Dirección/Nota</th>
                <th>Método De Pago</th>
                <th>Efectivo</th>
                <th>Saldo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.length > 0 ? (
                currentPageData.map((registro) => {
                  const isEditable = editingRows[registro.id] || false;
                  return (
                    <tr key={registro.id}>
                      <td
                        style={{
                          minWidth: "75px",
                          textAlign: "center",
                          fontWeight: "bold",
                          justifyContent: "center",
                          backgroundColor:
                            registro.saldo < 0 ? "red" : "transparent",
                          cursor:
                            isEditable &&
                            registro.origin === "informedeefectivo"
                              ? "default"
                              : "default",
                        }}
                      >
                        {registro.origin === "informedeefectivo" &&
                        isEditable ? (
                          <DatePicker
                            selected={
                              registro.fecha
                                ? new Date(
                                    registro.fecha.split("-")[2],
                                    registro.fecha.split("-")[1] - 1,
                                    registro.fecha.split("-")[0]
                                  )
                                : null
                            }
                            onChange={(date) => {
                              const nuevaFecha = formatDateWithHyphen(date);
                              handleFieldChange(
                                registro.fecha,
                                registro.id,
                                "fecha",
                                nuevaFecha,
                                registro.origin
                              );
                            }}
                            dateFormat="dd-MM-yyyy"
                            className="calendar-datepicker"
                            placeholderText="Selecciona fecha"
                          />
                        ) : (
                          registro.fecha
                        )}
                      </td>

                      <td>
                        <select
                          value={registro.realizadopor || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              registro.fecha,
                              registro.id,
                              "realizadopor",
                              e.target.value,
                              registro.origin
                            )
                          }
                          disabled={!isEditable}
                        >
                          <option value=""></option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="direccion-fixed-td">
                        <div className="custom-select-container">
                          <input
                            className="custom-select-input"
                            style={{ width: "18ch" }}
                            type="text"
                            value={localValues[`${registro.id}_direccion`] ?? registro.direccion ?? ""}
                            onChange={(e) =>
                              setLocalValues(prev => ({
                                ...prev,
                                [`${registro.id}_direccion`]: e.target.value
                              }))
                            }
                            onBlur={(e) => {
                              if (e.target.value !== (registro.direccion || "")) {
                                handleFieldChange(
                                  registro.fecha,
                                  registro.id,
                                  "direccion",
                                  e.target.value,
                                  registro.origin
                                );
                              }
                            }}
                            list={`direccion-options-${registro.id}`}
                            disabled={!isEditable}
                          />
                          <datalist id={`direccion-options-${registro.id}`}>
                            {clients.map((client, idx) => (
                              <option key={idx} value={client.direccion}>
                                {client.direccion}
                              </option>
                            ))}
                          </datalist>
                        </div>
                      </td>
                      <td
                        style={{
                          backgroundColor: getMetodoPagoColor(
                            registro.metododepago
                          ),
                          textAlign: "center",
                        }}
                      >
                        <select
                          value={registro.metododepago || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              registro.fecha,
                              registro.id,
                              "metododepago",
                              e.target.value,
                              registro.origin
                            )
                          }
                          disabled
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
                          value={localValues[`${registro.id}_efectivo`] ?? registro.efectivo ?? ""}
                          onChange={(e) =>
                            setLocalValues(prev => ({
                              ...prev,
                              [`${registro.id}_efectivo`]: e.target.value
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (registro.efectivo || "")) {
                              handleFieldChange(
                                registro.fecha,
                                registro.id,
                                "efectivo",
                                e.target.value,
                                registro.origin
                              );
                            }
                          }}
                          disabled={
                            !isEditable || registro.metododepago !== "efectivo"
                          }
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {registro.saldo !== undefined
                          ? registro.saldo.toFixed(2)
                          : "0.00"}
                      </td>
                      <td style={{ minWidth: "28ch" }}>
                        {registro.origin === "informedeefectivo" && (
                          <>
                            <button
                              style={{}}
                              onClick={() => toggleEditRow(registro.id)}
                              className={`edit-button ${
                                isEditable ? "editable" : "not-editable"
                              }`}
                            >
                              {isEditable ? "✔" : "Editar"}
                            </button>
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
                                    remove(
                                      ref(
                                        database,
                                        `informedeefectivo/${registro.id}`
                                      )
                                    ).catch((err) =>
                                      console.error("Error al eliminar:", sanitizeForLog(err.message))
                                    );
                                  }
                                });
                              }}
                            >
                              Borrar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7">No hay datos disponibles.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Controles de paginación */}
        <div className="pagination-container">
        <div className="pagination-info">
          <span>
            Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems} registros
          </span>
          <div className="items-per-page">
            <label>Mostrar:</label>
            <select 
              value={itemsPerPage} 
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
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
          <button className="filter-button" onClick={handleEfectivoTotal}>
            Efectivo Total
          </button>
        </div>
      </div>
      <button className="generate-button1" onClick={generateXLSX}>
        <img className="generate-button-imagen1" src={excel_icon} alt="Excel" />
      </button>
      <button className="generate-button2" onClick={generatePDF}>
        <img className="generate-button-imagen2" src={pdf_icon} alt="PDF" />
      </button>
      <button
        className="create-table-button"
        onClick={() => addData("", "", "efectivo", "")}
      >
        +
      </button>
    </div>
  );
};

export default Informedeefectivo;
