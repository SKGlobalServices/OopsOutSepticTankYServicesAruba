import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { database } from "../Database/firebaseConfig";
import { ref, push, onValue, set, update, remove } from "firebase/database";
import { jsPDF } from "jspdf";
import Swal from "sweetalert2";
import "react-datepicker/dist/react-datepicker.css";
import ExcelJS from "exceljs";
import autoTable from "jspdf-autotable";
import filtericon from "../assets/img/filters_icon.jpg";
import excel_icon from "../assets/img/excel_icon.jpg";
import pdf_icon from "../assets/img/pdf_icon.jpg";
import informeEfectivoIcon2 from "../assets/img/informeEfectivoIcon2.png";
import logosolo from "../assets/img/logosolo.png";
import logo from "../assets/img/logo.png";
import Slidebar from "./Slidebar";
import Clock from "./Clock";

const Nomina = () => {
  const [loading, setLoading] = useState(false);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
  const slidebarRef = useRef(null);
  const filterSlidebarRef = useRef(null);

  // Estados para nómina
  const [nominas, setNominas] = useState([]);
  const [currentNomina, setCurrentNomina] = useState(null);
  const [nominaData, setNominaData] = useState([]);
  const [users, setUsers] = useState([]);
  const [extras, setExtras] = useState([]);
  const [deducciones, setDeducciones] = useState([]);
  const [informeEfectivo, setInformeEfectivo] = useState([]);
  const [showInitialDialog, setShowInitialDialog] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [closingMode, setClosingMode] = useState(false);
  const [lockedRecords, setLockedRecords] = useState({});
  const [hasSelectedRecords, setHasSelectedRecords] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    nomina: "",
    nombre: [],
  });

  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);
  const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);

  // Cargar datos iniciales (sin loader)
  useEffect(() => {
    const unsubscribers = [];

    const loadData = async () => {
      try {
        // Cargar usuarios
        const usersRef = ref(database, "users");
        const usersUnsubscribe = onValue(usersRef, (snapshot) => {
          if (snapshot.exists()) {
            const usersData = snapshot.val();
            const usersList = Object.entries(usersData)
              .filter(
                ([, user]) =>
                  user.role !== "usernotactive" && user.name !== "IT"
              )
              .map(([id, user]) => ({ id, name: user.name }));
            setUsers(usersList.sort((a, b) => a.name.localeCompare(b.name)));
          }
        });
        unsubscribers.push(usersUnsubscribe);

        // Cargar extras
        const extrasRef = ref(database, "extras");
        const extrasUnsubscribe = onValue(extrasRef, (snapshot) => {
          if (snapshot.exists()) {
            const extrasData = snapshot.val();
            const extrasList = Object.entries(extrasData).map(
              ([id, extra]) => ({ id, ...extra })
            );
            setExtras(extrasList);
          }
        });
        unsubscribers.push(extrasUnsubscribe);

        // Cargar deducciones
        const deduccionesRef = ref(database, "deducciones");
        const deduccionesUnsubscribe = onValue(deduccionesRef, (snapshot) => {
          if (snapshot.exists()) {
            const deduccionesData = snapshot.val();
            const deduccionesList = Object.entries(deduccionesData).map(
              ([id, deduccion]) => ({ id, ...deduccion })
            );
            setDeducciones(deduccionesList);
          }
        });
        unsubscribers.push(deduccionesUnsubscribe);

        // Cargar informe de efectivo
        const efectivoRef = ref(database, "informedeefectivo");
        const efectivoUnsubscribe = onValue(efectivoRef, (snapshot) => {
          if (snapshot.exists()) {
            const efectivoData = snapshot.val();
            const efectivoList = Object.entries(efectivoData).map(
              ([id, item]) => ({ id, ...item })
            );
            setInformeEfectivo(efectivoList);
          }
        });
        unsubscribers.push(efectivoUnsubscribe);

        // Cargar nóminas
        const nominasRef = ref(database, "nominas");
        const nominasUnsubscribe = onValue(nominasRef, (snapshot) => {
          if (snapshot.exists()) {
            const nominasData = snapshot.val();
            const nominasList = Object.entries(nominasData).map(
              ([id, nomina]) => ({ id, ...nomina })
            );
            setNominas(
              nominasList.sort(
                (a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion)
              )
            );
          } else {
            setNominas([]);
          }
        });
        unsubscribers.push(nominasUnsubscribe);

        setDataLoaded(true);
      } catch (error) {
        console.error("Error loading data:", error);
        setDataLoaded(true);
      }
    };

    loadData();

    // Cleanup function
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

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

  // Mostrar diálogo inicial después de cargar datos
  useEffect(() => {
    if (dataLoaded && showInitialDialog) {
      showNominaDialog();
    }
  }, [dataLoaded, showInitialDialog]);

  // Limpiar SweetAlert al desmontar el componente
  useEffect(() => {
    return () => {
      if (Swal.isVisible()) {
        Swal.close();
      }
    };
  }, []);

  // --- Parser de fechas DD-MM-YYYY a Date
  const parseDDMMYYYY = (ddmmyyyy) => {
    if (!ddmmyyyy) return null;
    const [d, m, y] = ddmmyyyy.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  // === EFECTIVO RECOMENDADO ===
  // Suma todo el efectivo para el usuario HASTA la fechaHasta (inclusive), sin filtrar por fechaDesde.
  const calculateEfectivoUpToDate = useCallback(
    (userId, fechaHastaDDMM) => {
      if (!userId || !fechaHastaDDMM) return 0;

      const hasta = parseDDMMYYYY(fechaHastaDDMM);
      if (!hasta) return 0;

      return informeEfectivo
        .filter((item) => {
          if (item.realizadopor !== userId) return false;
          if (String(item.metododepago).toLowerCase() !== "efectivo")
            return false;
          const f = parseDDMMYYYY(item.fecha); // DD-MM-YYYY
          return f && f <= hasta;
        })
        .reduce((acc, it) => acc + (parseFloat(it.efectivo) || 0), 0);
    },
    [informeEfectivo]
  );

  // Calcular extras para un usuario en un rango de fechas
  const calculateExtrasForUser = useCallback(
    (userId, fechaDesde, fechaHasta) => {
      const userExtras = extras.filter((extra) => {
        if (extra.realizado !== userId) return false;

        const [day, month, year] = extra.fecha.split("-");
        const extraDate = new Date(year, month - 1, day);
        const desde = new Date(
          fechaDesde.split("-")[2],
          fechaDesde.split("-")[1] - 1,
          fechaDesde.split("-")[0]
        );
        const hasta = new Date(
          fechaHasta.split("-")[2],
          fechaHasta.split("-")[1] - 1,
          fechaHasta.split("-")[0]
        );

        return extraDate >= desde && extraDate <= hasta;
      });

      return userExtras.reduce(
        (total, extra) => total + (parseFloat(extra.valor) || 0),
        0
      );
    },
    [extras]
  );

  // Calcular deducciones para un usuario en un rango de fechas
  const calculateDeduccionesForUser = useCallback(
    (userId, fechaDesde, fechaHasta) => {
      const userDeducciones = deducciones.filter((deduccion) => {
        if (deduccion.realizado !== userId) return false;

        const [day, month, year] = deduccion.fecha.split("-");
        const deduccionDate = new Date(year, month - 1, day);
        const desde = new Date(
          fechaDesde.split("-")[2],
          fechaDesde.split("-")[1] - 1,
          fechaDesde.split("-")[0]
        );
        const hasta = new Date(
          fechaHasta.split("-")[2],
          fechaHasta.split("-")[1] - 1,
          fechaHasta.split("-")[0]
        );

        return deduccionDate >= desde && deduccionDate <= hasta;
      });

      return userDeducciones.reduce(
        (total, deduccion) => total + (parseFloat(deduccion.valor) || 0),
        0
      );
    },
    [deducciones]
  );

  // Calcular efectivo total histórico (sin rango) — se mantiene para el botón extra
  const calculateEfectivoForUser = useCallback(
    (userId) => {
      const userEfectivo = informeEfectivo.filter(
        (item) =>
          item.realizadopor === userId && item.metododepago === "efectivo"
      );

      const sortedEfectivo = userEfectivo.sort((a, b) => {
        const [dA, mA, yA] = a.fecha.split("-");
        const [dB, mB, yB] = b.fecha.split("-");
        const dateA = new Date(yA, mA - 1, dA);
        const dateB = new Date(yB, mB - 1, dB);
        return dateA - dateB;
      });

      let saldo = 0;
      sortedEfectivo.forEach((item) => {
        saldo += parseFloat(item.efectivo) || 0;
      });

      return saldo;
    },
    [informeEfectivo]
  );

  // Diálogo inicial
  const showNominaDialog = () => {
    Swal.fire({
      title: "Gestión de Nómina",
      text: "¿Qué deseas hacer?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Crear Nueva Nómina",
      cancelButtonText: "Ver Nómina Anterior",
      allowOutsideClick: false,
      allowEscapeKey: false,
      backdrop: true,
      customClass: {
        popup: "swal-wide",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        showDateRangeDialog();
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        loadLastNomina();
      } else {
        setShowInitialDialog(false);
      }
    });
  };

  // Diálogo de rango de fechas
  const showDateRangeDialog = () => {
    Swal.fire({
      title: "Seleccionar Rango de Fechas",
      html: `
        <div style="
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
          font-family: Arial, sans-serif;
        ">
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          ">
            <label style="
              font-weight: bold;
              font-size: 16px;
              color: #333;
            ">Fecha Desde:</label>
            <input 
              type="date" 
              id="fechaDesde" 
              style="
                padding: 12px;
                border: 2px solid #ddd;
                border-radius: 8px;
                font-size: 14px;
                width: 200px;
                text-align: center;
                transition: border-color 0.3s ease;
              " 
            />
          </div>
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          ">
            <label style="
              font-weight: bold;
              font-size: 16px;
              color: #333;
            ">Fecha Hasta:</label>
            <input 
              type="date" 
              id="fechaHasta" 
              style="
                padding: 12px;
                border: 2px solid #ddd;
                border-radius: 8px;
                font-size: 14px;
                width: 200px;
                text-align: center;
                transition: border-color 0.3s ease;
              " 
            />
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Continuar",
      cancelButtonText: "Volver",
      allowOutsideClick: false,
      allowEscapeKey: false,
      backdrop: true,
      customClass: {
        popup: "swal-wide",
      },
      preConfirm: () => {
        const desde = document.getElementById("fechaDesde").value;
        const hasta = document.getElementById("fechaHasta").value;

        if (!desde || !hasta) {
          Swal.showValidationMessage("Debes seleccionar ambas fechas");
          return false;
        }

        if (new Date(desde) > new Date(hasta)) {
          Swal.showValidationMessage(
            'La fecha "Desde" no puede ser mayor que "Hasta"'
          );
          return false;
        }

        return { desde, hasta };
      },
      didOpen: () => {
        const confirmButton = Swal.getConfirmButton();
        const cancelButton = Swal.getCancelButton();
        confirmButton.disabled = true;

        const fechaDesdeInput = document.getElementById("fechaDesde");
        const fechaHastaInput = document.getElementById("fechaHasta");

        const checkDates = () => {
          const desde = fechaDesdeInput.value;
          const hasta = fechaHastaInput.value;
          const isValid = desde && hasta && new Date(desde) <= new Date(hasta);

          confirmButton.disabled = !isValid;

          if (desde && hasta && new Date(desde) > new Date(hasta)) {
            fechaHastaInput.style.borderColor = "#ff4444";
          } else {
            fechaHastaInput.style.borderColor = "#ddd";
          }
        };

        fechaDesdeInput.addEventListener("change", checkDates);
        fechaHastaInput.addEventListener("change", checkDates);

        // Focus en el primer input
        fechaDesdeInput.focus();
      },
    }).then((result) => {
      if (result.isConfirmed) {
        createNewNomina(result.value.desde, result.value.hasta);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        showNominaDialog();
      } else {
        setShowInitialDialog(false);
      }
    });
  };

  // Crear nueva nómina
  const createNewNomina = async (fechaDesde, fechaHasta) => {
    setLoading(true);
    try {
      const nominaId = `${fechaDesde}_${fechaHasta}`;

      // Convertir fechas del formato YYYY-MM-DD a DD-MM-YYYY
      const convertirFecha = (fechaISO) => {
        const [year, month, day] = fechaISO.split("-");
        return `${day}-${month}-${year}`;
      };

      const newNomina = {
        id: nominaId,
        fechaDesde: convertirFecha(fechaDesde),
        fechaHasta: convertirFecha(fechaHasta),
        fechaCreacion: new Date().toISOString(),
        registros: {},
      };

      await set(ref(database, `nominas/${nominaId}`), newNomina);
      setCurrentNomina(newNomina);
      setNominaData([]);
      setShowInitialDialog(false);

      setTimeout(() => {
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Error creating nomina:", error);
      setLoading(false);
      Swal.fire({
        title: "Error",
        text: "No se pudo crear la nómina",
        icon: "error",
        confirmButtonText: "Entendido",
        customClass: {
          popup: "swal-wide",
        },
      });
    }
  };

  // Cargar última nómina
  const loadLastNomina = () => {
    const nominasRef = ref(database, "nominas");
    onValue(
      nominasRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const nominasData = snapshot.val();
          const nominasList = Object.entries(nominasData).map(
            ([id, nomina]) => ({ id, ...nomina })
          );
          const sortedNominas = nominasList.sort(
            (a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion)
          );

          if (sortedNominas.length > 0) {
            setLoading(true);
            const lastNomina = sortedNominas[0];

            if (!lastNomina.fechaDesde || !lastNomina.fechaHasta) {
              Swal.fire(
                "Error",
                "La nómina encontrada tiene datos inválidos",
                "error"
              ).then(() => {
                showDateRangeDialog();
              });
              return;
            }

            setCurrentNomina(lastNomina);

            if (lastNomina.registros) {
              const registrosList = Object.entries(lastNomina.registros).map(
                ([id, registro]) => ({ id, ...registro })
              );
              setNominaData(registrosList);
            } else {
              setNominaData([]);
            }

            setShowInitialDialog(false);

            setTimeout(() => {
              setLoading(false);
            }, 1000);
          } else {
            Swal.fire({
              title: "Info",
              text: "No hay nóminas anteriores",
              icon: "info",
              confirmButtonText: "Crear Nueva Nómina",
              allowOutsideClick: false,
              customClass: {
                popup: "swal-wide",
              },
            }).then(() => {
              showDateRangeDialog();
            });
          }
        } else {
          Swal.fire({
            title: "Info",
            text: "No hay nóminas anteriores",
            icon: "info",
            confirmButtonText: "Crear Nueva Nómina",
            allowOutsideClick: false,
            customClass: {
              popup: "swal-wide",
            },
          }).then(() => {
            showDateRangeDialog();
          });
        }
      },
      { onlyOnce: true }
    );
  };

  // Agregar registro a nómina
  const addNominaRecord = async () => {
    if (!currentNomina || !currentNomina.id) {
      Swal.fire({
        title: "Error",
        text: "No hay una nómina seleccionada",
        icon: "error",
        confirmButtonText: "Entendido",
        customClass: {
          popup: "swal-wide",
        },
      });
      return;
    }

    try {
      const newRecord = {
        nombre: "",
        dias: 0,
        valor: 0,
        totalQuincena: 0,
        extra: 0,
        deducciones: 0,
        totalNomina: 0,
        efectivo: 0, // ← editable, se rellenará recomendado al elegir nombre
        total: 0,
        entregado: 0,
        timestamp: Date.now(),
      };

      const recordRef = push(
        ref(database, `nominas/${currentNomina.id}/registros`)
      );
      await set(recordRef, newRecord);
    } catch (error) {
      console.error("Error adding record:", error);
      Swal.fire({
        title: "Error",
        text: "No se pudo agregar el registro",
        icon: "error",
        confirmButtonText: "Entendido",
        customClass: {
          popup: "swal-wide",
        },
      });
    }
  };

  // Actualizar campo de registro
  const updateNominaField = async (recordId, field, value) => {
    if (!currentNomina) return;

    // Verificar si el registro está bloqueado
    if (lockedRecords[recordId]) {
      return;
    }

    try {
      let updateData = { [field]: value };
      const currentRecord = nominaData.find((r) => r.id === recordId);

      if (field === "nombre") {
        // Calcula extras y deducciones por RANGO
        const extraValue = calculateExtrasForUser(
          value,
          currentNomina.fechaDesde, // DD-MM-YYYY
          currentNomina.fechaHasta // DD-MM-YYYY
        );
        const deduccionesValue = calculateDeduccionesForUser(
          value,
          currentNomina.fechaDesde,
          currentNomina.fechaHasta
        );

        // EFECTIVO RECOMENDADO = suma hasta el último día de la nómina (fechaHasta)
        const efectivoRecommended = calculateEfectivoUpToDate(
          value,
          currentNomina.fechaHasta
        );

        updateData.extra = extraValue;
        updateData.deducciones = deduccionesValue;
        updateData.efectivo = efectivoRecommended; // ← valor recomendado por defecto
      }

      if (field === "dias" || field === "valor") {
        const dias =
          field === "dias"
            ? parseFloat(value) || 0
            : parseFloat(currentRecord.dias) || 0;
        const valor =
          field === "valor"
            ? parseFloat(value) || 0
            : parseFloat(currentRecord.valor) || 0;
        updateData.totalQuincena = dias * valor;
      }

      // Si cambia el efectivo manualmente, recalcular el saldo inicial (total)
      if (field === "efectivo") {
        const totalNomina = parseFloat(currentRecord.totalNomina) || 0;
        updateData.total = totalNomina - (parseFloat(value) || 0);
      }

      // Recalcular total nómina
      const totalQuincena =
        updateData.totalQuincena !== undefined
          ? updateData.totalQuincena
          : parseFloat(currentRecord.totalQuincena) || 0;
      const extra =
        updateData.extra !== undefined
          ? updateData.extra
          : parseFloat(currentRecord.extra) || 0;
      const deducciones =
        updateData.deducciones !== undefined
          ? updateData.deducciones
          : field === "deducciones"
          ? parseFloat(value) || 0
          : parseFloat(currentRecord.deducciones) || 0;
      const efectivo =
        updateData.efectivo !== undefined
          ? updateData.efectivo
          : parseFloat(currentRecord.efectivo) || 0;

      updateData.totalNomina = totalQuincena + extra - deducciones;
      // Saldo inicial = Total nómina - Efectivo por entregar
      updateData.total = updateData.totalNomina - efectivo;

      await update(
        ref(database, `nominas/${currentNomina.id}/registros/${recordId}`),
        updateData
      );

      // Actualizar estado local
      setNominaData((prev) =>
        prev.map((record) =>
          record.id === recordId ? { ...record, ...updateData } : record
        )
      );
    } catch (error) {
      console.error("Error updating field:", error);
    }
  };

  // Colocar el TOTAL de efectivo (histórico, sin rango) en un registro (botón)
  const setEfectivoTotal = async (recordId) => {
    if (!currentNomina) return;

    if (lockedRecords[recordId]) return;

    try {
      const currentRecord = nominaData.find((r) => r.id === recordId);
      if (!currentRecord) return;

      const userId = currentRecord.nombre;
      if (!userId) {
        await Swal.fire({
          title: "Falta seleccionar empleado",
          text: "Primero elige un empleado para poder traer su efectivo total.",
          icon: "info",
          confirmButtonText: "Entendido",
          customClass: { popup: "swal-wide" },
        });
        return;
      }

      const totalEfectivo = calculateEfectivoForUser(userId);
      const totalNomina = parseFloat(currentRecord.totalNomina) || 0;
      const saldoInicial = totalNomina - (parseFloat(totalEfectivo) || 0);

      await update(
        ref(database, `nominas/${currentNomina.id}/registros/${recordId}`),
        {
          efectivo: totalEfectivo,
          total: saldoInicial,
        }
      );

      setNominaData((prev) =>
        prev.map((r) =>
          r.id === recordId
            ? { ...r, efectivo: totalEfectivo, total: saldoInicial }
            : r
        )
      );

      Swal.fire({
        title: "Actualizado",
        text: "Efectivo total (sin rango) aplicado y saldo recalculado.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: "swal-wide" },
      });
    } catch (err) {
      console.error("Error setting efectivo total:", err);
      Swal.fire({
        title: "Error",
        text: "No se pudo aplicar el efectivo total.",
        icon: "error",
        confirmButtonText: "Entendido",
        customClass: { popup: "swal-wide" },
      });
    }
  };

  // Eliminar registro
  const deleteNominaRecord = async (recordId) => {
    if (!currentNomina) return;

    const result = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      allowOutsideClick: false,
      customClass: {
        popup: "swal-wide",
      },
    });

    if (result.isConfirmed) {
      try {
        await remove(
          ref(database, `nominas/${currentNomina.id}/registros/${recordId}`)
        );
        setNominaData((prev) =>
          prev.filter((record) => record.id !== recordId)
        );

        Swal.fire({
          title: "Eliminado",
          text: "El registro ha sido eliminado correctamente",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error("Error deleting record:", error);
        Swal.fire({
          title: "Error",
          text: "No se pudo eliminar el registro",
          icon: "error",
          confirmButtonText: "Entendido",
        });
      }
    }
  };

  // Manejar bloqueo/desbloqueo de registros
  const handleRecordLock = async (recordId, isLocked) => {
    if (!isLocked && lockedRecords[recordId]) {
      const result = await Swal.fire({
        title: "Advertencia",
        text: "Si cambias el campo de nombre, los campos de Efectivo Por Entregar, Total Deducciones y Total Extras traerán los datos actuales.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Confirmar",
        cancelButtonText: "Cancelar",
        allowOutsideClick: false,
        customClass: {
          popup: "swal-wide",
        },
      });

      if (!result.isConfirmed) {
        return;
      }
    }

    const newLockedRecords = {
      ...lockedRecords,
      [recordId]: isLocked,
    };

    setLockedRecords(newLockedRecords);

    if (closingMode) {
      const hasSelected = Object.values(newLockedRecords).some(
        (locked) => locked
      );
      setHasSelectedRecords(hasSelected);
    }
  };

  // Alternar modo cerrar nómina
  const toggleClosingMode = async () => {
    if (closingMode) {
      const hasLockedRecords = Object.values(lockedRecords).some(
        (locked) => locked
      );
      if (hasLockedRecords) {
        const result = await Swal.fire({
          title: "Advertencia",
          text: "Si cambias el campo de nombre, los campos de Efectivo Por Entregar, Total Deducciones y Total Extras traerán los datos actuales.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Confirmar",
          cancelButtonText: "Cancelar",
          allowOutsideClick: false,
          customClass: {
            popup: "swal-wide",
          },
        });

        if (!result.isConfirmed) {
          return;
        }
      }
      setLockedRecords({});
      setHasSelectedRecords(false);
    }
    setClosingMode(!closingMode);
  };

  // Confirmar cierre de nómina
  const confirmClosingNomina = async () => {
    const selectedRecords = Object.keys(lockedRecords).filter(
      (recordId) => lockedRecords[recordId]
    );

    if (selectedRecords.length === 0) {
      Swal.fire({
        title: "Sin selección",
        text: "Debe seleccionar al menos un registro para cerrar.",
        icon: "warning",
        confirmButtonText: "Entendido",
        customClass: {
          popup: "swal-wide",
        },
      });
      return;
    }

    const result = await Swal.fire({
      title: "Confirmar Cierre",
      text: `¿Está seguro de cerrar ${selectedRecords.length} registro(s)? Los registros cerrados no podrán ser editados.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, cerrar",
      cancelButtonText: "Cancelar",
      allowOutsideClick: false,
      customClass: {
        popup: "swal-wide",
      },
    });

    if (result.isConfirmed) {
      const finalLockedRecords = {};
      selectedRecords.forEach((recordId) => {
        finalLockedRecords[recordId] = true;
      });

      setLockedRecords(finalLockedRecords);
      setClosingMode(false);
      setHasSelectedRecords(false);

      Swal.fire({
        title: "Cierre Confirmado",
        text: `${selectedRecords.length} registro(s) han sido cerrados exitosamente.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          popup: "swal-wide",
        },
      });
    }
  };

  // Seleccionar/deseleccionar todos los registros
  const handleSelectAll = async (selectAll) => {
    if (selectAll) {
      const newLockedRecords = {};
      visibleRows.forEach((record) => {
        newLockedRecords[record.id] = true;
      });
      setLockedRecords(newLockedRecords);
      if (closingMode) {
        setHasSelectedRecords(true);
      }
    } else {
      const hasLockedRecords = Object.values(lockedRecords).some(
        (locked) => locked
      );
      if (hasLockedRecords) {
        const result = await Swal.fire({
          title: "Advertencia",
          text: "Si cambias el campo de nombre, los campos de Efectivo Por Entregar, Total Deducciones y Total Extras traerán los datos actuales.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Confirmar",
          cancelButtonText: "Cancelar",
          allowOutsideClick: false,
          customClass: {
            popup: "swal-wide",
          },
        });

        if (!result.isConfirmed) {
          return;
        }
      }

      setLockedRecords({});
      if (closingMode) {
        setHasSelectedRecords(false);
      }
    }
  };

  // Cargar datos de nómina cuando cambia la nómina actual
  useEffect(() => {
    if (currentNomina && currentNomina.id) {
      const nominaRef = ref(database, `nominas/${currentNomina.id}/registros`);
      const unsubscribe = onValue(nominaRef, (snapshot) => {
        if (snapshot.exists()) {
          const registrosData = snapshot.val();
          const registrosList = Object.entries(registrosData).map(
            ([id, registro]) => ({ id, ...registro })
          );
          setNominaData(registrosList);
        } else {
          setNominaData([]);
        }
      });
      return () => unsubscribe();
    } else {
      setNominaData([]);
    }
  }, [currentNomina?.id]);

  // Helper para obtener nombre de usuario
  const getUserName = (userId) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.name : "";
  };

  // Helper para obtener nombre de usuario con fallback
  const getUserNameWithFallback = (record) => {
    return (
      users.find((u) => u.id === record.nombre)?.name ||
      users.find((u) => u.name === record.nombre)?.name ||
      "Sin asignar"
    );
  };

  // Exportar a Excel
  const generateXLSX = async () => {
    if (!currentNomina) return;
    if (visibleRows.length === 0) {
      Swal.fire({
        title: "Sin datos",
        text: "No hay filas visibles para exportar.",
        icon: "info",
        confirmButtonText: "Entendido",
        customClass: {
          popup: "swal-wide",
        },
      });
      return;
    }
    const exportData = visibleRows.map((record) => {
      return {
        Nombre: getUserNameWithFallback(record),
        Días: Number(record.dias || 0),
        Valor: Number(record.valor || 0),
        "Total Quincena": Number(record.totalQuincena || 0),
        Extra: Number(record.extra || 0),
        Deducciones: Number(record.deducciones || 0),
        "Total Nómina": Number(record.totalNomina || 0),
        Efectivo: Number(record.efectivo || 0),
        Total: Number(record.total || 0),
        Entregado: Number(record.entregado || 0),
        "Total Final": Number((record.total || 0) - (record.entregado || 0)),
      };
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Nómina");

    const headers = [
      "Nombre",
      "Días",
      "Valor",
      "Total Quincena",
      "Extra",
      "Deducciones",
      "Total Nómina",
      "Efectivo",
      "Total",
      "Entregado",
      "Total Final",
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
      { width: 8 },
      { width: 12 },
      { width: 15 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
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
    a.download = `Nomina_${currentNomina?.fechaDesde || ""}_${
      currentNomina?.fechaHasta || ""
    }.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generar PDF de nómina individual
  const generatePDFnomina = async () => {
    if (!currentNomina) return;
    if (visibleRows.length === 0) {
      Swal.fire({
        title: "Sin datos",
        text: "No hay registros para generar PDFs de nómina.",
        icon: "info",
        confirmButtonText: "Entendido",
        customClass: {
          popup: "swal-wide",
        },
      });
      return;
    }

    const empleados = visibleRows
      .map((record) => {
        const userName = getUserNameWithFallback(record);
        return {
          id: record.nombre,
          name: userName === "Sin asignar" ? "Sin nombre" : userName,
          record: record,
        };
      })
      .filter((emp) => emp.name !== "Sin nombre");

    if (empleados.length === 0) {
      Swal.fire({
        title: "Sin datos",
        text: "No hay empleados válidos para generar PDFs.",
        icon: "info",
        confirmButtonText: "Entendido",
        customClass: {
          popup: "swal-wide",
        },
      });
      return;
    }

    const { value: selectedEmployees } = await Swal.fire({
      title:
        '<i class="fas fa-file-pdf" style="color: #dc3545;"></i> Generar PDF de Nómina',
      html: `
        <div style="
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 450px;
          margin: 0 auto;
          padding: 20px;
        ">
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
          ">
            <button id="select-all-btn" style="
              padding: 12px 16px;
              background: linear-gradient(135deg, #007bff, #0056b3);
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.3s ease;
              box-shadow: 0 2px 4px rgba(0,123,255,0.3);
            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0,123,255,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,123,255,0.3)'">
              ✓ Seleccionar Todos
            </button>
            <button id="clear-all-btn" style="
              padding: 12px 16px;
              background: linear-gradient(135deg, #dc3545, #c82333);
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.3s ease;
              box-shadow: 0 2px 4px rgba(220,53,69,0.3);
            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(220,53,69,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(220,53,69,0.3)'">
              ✕ Limpiar Todo
            </button>
          </div>
            <div id="employee-list" style="
              max-height: 300px;
              overflow-y: auto;
              background: white;
              border-radius: 8px;
              border: 1px solid #dee2e6;
            ">
              ${empleados
                .map(
                  (emp, index) => `
                <div style="
                  display: flex;
                  align-items: center;
                  padding: 0;
                  margin: 0;
                  ${
                    index !== empleados.length - 1
                      ? "border-bottom: 1px solid #f1f3f4;"
                      : ""
                  }
                  transition: all 0.3s ease;
                  position: relative;
                ">
                  <label style="
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: 14px 16px;
                    margin: 0;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                  " onmouseover="
                    this.style.backgroundColor='#e3f2fd';
                    this.style.transform='translateX(4px)';
                    this.querySelector('.employee-name').style.color='#1565c0';
                    this.querySelector('.employee-name').style.fontWeight='600';
                  " onmouseout="
                    this.style.backgroundColor='transparent';
                    this.style.transform='translateX(0)';
                    this.querySelector('.employee-name').style.color='#495057';
                    this.querySelector('.employee-name').style.fontWeight='500';
                  ">
                    <input type="checkbox" value="${
                      emp.id
                    }" class="employee-checkbox" style="
                      width: 18px;
                      height: 18px;
                      margin-right: 14px;
                      accent-color: #007bff;
                      cursor: pointer;
                      border-radius: 3px;
                    ">
                    <div style="
                      display: flex;
                      align-items: center;
                      flex: 1;
                    ">
                      <span style="
                        width: 32px;
                        height: 32px;
                        background: linear-gradient(135deg, #007bff, #0056b3);
                        color: white;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 14px;
                        margin-right: 12px;
                        flex-shrink: 0;
                      ">${emp.name.charAt(0).toUpperCase()}</span>
                      <span class="employee-name" style="
                        font-size: 16px;
                        color: #495057;
                        font-weight: 500;
                        transition: all 0.3s ease;
                        flex: 1;
                        text-align: left;
                      ">${emp.name}</span>
                    </div>
                  </label>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
          
          <div style="
            padding: 12px;
            background: linear-gradient(135deg, #28a745, #20c997);
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(40,167,69,0.2);
          ">
            <span id="selection-count" style="
              font-size: 15px;
              color: white;
              font-weight: 700;
              text-shadow: 0 1px 2px rgba(0,0,0,0.1);
            ">📋 0 empleados seleccionados</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-download"></i> Generar PDFs',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      allowOutsideClick: false,
      buttonsStyling: true,
      customClass: {
        popup: "swal-wide",
        confirmButton: "btn btn-success btn-lg",
        cancelButton: "btn btn-secondary btn-lg",
      },
      didRender: () => {
        const confirmBtn = Swal.getConfirmButton();
        const cancelBtn = Swal.getCancelButton();

        if (confirmBtn) {
          confirmBtn.style.cssText = `
            background: linear-gradient(135deg, #28a745, #20c997) !important;
            color: white !important;
            border: none !important;
            padding: 12px 24px !important;
            border-radius: 8px !important;
            font-weight: 600 !important;
            margin: 0 8px !important;
            transition: all 0.3s ease !important;
            box-shadow: 0 3px 6px rgba(40,167,69,0.3) !important;
          `;
        }

        if (cancelBtn) {
          cancelBtn.style.cssText = `
            background: linear-gradient(135deg, #6c757d, #5a6268) !important;
            color: white !important;
            border: none !important;
            padding: 12px 24px !important;
            border-radius: 8px !important;
            font-weight: 600 !important;
            margin: 0 8px !important;
            transition: all 0.3s ease !important;
            box-shadow: 0 3px 6px rgba(108,117,125,0.3) !important;
          `;
        }
      },
      preConfirm: () => {
        const selectAllBtn = document.getElementById("select-all-btn");
        const checkboxes = document.querySelectorAll(".employee-checkbox");
        const selected = Array.from(checkboxes)
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => checkbox.value);
        const allSelected = selectAllBtn.dataset.allSelected === "true";

        if (!allSelected && selected.length === 0) {
          Swal.showValidationMessage("Debe seleccionar al menos un empleado");
          return false;
        }

        return allSelected ? ["all"] : selected;
      },
      didOpen: () => {
        const selectAllBtn = document.getElementById("select-all-btn");
        const clearAllBtn = document.getElementById("clear-all-btn");
        const checkboxes = document.querySelectorAll(".employee-checkbox");
        const selectionCount = document.getElementById("selection-count");
        let allSelected = false;

        const updateSelectionCount = () => {
          const checkedCount = Array.from(checkboxes).filter(
            (cb) => cb.checked
          ).length;
          const count = allSelected ? empleados.length : checkedCount;
          selectionCount.innerHTML = `📋 ${count} empleado${
            count !== 1 ? "s" : ""
          } seleccionado${count !== 1 ? "s" : ""}`;
        };

        const updateButtons = () => {
          if (allSelected) {
            selectAllBtn.textContent = "Deseleccionar Todos";
            selectAllBtn.style.background = "#28a745";
            selectAllBtn.dataset.allSelected = "true";
            checkboxes.forEach((cb) => {
              cb.disabled = true;
              cb.parentElement.style.opacity = "0.6";
            });
          } else {
            selectAllBtn.textContent = "Seleccionar Todos";
            selectAllBtn.style.background = "#007bff";
            selectAllBtn.dataset.allSelected = "false";
            checkboxes.forEach((cb) => {
              cb.disabled = false;
              cb.parentElement.style.opacity = "1";
            });
          }
          updateSelectionCount();
        };

        selectAllBtn.addEventListener("click", (e) => {
          e.preventDefault();
          allSelected = !allSelected;
          if (!allSelected) {
            checkboxes.forEach((cb) => (cb.checked = false));
          }
          updateButtons();
        });

        clearAllBtn.addEventListener("click", (e) => {
          e.preventDefault();
          allSelected = false;
          checkboxes.forEach((cb) => (cb.checked = false));
          updateButtons();
        });

        checkboxes.forEach((checkbox) => {
          checkbox.addEventListener("change", () => {
            if (allSelected) {
              allSelected = false;
              updateButtons();
            } else {
              updateSelectionCount();
            }
          });
        });

        // Inicializar
        updateButtons();
      },
    });

    if (selectedEmployees) {
      if (selectedEmployees.includes("all")) {
        empleados.forEach((empleado) => {
          generateIndividualNominaPDF(empleado.record, empleado.name);
        });
        Swal.fire({
          title: "Éxito",
          text: `Se generaron ${empleados.length} PDF(s) de nómina`,
          icon: "success",
          timer: 3000,
          showConfirmButton: false,
          customClass: {
            popup: "swal-wide",
          },
        });
      } else {
        selectedEmployees.forEach((employeeId) => {
          const empleado = empleados.find((emp) => emp.id === employeeId);
          if (empleado) {
            generateIndividualNominaPDF(empleado.record, empleado.name);
          }
        });
        Swal.fire({
          title: "Éxito",
          text: `Se generaron ${selectedEmployees.length} PDF(s) de nómina`,
          icon: "success",
          timer: 3000,
          showConfirmButton: false,
          customClass: {
            popup: "swal-wide",
          },
        });
      }
    }
  };

  // Generar PDF individual de nómina
  const generateIndividualNominaPDF = (record, employeeName) => {
    const doc = new jsPDF("l", "mm", "a4");
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const nfmt = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const AWG = (n) => `${nfmt.format(Number(n || 0))} AWG`;
    const text = (
      str,
      x,
      y,
      { size = 10, bold = false, align = "left", color = [0, 0, 0] } = {}
    ) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(String(str ?? ""), x, y, { align });
    };
    const line = (x1, y1, x2, y2, w = 0.4) => {
      doc.setDrawColor(0);
      doc.setLineWidth(w);
      doc.line(x1, y1, x2, y2);
    };
    const rect = (x, y, w, h, style = null, lw = 0.4) => {
      doc.setDrawColor(0);
      doc.setLineWidth(lw);
      doc.rect(x, y, w, h, style || undefined);
    };
    const rrect = (x, y, w, h, r = 3, style = null, lw = 0.4) => {
      doc.setDrawColor(0);
      doc.setLineWidth(lw);
      doc.roundedRect(x, y, w, h, r, r, style || undefined);
    };

    const periodo = `Nómina (${currentNomina?.fechaDesde || "DD-MM-AA"} al ${
      currentNomina?.fechaHasta || "DD-MM-AA"
    })`;
    const hoy = new Date().toLocaleDateString("es-ES");

    const dias = Number(record?.dias || 0);
    const valorDia = Number(record?.valor || 0);
    const totalQuin = Number(record?.totalQuincena ?? dias * valorDia);
    const extras = Number(record?.extra || 0);
    const deducs = Number(record?.deducciones || 0);
    const totalNom = Number(record?.totalNomina ?? totalQuin + extras - deducs);
    const efectivo = Number(record?.efectivo || 0);
    const entregado = Number(record?.entregado || 0);
    const saldoInicial = totalNom - efectivo;
    const saldoFinal = saldoInicial - entregado;

    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    doc.addImage(logosolo, "PNG", (W - 105) / 2, (H - 105) / 2, 105, 105);
    doc.restoreGraphicsState();

    doc.addImage(logo, "PNG", 15, 12, 60, 20);

    text("COMPROBANTE DE PAGO QUINCENAL", W / 2, 24, {
      size: 16,
      bold: true,
      align: "center",
    });

    text("FECHA DE GENERACIÓN", W - 15 - 35, 18, {
      size: 8,
      bold: true,
      align: "center",
    });
    rrect(W - 15 - 70 + 7, 19.5, 70 - 14, 10, 2.5, null, 0.4);
    text(hoy.replace(/\//g, "/"), W - 15 - 35, 26.8, {
      size: 10,
      bold: true,
      align: "center",
    });

    text(periodo, W / 2, 43.5, { size: 12, bold: true, align: "center" });

    text("EMPLEADO:", 25, 57, { size: 11, bold: true });
    text(employeeName || "Sin asignar", 65, 57, {
      size: 11,
      color: [0, 0, 0],
    });
    text("EMPRESA:", 25, 66, { size: 11, bold: true });
    text("Oops Out Septic Tank & Services Aruba", 65, 66, {
      size: 11,
      color: [0, 0, 0],
    });

    const tableTop = 84;
    const tableH = 90 - 20;
    const cW = (W - 30) / 3;

    rect(15, tableTop, W - 30, tableH, null, 0.4);
    line(15 + cW, tableTop, 15 + cW, tableTop + tableH, 0.4);
    line(15 + 2 * cW, tableTop, 15 + 2 * cW, tableTop + tableH, 0.4);

    const headerH = 10;
    doc.setFillColor(240, 240, 240);
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.rect(15, tableTop, cW, headerH, "FD");
    doc.rect(15 + cW, tableTop, cW, headerH, "FD");
    doc.rect(15 + 2 * cW, tableTop, cW, headerH, "FD");

    text("Concepto", 15 + cW * 0.12, tableTop + 6.8, {
      size: 10,
      bold: true,
      color: [0, 0, 0],
    });
    text("Valor", 15 + cW - 6, tableTop + 6.8, {
      size: 10,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });
    text("Concepto", 15 + cW + cW * 0.12, tableTop + 6.8, {
      size: 10,
      bold: true,
      color: [0, 0, 0],
    });
    text("Valor", 15 + 2 * cW - 6, tableTop + 6.8, {
      size: 10,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });
    text("Concepto", 15 + 2 * cW + cW * 0.12, tableTop + 6.8, {
      size: 10,
      bold: true,
      color: [0, 0, 0],
    });
    text("Valor", 15 + 3 * cW - 6, tableTop + 6.8, {
      size: 10,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    const rH = 28;

    text("DIAS LABORADOS:", 15 + 6, tableTop + headerH + 12, {
      size: 10,
      bold: true,
      color: [80, 80, 80],
    });
    text(String(dias), 15 + cW - 6, tableTop + headerH + 12, {
      size: 11,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });
    text("X VALOR DIA:", 15 + 6, tableTop + headerH + rH - 3, {
      size: 10,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(valorDia), 15 + cW - 6, tableTop + headerH + rH - 3, {
      size: 11,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    text("TOTAL QUINCENA:", 15 + cW + 6, tableTop + headerH + 12, {
      size: 10,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(totalQuin), 15 + 2 * cW - 6, tableTop + headerH + 12, {
      size: 11,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    const chipY = tableTop + headerH + rH - 4;
    text("+ TOTAL EXTRAS:", 17 + cW + 4, chipY + 1, {
      size: 10,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(extras), 15 + 2 * cW - 4, chipY + 1, {
      size: 11,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    text("- TOTAL DEDUCCIONES:", 15 + cW + 6, tableTop + headerH + 2 + rH + 8, {
      size: 10,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(deducs), 15 + 2 * cW - 6, tableTop + headerH + 2 + rH + 8, {
      size: 11,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    text("TOTAL NOMINA:", 15 + 2 * cW + 6, tableTop + headerH + 12, {
      size: 10,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(totalNom), 15 + 3 * cW - 6, tableTop + headerH + 12, {
      size: 11,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    const chipY3 = tableTop + headerH + rH + 8;
    text("+ EFECTIVO POR ENTREGAR:", 15 + 2 * cW + 6, chipY3 - 11, {
      size: 10,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(efectivo), 15 + 3 * cW - 6, chipY3 - 11, {
      size: 11,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    const sumY = tableTop + tableH - 12;
    line(15, sumY, 15 + 3 * cW, sumY, 0.4);
    text("= TOTAL QUINCENA:", 15 + 6, sumY + 6, {
      size: 9,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(totalQuin), 15 + cW - 6, sumY + 6, {
      size: 10,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });
    text("= TOTAL NOMINA:", 15 + cW + 6, sumY + 6, {
      size: 9,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(totalNom), 15 + 2 * cW - 6, sumY + 6, {
      size: 10,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });
    text("= SALDO INICIAL:", 15 + 2 * cW + 6, sumY + 6, {
      size: 9,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(saldoInicial), 15 + 3 * cW - 6, sumY + 6, {
      size: 10,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    text("SALDO INICIAL:", 35, tableTop + tableH + 18, {
      size: 11,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(saldoInicial), 92, tableTop + tableH + 18, {
      size: 11,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    text("- REINTEGRO ENTREGADO:", 115, tableTop + tableH + 18, {
      size: 11,
      bold: true,
      color: [80, 80, 80],
    });
    text(AWG(entregado), 192, tableTop + tableH + 18, {
      size: 11,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    text("= SALDO FINAL:", 202, tableTop + tableH + 18, {
      size: 14,
      bold: true,
      color: [0, 0, 0],
    });
    text(AWG(saldoFinal), W - 20, tableTop + tableH + 18, {
      size: 14,
      bold: true,
      align: "right",
      color: [0, 0, 0],
    });

    const noteY = H - 22;
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(170, 170, 170);
    doc.roundedRect(25, noteY, W - 50, 14, 3.5, 3.5, "FD");
    text(
      "NOTA: SI SALDO FINAL ES NEGATIVO, EL EMPLEADO QUEDA PENDIENTE DE ENTREGAR ESE EFECTIVO A LA EMPRESA EN LA PROXIMA QUINCENA.",
      30,
      noteY + 9,
      { size: 8, color: [80, 80, 80] }
    );

    const safe = (employeeName || "Empleado").replace(/\s+/g, "_");
    doc.save(
      `Nomina_${safe}_${currentNomina?.fechaDesde || "DD-MM-AA"}_${
        currentNomina?.fechaHasta || "DD-MM-AA"
      }.pdf`
    );
  };

  // Exportar a PDF mejorado (resumen)
  const generatePDF = () => {
    if (!currentNomina) return;
    if (visibleRows.length === 0) {
      Swal.fire({
        title: "Sin datos",
        text: "No hay filas visibles para exportar.",
        icon: "info",
        confirmButtonText: "Entendido",
        customClass: {
          popup: "swal-wide",
        },
      });
      return;
    }

    const exportData = visibleRows.map((record) => {
      return {
        Nombre: getUserNameWithFallback(record),
        Días: record.dias || 0,
        Valor: Number(record.valor || 0).toFixed(2),
        "Total Quincena": Number(record.totalQuincena || 0).toFixed(2),
        Extra: Number(record.extra || 0).toFixed(2),
        Deducciones: Number(record.deducciones || 0).toFixed(2),
        "Total Nómina": Number(record.totalNomina || 0).toFixed(2),
        Efectivo: Number(record.efectivo || 0).toFixed(2),
        "Saldo Inicial": Number(
          (record.totalNomina || 0) - (record.efectivo || 0)
        ).toFixed(2),
        Entregado: Number(record.entregado || 0).toFixed(2),
        "Saldo Final": Number(
          (record.totalNomina || 0) -
            (record.efectivo || 0) -
            (record.entregado || 0)
        ).toFixed(2),
      };
    });

    const doc = new jsPDF("l", "mm", "a4");
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    const logoSize = 100;
    doc.addImage(
      logosolo,
      "PNG",
      (pageW - logoSize) / 2,
      (pageH - logoSize) / 2,
      logoSize,
      logoSize
    );
    doc.restoreGraphicsState();

    doc.addImage(logo, "PNG", 15, 10, 40, 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("REPORTE DE NÓMINA", pageW / 2, 20, { align: "center" });

    doc.setFontSize(12);
    const periodo = currentNomina
      ? `${currentNomina.fechaDesde} - ${currentNomina.fechaHasta}`
      : "";
    doc.text(`Período: ${periodo}`, pageW / 2, 28, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const fechaGeneracion = new Date().toLocaleDateString("es-ES");
    doc.text(`Generado el: ${fechaGeneracion}`, pageW - 15, 15, {
      align: "right",
    });

    doc.text("Oops Out Septic Tank & Services Aruba", pageW - 15, 25, {
      align: "right",
    });

    const headers = [
      [
        "Empleado",
        "Días",
        "Valor/Día",
        "Total\nQuincena",
        "Extras",
        "Deducciones",
        "Total\nNómina",
        "Efectivo\nEntregar",
        "Saldo\nInicial",
        "Reintegro\nEntregado",
        "Saldo\nFinal",
      ],
    ];

    const dataRows = exportData.map((item) => [
      item.Nombre,
      item.Días,
      `${item.Valor} AWG`,
      `${item["Total Quincena"]} AWG`,
      `${item.Extra} AWG`,
      `${item.Deducciones} AWG`,
      `${item["Total Nómina"]} AWG`,
      `${item.Efectivo} AWG`,
      `${item["Saldo Inicial"]} AWG`,
      `${item.Entregado} AWG`,
      `${item["Saldo Final"]} AWG`,
    ]);

    const totales = {
      totalQuincena: exportData.reduce(
        (sum, item) => sum + Number(item["Total Quincena"]),
        0
      ),
      totalExtras: exportData.reduce(
        (sum, item) => sum + Number(item.Extra),
        0
      ),
      totalDeducciones: exportData.reduce(
        (sum, item) => sum + Number(item.Deducciones),
        0
      ),
      totalNomina: exportData.reduce(
        (sum, item) => sum + Number(item["Total Nómina"]),
        0
      ),
      totalEfectivo: exportData.reduce(
        (sum, item) => sum + Number(item.Efectivo),
        0
      ),
      totalSaldoInicial: exportData.reduce(
        (sum, item) => sum + Number(item["Saldo Inicial"]),
        0
      ),
      totalEntregado: exportData.reduce(
        (sum, item) => sum + Number(item.Entregado),
        0
      ),
      totalSaldoFinal: exportData.reduce(
        (sum, item) => sum + Number(item["Saldo Final"]),
        0
      ),
    };

    dataRows.push([
      "TOTALES",
      "",
      "",
      `${totales.totalQuincena.toFixed(2)} AWG`,
      `${totales.totalExtras.toFixed(2)} AWG`,
      `${totales.totalDeducciones.toFixed(2)} AWG`,
      `${totales.totalNomina.toFixed(2)} AWG`,
      `${totales.totalEfectivo.toFixed(2)} AWG`,
      `${totales.totalSaldoInicial.toFixed(2)} AWG`,
      `${totales.totalEntregado.toFixed(2)} AWG`,
      `${totales.totalSaldoFinal.toFixed(2)} AWG`,
    ]);

    autoTable(doc, {
      head: headers,
      body: dataRows,
      startY: 35,
      theme: "striped",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
      },
      bodyStyles: {
        fontSize: 7,
        halign: "center",
        valign: "middle",
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 25 },
        1: { cellWidth: 12 },
        2: { cellWidth: 18 },
        3: { cellWidth: 20 },
        4: { cellWidth: 18 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 },
        8: { cellWidth: 20 },
        9: { cellWidth: 20 },
        10: { cellWidth: 20 },
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { top: 35, left: 10, right: 10 },
      didParseCell: function (data) {
        if (data.row.index === dataRows.length - 1) {
          data.cell.styles.fillColor = [52, 152, 219];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
        }
        if (
          data.column.index === 10 &&
          data.cell.text[0] &&
          data.cell.text[0].includes("-")
        ) {
          data.cell.styles.textColor = [231, 76, 60];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Total de empleados: ${visibleRows.length}`, 15, finalY);

    doc.save(
      `Nomina_Resumen_${currentNomina?.fechaDesde || ""}_${
        currentNomina?.fechaHasta || ""
      }.pdf`
    );
  };

  // Helper para normalizar usuario (ID vs nombre)
  const normalizeUserId = (value, users) => {
    if (!value) return "";
    const byId = users.find((u) => u.id === value);
    if (byId) return byId.id;
    const byName = users.find((u) => u.name === value);
    return byName ? byName.id : value;
  };

  // Filas visibles
  const visibleRows = useMemo(() => {
    let base = nominaData || [];
    if (filters.nombre.length > 0) {
      base = base.filter((record) => {
        const rid = normalizeUserId(record.nombre, users);
        return filters.nombre.includes(rid);
      });
    }
    return base;
  }, [nominaData, filters.nombre, users]);

  // === NUEVO: Total General (solo suma del campo "Total Nómina") para filas visibles ===
  const totalGeneralNomina = useMemo(
    () =>
      visibleRows.reduce((sum, r) => sum + (parseFloat(r.totalNomina) || 0), 0),
    [visibleRows]
  );

  if (loading) {
    return (
      <div className="homepage-container">
        <Slidebar />
        <div className="loader-container">
          <div className="loader" />
        </div>
      </div>
    );
  }

  if (showInitialDialog) {
    return (
      <div className="homepage-container">
        <Slidebar />
        <div onClick={() => toggleSlidebar(!showSlidebar)}></div>
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
          <p style={{ color: "white", textAlign: "center" }}>
            Selecciona una opción en el diálogo
          </p>
        </div>
        <div className="homepage-title">
          <div className="homepage-card">
            <h1 className="title-page">Nómina</h1>
            <div className="current-date">
              <div style={{ cursor: "default" }}>
                {new Date().toLocaleDateString()}
              </div>
              <Clock />
            </div>
          </div>
        </div>
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

        <label>Filtrar Fecha De Nómina</label>
        <input
          type="text"
          value={filters.nomina}
          onChange={(e) => {
            const selectedValue = e.target.value;
            setFilters((prev) => ({ ...prev, nomina: selectedValue }));

            const selectedNomina = nominas.find(
              (nomina) =>
                `${nomina.fechaDesde} - ${nomina.fechaHasta}` === selectedValue
            );

            if (selectedNomina && selectedNomina.id !== currentNomina?.id) {
              setCurrentNomina(selectedNomina);
              if (selectedNomina.registros) {
                const registrosList = Object.entries(
                  selectedNomina.registros
                ).map(([id, registro]) => ({ id, ...registro }));
                setNominaData(registrosList);
              } else {
                setNominaData([]);
              }
            }
          }}
          list="nominas-list"
        />
        <datalist id="nominas-list">
          {nominas.map((nomina) => (
            <option
              key={nomina.id}
              value={`${nomina.fechaDesde} - ${nomina.fechaHasta}`}
            />
          ))}
        </datalist>

        <label>Filtrar Por Nombre</label>
        <div
          style={{
            maxHeight: "180px",
            overflowY: "auto",
            border: "1px solid rgba(255,255,255,0.12)",
            padding: "8px",
            background: "rgba(0,0,0,0.25)",
            borderRadius: "6px",
          }}
        >
          {users.map((user) => (
            <label
              key={user.id}
              htmlFor={`user-${user.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "6px",
                padding: "6px",
                cursor: "pointer",
                userSelect: "none",
                borderRadius: "4px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <input
                type="checkbox"
                id={`user-${user.id}`}
                checked={filters.nombre.includes(user.id)}
                onChange={(e) => {
                  const userId = user.id;
                  setFilters((prev) => ({
                    ...prev,
                    nombre: e.target.checked
                      ? [...prev.nombre, userId]
                      : prev.nombre.filter((id) => id !== userId),
                  }));
                }}
                style={{ width: "16px", height: "16px", flex: "0 0 auto" }}
              />
              <span style={{ color: "white", flex: "1 1 auto" }}>{user.name}</span>
            </label>
          ))}
        </div>

        <button
          className="discard-filter-button"
          onClick={() => setFilters({ nomina: "", nombre: [] })}
        >
          Descartar Filtros
        </button>
      </div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">
            Nómina{" "}
            {currentNomina
              ? `(${currentNomina.fechaDesde} al ${currentNomina.fechaHasta})`
              : ""}
          </h1>
          <div className="current-date">
            <div style={{ cursor: "default" }}>
              {new Date().toLocaleDateString()}
            </div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        {/* === NUEVO: Tarjeta Total General del campo "Total Nómina" (azul) === */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
            marginBottom: "10px",
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
              Total General Nómina
            </p>
            <p
              style={{
                margin: "0",
                fontSize: "12px",
                pointerEvents: "none",
                fontWeight: "bold",
              }}
            >
              AWG {totalGeneralNomina.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                {closingMode && (
                  <th style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={
                        visibleRows.length > 0 &&
                        visibleRows.every((record) => lockedRecords[record.id])
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      style={{
                        width: "2.6ch",
                        height: "2.6ch",
                      }}
                    />
                  </th>
                )}
                <th>Nombre De Empleado</th>
                <th style={{ textAlign: "center" }}>Días Laborados</th>
                <th style={{ textAlign: "center" }}>Valor Día</th>
                <th style={{ textAlign: "center" }}>Total Quincena</th>
                <th style={{ textAlign: "center" }}>Total Extras</th>
                <th style={{ textAlign: "center" }}>Total Deducciones</th>
                <th style={{ textAlign: "center" }}>Total Nómina</th>
                <th style={{ textAlign: "center" }}>Efectivo Por Entregar</th>
                <th style={{ textAlign: "center" }}>Saldo Inicial</th>
                <th style={{ textAlign: "center" }}>Reintegro Entregado</th>
                <th style={{ textAlign: "center" }}>Saldo Final</th>
                <th style={{ textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length > 0 ? (
                visibleRows.map((record) => {
                  const isLocked = lockedRecords[record.id];
                  return (
                    <tr
                      key={record.id}
                      style={{
                        backgroundColor: isLocked ? "#fff" : "transparent",
                      }}
                    >
                      {closingMode && (
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isLocked || false}
                            onChange={(e) =>
                              handleRecordLock(record.id, e.target.checked)
                            }
                            style={{
                              width: "2.6ch",
                              height: "2.6ch",
                            }}
                          />
                        </td>
                      )}
                      <td>
                        <select
                          value={record.nombre || ""}
                          onChange={(e) =>
                            updateNominaField(
                              record.id,
                              "nombre",
                              e.target.value
                            )
                          }
                          disabled={isLocked}
                        >
                          <option value=""></option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          value={record.dias || ""}
                          onChange={(e) =>
                            updateNominaField(record.id, "dias", e.target.value)
                          }
                          min="0"
                          step="1"
                          style={{ textAlign: "center", width: "80px" }}
                          disabled={isLocked}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <input
                            type="number"
                            value={record.valor || ""}
                            onChange={(e) =>
                              updateNominaField(
                                record.id,
                                "valor",
                                e.target.value
                              )
                            }
                            min="0"
                            step="0.01"
                            style={{ textAlign: "center", width: "80px" }}
                            disabled={isLocked}
                          />
                        </div>
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          opacity: isLocked ? 0.5 : 1,
                        }}
                      >
                        {(record.totalQuincena || 0).toFixed(2)} AWG
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          color: "green",
                          opacity: isLocked ? 0.5 : 1,
                        }}
                      >
                        {(record.extra || 0).toFixed(2)} AWG
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          color: "purple",
                          opacity: isLocked ? 0.5 : 1,
                        }}
                      >
                        {(record.deducciones || 0).toFixed(2)} AWG
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          color: "blue",
                          opacity: isLocked ? 0.5 : 1,
                        }}
                      >
                        {(record.totalNomina || 0).toFixed(2)} AWG
                      </td>

                      {/* EFECTIVO (editable). Se llena con valor recomendado al elegir nombre */}
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          value={record.efectivo ?? 0}
                          onChange={(e) =>
                            updateNominaField(
                              record.id,
                              "efectivo",
                              e.target.value
                            )
                          }
                          min="0"
                          step="0.01"
                          style={{ textAlign: "center", width: "100px" }}
                          disabled={isLocked}
                          title="Valor recomendado cargado al seleccionar nombre. Puedes editarlo."
                        />
                      </td>

                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          opacity: isLocked ? 0.5 : 1,
                        }}
                      >
                        {(record.total || 0).toFixed(2)} AWG
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <input
                            type="number"
                            value={record.entregado || ""}
                            onChange={(e) =>
                              updateNominaField(
                                record.id,
                                "entregado",
                                e.target.value
                              )
                            }
                            min="0"
                            step="0.01"
                            style={{ textAlign: "center", minWidth: "80px" }}
                            disabled={isLocked}
                          />
                        </div>
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          color: "red",
                          opacity: isLocked ? 0.5 : 1,
                        }}
                      >
                        {(
                          (record.total || 0) - (record.entregado || 0)
                        ).toFixed(2)}{" "}
                        AWG
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="delete-button"
                          style={{
                            marginRight: "14px",
                            // === NUEVO: opacidad/cursor cuando el registro está cerrado ===
                            opacity: isLocked ? 0.5 : 1,
                            cursor: isLocked ? "not-allowed" : "pointer",
                          }}
                          onClick={() => deleteNominaRecord(record.id)}
                          disabled={isLocked}
                          title={
                            isLocked
                              ? "Registro cerrado: no puede eliminarse"
                              : "Eliminar"
                          }
                        >
                          Eliminar
                        </button>
                        <button
                          className="delete-button"
                          style={{
                            marginRight: "8px",
                            backgroundColor: "green",
                            // === NUEVO: opacidad/cursor cuando el registro está cerrado ===
                            opacity: isLocked ? 0.5 : 1,
                            cursor: isLocked ? "not-allowed" : "pointer",
                          }}
                          onClick={() => setEfectivoTotal(record.id)}
                          disabled={isLocked}
                          title={
                            isLocked
                              ? "Registro cerrado: no puede modificarse"
                              : "Aplicar efectivo total (histórico)"
                          }
                        >
                          Efectivo total (sin rango)
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={closingMode ? "13" : "12"}>
                    No hay registros en esta nómina
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Botones de gestión de nómina */}
        <div
          className="button-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          {currentNomina && (
            <button
              className="filter-button"
              style={{
                backgroundColor: "red",
                color: "white",
              }}
              onClick={async () => {
                const result = await Swal.fire({
                  title: "¿Eliminar nómina?",
                  text: `Se eliminará la nómina ${currentNomina.fechaDesde} - ${currentNomina.fechaHasta} y todos sus registros.`,
                  icon: "warning",
                  showCancelButton: true,
                  confirmButtonText: "Sí, eliminar",
                  cancelButtonText: "Cancelar",
                  confirmButtonColor: "#d33",
                  cancelButtonColor: "#3085d6",
                  allowOutsideClick: false,
                  customClass: {
                    popup: "swal-wide",
                  },
                });

                if (result.isConfirmed) {
                  try {
                    await remove(ref(database, `nominas/${currentNomina.id}`));

                    setNominas((prev) =>
                      prev.filter((nomina) => nomina.id !== currentNomina.id)
                    );
                    setCurrentNomina(null);
                    setNominaData([]);
                    setShowInitialDialog(true);

                    Swal.fire({
                      title: "Eliminada",
                      text: "La nómina ha sido eliminada",
                      icon: "success",
                      timer: 2000,
                      showConfirmButton: false,
                      customClass: {
                        popup: "swal-wide",
                      },
                    }).then(() => {
                      showNominaDialog();
                    });
                  } catch (error) {
                    console.error("Error deleting nomina:", error);
                    Swal.fire({
                      title: "Error",
                      text: "No se pudo eliminar la nómina",
                      icon: "error",
                      confirmButtonText: "Entendido",
                      customClass: {
                        popup: "swal-wide",
                      },
                    });
                  }
                }
              }}
            >
              Borrar Nómina
            </button>
          )}

          {currentNomina && (
            <button
              className="filter-button"
              style={{
                backgroundColor: closingMode
                  ? hasSelectedRecords
                    ? "#28a745"
                    : "#ff6347"
                  : "#5271ff",
                color: "white",
              }}
              onClick={
                closingMode && hasSelectedRecords
                  ? confirmClosingNomina
                  : () => toggleClosingMode()
              }
            >
              {closingMode
                ? hasSelectedRecords
                  ? "Confirmar Cierre"
                  : "Cancelar Cierre"
                : "Cerrar Nómina"}
            </button>
          )}

          <button
            className="filter-button"
            onClick={() => {
              showDateRangeDialog();
            }}
            style={{
              backgroundColor: "#28a745",
              color: "white",
            }}
          >
            Nueva Nómina
          </button>
        </div>
      </div>

      {currentNomina && (
        <button className="create-table-button" onClick={addNominaRecord}>
          +
        </button>
      )}

      {/* Botones de exportar */}
      <button className="generate-button1" onClick={generateXLSX}>
        <img className="generate-button-imagen1" src={excel_icon} alt="Excel" />
      </button>
      <button className="generate-button2" onClick={generatePDF}>
        <img className="generate-button-imagen2" src={pdf_icon} alt="PDF" />
      </button>
      <button className="generate-button3" onClick={generatePDFnomina}>
        <img
          className="generate-button-imagen3"
          src={informeEfectivoIcon2}
          alt="PDF"
        />
      </button>
    </div>
  );
};

export default React.memo(Nomina);
