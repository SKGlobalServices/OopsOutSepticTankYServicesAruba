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

      // Sumar todos los valores de extras encontrados
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

      // Sumar todas las deducciones encontradas
      return userDeducciones.reduce(
        (total, deduccion) => total + (parseFloat(deduccion.valor) || 0),
        0
      );
    },
    [deducciones]
  );

  // Calcular efectivo para un usuario
  const calculateEfectivoForUser = useCallback(
    (userId) => {
      const userEfectivo = informeEfectivo.filter(
        (item) =>
          item.realizadopor === userId && item.metododepago === "efectivo"
      );

      // Ordenar por fecha y calcular saldo final
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
    console.log("Nominas disponibles:", nominas.length);

    // Verificar directamente en Firebase si hay nóminas
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

            // Verificar que la nómina tenga fechas válidas
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
    ); // Solo ejecutar una vez
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
        efectivo: 0,
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
        // Calcular extras, deducciones y efectivo automáticamente
        const extraValue = calculateExtrasForUser(
          value,
          currentNomina.fechaDesde,
          currentNomina.fechaHasta
        );
        const deduccionesValue = calculateDeduccionesForUser(
          value,
          currentNomina.fechaDesde,
          currentNomina.fechaHasta
        );
        const efectivoValue = calculateEfectivoForUser(value);
        updateData.extra = extraValue;
        updateData.deducciones = deduccionesValue;
        updateData.efectivo = efectivoValue;
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

      // Si cambia el efectivo, recalcular el saldo inicial
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
      updateData.total = updateData.totalNomina + efectivo;

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
    // Si se está desmarcando un registro (isLocked = false) y el registro estaba bloqueado
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

    // Actualizar estado de si hay registros seleccionados
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
      // Si hay registros bloqueados y se está cancelando el modo cerrar
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
      // Mantener solo los registros seleccionados como bloqueados
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
      // Si hay registros bloqueados y se está desmarcando todo
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

  // Obtener nombre de usuario
  const getUserName = (userId) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.name : "";
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
      const userName =
        users.find((u) => u.id === record.nombre)?.name ||
        users.find((u) => u.name === record.nombre)?.name ||
        "";
      return {
        Nombre: userName,
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

    // Obtener lista de empleados únicos
    const empleados = visibleRows
      .map((record) => {
        const userName =
          users.find((u) => u.id === record.nombre)?.name ||
          users.find((u) => u.name === record.nombre)?.name ||
          "Sin nombre";
        return {
          id: record.nombre,
          name: userName,
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
          <!-- Botones de control -->
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
          
          <!-- Contador de selección -->
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
        // Generar PDF para todos los empleados
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
        // Generar PDF para empleados seleccionados
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
    // A4 horizontal
    const doc = new jsPDF("l", "mm", "a4");
    const pageW = doc.internal.pageSize.getWidth(); // 297
    const pageH = doc.internal.pageSize.getHeight(); // 210

    // ========= Helpers =========
    const fmtAWG = (n) => `${Number(n || 0).toFixed(2)} AWG`;
    const ddmmaa = (isoLike) => {
      // espera dd-mm-yyyy
      if (!isoLike) return "--/--/--";
      const [dd, mm, yyyy] = String(isoLike).split("-");
      return `${dd}/${mm}/${String(yyyy).slice(-2)}`;
    };

    const drawPair = (label, value, xLabel, y, opts = {}) => {
      const { boldLabel = false, fontSize = 9, pad = 2 } = opts;
      const labelTxt = label.endsWith(":") ? label : `${label}:`;
      doc.setFont("helvetica", boldLabel ? "bold" : "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(0, 0, 0);
      doc.text(labelTxt, xLabel, y);
      const xVal = xLabel + doc.getTextWidth(labelTxt) + pad;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontSize + 1);
      doc.text(String(value ?? ""), xVal, y);
    };

    const center = (txt, x, y, bold = false, size = 10) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.text(txt, x, y, { align: "center" });
    };

    // ========= Marco general =========
    doc.setDrawColor(0);
    doc.setLineWidth(0.6);
    doc.rect(5, 5, pageW - 10, pageH - 10); // borde externo

    // ========= Encabezado =========
    doc.addImage(logo, "PNG", 12, 12, 60, 18);

    // Título principal
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    center("COMPROBANTE DE PAGO QUINCENAL", pageW / 2, 22);

    // Caja “FECHA DE GENERACIÓN”
    const dateBox = { x: pageW - 92, y: 10, w: 82, h: 22 };
    doc.setLineWidth(0.4);
    doc.roundedRect(dateBox.x, dateBox.y, dateBox.w, dateBox.h, 3, 3);
    center(
      "FECHA DE GENERACIÓN",
      dateBox.x + dateBox.w / 2,
      dateBox.y + 8,
      true,
      9
    );
    center(
      ddmmaa(
        new Date().toLocaleDateString("en-CA").split("-").reverse().join("-")
      ), // dd/mm/aa rápido
      dateBox.x + dateBox.w / 2,
      dateBox.y + 16,
      true,
      11
    );

    // Barra subtítulo (rango nómina)
    doc.setLineWidth(0.6);
    doc.rect(12, 32, pageW - 24, 12);
    center(
      `Nómina (${currentNomina?.fechaDesde || "DD-MM-AA"} al ${
        currentNomina?.fechaHasta || "DD-MM-AA"
      })`,
      pageW / 2,
      40,
      false,
      11
    );

    // Marca de agua
    (function drawWatermark() {
      const WM_W = 90,
        WM_H = 90;
      const WM_X = (pageW - WM_W) / 2,
        WM_Y = (pageH - WM_H) / 2 - 6;
      if (doc.GState && doc.setGState) {
        const gs = new doc.GState({ opacity: 0.12 });
        doc.setGState(gs);
        doc.addImage(logosolo, "PNG", WM_X, WM_Y, WM_W, WM_H);
        doc.setGState(new doc.GState({ opacity: 1 }));
      } else if (doc.setAlpha) {
        doc.setAlpha(0.12);
        doc.addImage(logosolo, "PNG", WM_X, WM_Y, WM_W, WM_H);
        doc.setAlpha(1);
      } else {
        doc.addImage(logosolo, "PNG", WM_X, WM_Y, WM_W, WM_H);
      }
    })();

    // Bloque EMPLEADO / EMPRESA
    doc.rect(12, 48, pageW - 24, 24);
    drawPair("EMPLEADO", employeeName || "—", 20, 60, {
      boldLabel: true,
      fontSize: 10,
    });
    drawPair("EMPRESA", "Oops Out Septic Tank & Services Aruba", 20, 70, {
      boldLabel: true,
      fontSize: 10,
    });

    // ========= Tabla 3 columnas (Concepto / Valor) =========
    const table = { x: 12, y: 78, w: pageW - 24, h: 72 };
    // marco externo horizontal de tabla
    doc.rect(table.x, table.y, table.w, table.h);

    // columnas (3)
    const colW = table.w / 3;
    const c1 = table.x,
      c2 = table.x + colW,
      c3 = table.x + 2 * colW;
    doc.line(c2, table.y, c2, table.y + table.h);
    doc.line(c3, table.y, c3, table.y + table.h);

    // fila de cabeceras
    const headH = 12;
    doc.line(table.x, table.y + headH, table.x + table.w, table.y + headH);
    // títulos
    center("Concepto", c1 + colW / 2 - 20, table.y + 9, true, 10);
    center("Valor", c1 + colW / 2 + 35, table.y + 9, true, 10);
    center("Concepto", c2 + colW / 2 - 20, table.y + 9, true, 10);
    center("Valor", c2 + colW / 2 + 35, table.y + 9, true, 10);
    center("Concepto", c3 + colW / 2 - 20, table.y + 9, true, 10);
    center("Valor", c3 + colW / 2 + 35, table.y + 9, true, 10);

    // filas internas (3 filas de contenido)
    const rowH = (table.h - headH) / 3;
    const r1y = table.y + headH + rowH;
    const r2y = table.y + headH + 2 * rowH;
    doc.line(table.x, r1y, table.x + table.w, r1y);
    doc.line(table.x, r2y, table.x + table.w, r2y);

    // ===== Contenido por filas (según mockup) =====
    // Fila 1 (izq: días/valor día) (centro/vacío) (der/vacío)
    let y1 = table.y + headH + rowH / 2 + 2;
    drawPair("DIAS LABORADOS", record.dias || 0, c1 + 13, y1);
    drawPair("VALOR DIA", fmtAWG(record.valor), c1 + 13, y1 + 8);

    // Fila 2 (centro: totales de quincena/extras/deducciones, con símbolos)
    let y2 = table.y + headH + rowH + rowH / 2 - 4;
    drawPair("TOTAL QUINCENA", fmtAWG(record.totalQuincena), c2 + 13, y2 - 6);
    drawPair("TOTAL EXTRAS", fmtAWG(record.extra), c2 + 13, y2 + 2);
    drawPair("TOTAL DEDUCCIONES", fmtAWG(record.deducciones), c2 + 13, y2 + 10);

    // Fila 3 (der: total nómina / efectivo por entregar, con símbolo)
    let y3 = table.y + headH + 2 * rowH + rowH / 2 - 4;
    drawPair("TOTAL NOMINA", fmtAWG(record.totalNomina), c3 + 13, y3 - 2);
    drawPair("EFECTIVO POR ENTREGAR", fmtAWG(record.efectivo), c3 + 13, y3 + 6);

    // Símbolos + / − / = (entre columnas en la segunda fila)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const symY = table.y + headH + rowH + 6;
    doc.text("+", c2 - 7, symY); // entre col 1 y 2
    doc.text("−", c3 - 7, symY); // entre col 2 y 3
    // Igual bajo la segunda fila apuntando a TOTAL NOMINA
    doc.text("=", c3 + colW - 9, symY + 8);

    // ===== Totales debajo de la tabla (banda de resumen) =====
    const bandY = table.y + table.h + 10;
    // 3 celdas del mismo ancho que las columnas
    doc.setLineWidth(0.4);
    doc.rect(c1, bandY - 8, colW, 12);
    doc.rect(c2, bandY - 8, colW, 12);
    doc.rect(c3, bandY - 8, colW, 12);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL QUINCENA:", c1 + 6, bandY);
    doc.text(fmtAWG(record.totalQuincena), c1 + colW - 6, bandY, {
      align: "right",
    });

    doc.text("TOTAL NOMINA:", c2 + 6, bandY);
    doc.text(fmtAWG(record.totalNomina), c2 + colW - 6, bandY, {
      align: "right",
    });

    doc.text("SALDO INICIAL:", c3 + 6, bandY);
    const saldoInicial =
      Number(record.totalNomina || 0) + Number(record.efectivo || 0);
    doc.text(fmtAWG(saldoInicial), c3 + colW - 6, bandY, { align: "right" });

    // ===== Bloque SALDO FINAL (grande) =====
    const blockY = bandY + 22;
    // “SALDO INICIAL − REINTEGRO ENTREGADO = SALDO FINAL”
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    drawPair("SALDO INICIAL", fmtAWG(saldoInicial), 24, blockY, {
      boldLabel: true,
      fontSize: 10,
    });
    drawPair(
      "REINTEGRO ENTREGADO",
      fmtAWG(record.entregado || 0),
      120,
      blockY,
      { boldLabel: true, fontSize: 10 }
    );

    const saldoFinal = (saldoInicial || 0) - Number(record.entregado || 0);
    doc.setFontSize(15);
    doc.text("SALDO FINAL", 208, blockY + 10);
    doc.text(fmtAWG(saldoFinal), 288, blockY + 10, { align: "right" });

    // Nota
    const noteY = blockY + 30;
    const noteW = pageW - 60;
    doc.roundedRect(30, noteY, noteW, 14, 2, 2);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    center(
      "NOTA: SI SALDO FINAL ES NEGATIVO, EL EMPLEADO QUEDA PENDIENTE DE ENTREGAR ESE EFECTIVO A LA EMPRESA EN LA PROXIMA QUINCENA",
      30 + noteW / 2,
      noteY + 9
    );

    // Guardar
    const safeName = (employeeName || "Empleado").replace(/\s+/g, "_");
    doc.save(
      `Nomina_${safeName}_${currentNomina?.fechaDesde || "DD-MM-YYYY"}_${
        currentNomina?.fechaHasta || "DD-MM-YYYY"
      }.pdf`
    );
  };

  // Exportar a PDF
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
      const userName =
        users.find((u) => u.id === record.nombre)?.name ||
        users.find((u) => u.name === record.nombre)?.name ||
        "";
      return {
        Nombre: userName,
        Días: record.dias || 0,
        Valor: `${Number(record.valor || 0).toFixed(2)} AWG`,
        "Total Quincena": `${Number(record.totalQuincena || 0).toFixed(2)} AWG`,
        Extra: `${Number(record.extra || 0).toFixed(2)} AWG`,
        Deducciones: `${Number(record.deducciones || 0).toFixed(2)} AWG`,
        "Total Nómina": `${Number(record.totalNomina || 0).toFixed(2)} AWG`,
        Efectivo: `${Number(record.efectivo || 0).toFixed(2)} AWG`,
        Total: `${Number(record.total || 0).toFixed(2)} AWG`,
        Entregado: `${Number(record.entregado || 0).toFixed(2)} AWG`,
        "Total Final": `${Number(
          (record.total || 0) - (record.entregado || 0)
        ).toFixed(2)} AWG`,
      };
    });

    const doc = new jsPDF("l", "mm", "a4");

    // Título
    doc.setFontSize(16);
    const title = `Nómina ${
      currentNomina
        ? `(${currentNomina.fechaDesde} - ${currentNomina.fechaHasta})`
        : ""
    }`;
    doc.text(title, 148, 20, { align: "center" });

    // Headers de la tabla
    const headers = [
      [
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
      ],
    ];

    const dataRows = exportData.map((item) => [
      item.Nombre,
      item.Días,
      item.Valor,
      item["Total Quincena"],
      item.Extra,
      item.Deducciones,
      item["Total Nómina"],
      item.Efectivo,
      item.Total,
      item.Entregado,
      item["Total Final"],
    ]);

    autoTable(doc, {
      head: headers,
      body: dataRows,
      startY: 30,
      theme: "grid",
      headStyles: { fillColor: [79, 129, 189], textColor: [255, 255, 255] },
      styles: { fontSize: 7 },
      margin: { top: 30, left: 10, right: 10 },
    });

    doc.save(
      `Nomina_${currentNomina?.fechaDesde || ""}_${
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

  // Filas exactamente visibles en la tabla (aplica TODOS los filtros que uses)
  const visibleRows = useMemo(() => {
    let base = nominaData || [];

    // Filtro por nombre (soporta registros con ID o con nombre)
    if (filters.nombre.length > 0) {
      base = base.filter((record) => {
        const rid = normalizeUserId(record.nombre, users);
        return filters.nombre.includes(rid);
      });
    }

    return base;
  }, [nominaData, filters.nombre, users]);

  // Mostrar loader solo cuando se está procesando
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

  // Mostrar slidebar mientras se muestran los diálogos
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
              <div>{new Date().toLocaleDateString()}</div>
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

            // Si se selecciona una nómina específica, cambiar a esa nómina
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
            maxHeight: "150px",
            overflowY: "auto",
            border: "1px solid #ccc",
            padding: "5px",
          }}
        >
          {users.map((user) => (
            <div
              key={user.id}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "5px",
              }}
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
                style={{ marginRight: "8px" }}
              />
              <label
                htmlFor={`user-${user.id}`}
                style={{ cursor: "pointer", color: "white" }}
              >
                {user.name}
              </label>
            </div>
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
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          color: "purple",
                          opacity: isLocked ? 0.5 : 1,
                        }}
                      >
                        {(record.efectivo || 0).toFixed(2)} AWG
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
                          style={{ marginRight: "14px" }}
                          onClick={() => deleteNominaRecord(record.id)}
                          disabled={isLocked}
                        >
                          Eliminar
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

                    // Actualizar estado local inmediatamente
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
                      // Mostrar diálogo después de confirmar eliminación
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
