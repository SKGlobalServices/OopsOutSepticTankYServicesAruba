import React, { useState, useEffect } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue, update, set } from "firebase/database";
import Swal from "sweetalert2";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logotipo from "../assets/img/logo.png";

// Función auxiliar para formatear números con formato 0,000.00
const formatCurrency = (amount) => {
  return Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

const FacturaViewEdit = ({ numeroFactura, onClose }) => {
  const [facturaData, setFacturaData] = useState(null);
  const [serviciosAsociados, setServiciosAsociados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [invoiceConfig, setInvoiceConfig] = useState({});
  const [users, setUsers] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Cargar configuración de factura
  useEffect(() => {
    const configRef = ref(database, "configuraciondefactura");
    return onValue(configRef, (snap) => {
      if (snap.exists()) setInvoiceConfig(snap.val());
    });
  }, []);

  // Cargar usuarios
  useEffect(() => {
    const usersRef = ref(database, "users");
    return onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedUsers = Object.entries(snapshot.val())
          .filter(([_, user]) => user.role !== "admin" && user.role !== "contador")
          .map(([id, user]) => ({ id, name: user.name }));
        setUsers(fetchedUsers);
      }
    });
  }, []);

  // Cargar datos de la factura y servicios asociados
  useEffect(() => {
    if (!numeroFactura) return;

    const loadFacturaData = () => {
      // 1. Cargar datos de la factura desde el nodo /facturas/
      const facturaRef = ref(database, `facturas/${numeroFactura}`);
      return onValue(facturaRef, (facturaSnapshot) => {
        if (facturaSnapshot.exists()) {
          const newFacturaData = facturaSnapshot.val();
          
          // Solo actualizar si es la primera carga o si realmente hay cambios significativos
          setFacturaData(prevData => {
            if (!prevData) {
              // Primera carga - recalcular amounts para asegurar que están correctos
              const invoiceItemsRecalculados = recalcularAmounts(newFacturaData.invoiceItems);
              return {
                ...newFacturaData,
                invoiceItems: invoiceItemsRecalculados
              };
            }
            
            // Si ya tenemos datos, solo actualizar campos específicos para evitar sobrescribir amounts
            return {
              ...prevData,
              // Campos que pueden cambiar externamente
              payment: newFacturaData.payment,
              deuda: newFacturaData.deuda,
              pago: newFacturaData.pago,
              fechapago: newFacturaData.fechapago,
              banco: newFacturaData.banco,
              totalAmount: newFacturaData.totalAmount,
              // Mantener invoiceItems del estado local, pero recalcular si hay nuevos items
              invoiceItems: recalcularAmounts(prevData.invoiceItems || newFacturaData.invoiceItems)
            };
          });
        }
      });
    };

    const loadServiciosAsociados = () => {
      // 2. Buscar todos los servicios que referencian esta factura
      const serviciosData = [];
      
      // Buscar en data/
      const dataRef = ref(database, "data");
      const unsubscribeData = onValue(dataRef, (dataSnapshot) => {
        const dataServicios = [];
        if (dataSnapshot.exists()) {
          const dataVal = dataSnapshot.val();
          Object.entries(dataVal).forEach(([id, registro]) => {
            if (registro.referenciaFactura === numeroFactura || registro.numerodefactura === numeroFactura) {
              dataServicios.push({ 
                ...registro, 
                id, 
                origin: "data",
                fecha: registro.fecha || "No definida"
              });
            }
          });
        }
        
        // Buscar en registrofechas/
        const registroFechasRef = ref(database, "registrofechas");
        onValue(registroFechasRef, (registroSnapshot) => {
          const registroServicios = [];
          if (registroSnapshot.exists()) {
            const registroVal = registroSnapshot.val();
            Object.entries(registroVal).forEach(([fecha, registros]) => {
              Object.entries(registros).forEach(([id, registro]) => {
                if (registro.referenciaFactura === numeroFactura || registro.numerodefactura === numeroFactura) {
                  registroServicios.push({ 
                    ...registro, 
                    id, 
                    fecha,
                    origin: "registrofechas"
                  });
                }
              });
            });
          }
          
          // Combinar ambos arrays
          setServiciosAsociados([...dataServicios, ...registroServicios]);
          setLoading(false);
        }, { onlyOnce: true });
      }, { onlyOnce: true });
    };

    const unsubscribeFactura = loadFacturaData();
    loadServiciosAsociados();

    return () => {
      if (unsubscribeFactura) unsubscribeFactura();
    };
  }, [numeroFactura]);

  // Función para actualizar campo de la factura
  const updateFacturaField = async (field, value) => {
    if (!numeroFactura) return;
    
    try {
      const facturaRef = ref(database, `facturas/${numeroFactura}`);
      await update(facturaRef, { [field]: value });
      
      setFacturaData(prev => ({ ...prev, [field]: value }));
      setHasUnsavedChanges(false);
      
    } catch (error) {
      console.error("Error actualizando factura:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el campo"
      });
    }
  };

  // Función para actualizar un item de la factura
  const updateFacturaItem = async (itemKey, field, value) => {
    if (!numeroFactura) return;
    
    try {
      const facturaRef = ref(database, `facturas/${numeroFactura}/invoiceItems/${itemKey}`);
      await update(facturaRef, { [field]: value });
      
      setFacturaData(prev => ({
        ...prev,
        invoiceItems: {
          ...prev.invoiceItems,
          [itemKey]: {
            ...prev.invoiceItems[itemKey],
            [field]: value
          }
        }
      }));
      
      // Recalcular el total de la factura
      const updatedItems = {
        ...facturaData.invoiceItems,
        [itemKey]: {
          ...facturaData.invoiceItems[itemKey],
          [field]: value
        }
      };
      
      const newTotal = Object.values(updatedItems).reduce((sum, item) => sum + (item.amount || 0), 0);
      const newDeuda = Math.max(0, newTotal - (facturaData.payment || 0));
      
      // Actualizar total y deuda en Firebase
      await update(ref(database, `facturas/${numeroFactura}`), {
        totalAmount: newTotal,
        deuda: newDeuda
      });
      
      setFacturaData(prev => ({
        ...prev,
        totalAmount: newTotal,
        deuda: newDeuda
      }));
      
      setHasUnsavedChanges(false);
      
    } catch (error) {
      console.error("Error actualizando item:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el item"
      });
    }
  };

  // Función para manejar cambio de item y actualizar rate automáticamente
  const handleItemChange = async (itemKey, newItem) => {
    const newRate = ITEM_RATES[newItem] || 0;
    const currentQty = facturaData.invoiceItems[itemKey]?.qty || 0;
    const newAmount = currentQty * newRate;
    
    try {
      const facturaRef = ref(database, `facturas/${numeroFactura}/invoiceItems/${itemKey}`);
      await update(facturaRef, { 
        item: newItem,
        rate: newRate,
        amount: newAmount
      });
      
      // Actualizar estado local
      setFacturaData(prev => ({
        ...prev,
        invoiceItems: {
          ...prev.invoiceItems,
          [itemKey]: {
            ...prev.invoiceItems[itemKey],
            item: newItem,
            rate: newRate,
            amount: newAmount
          }
        }
      }));
      
      // Recalcular totales
      const updatedItems = {
        ...facturaData.invoiceItems,
        [itemKey]: {
          ...facturaData.invoiceItems[itemKey],
          item: newItem,
          rate: newRate,
          amount: newAmount
        }
      };
      
      const newTotal = Object.values(updatedItems).reduce((sum, item) => sum + (item.amount || 0), 0);
      const newDeuda = Math.max(0, newTotal - (facturaData.payment || 0));
      
      await update(ref(database, `facturas/${numeroFactura}`), {
        totalAmount: newTotal,
        deuda: newDeuda
      });
      
      setFacturaData(prev => ({
        ...prev,
        totalAmount: newTotal,
        deuda: newDeuda
      }));
      
      setHasUnsavedChanges(true);
      
    } catch (error) {
      console.error("Error actualizando item:", error);
    }
  };

  // Función para recalcular amount cuando cambie qty (en tiempo real)
  const handleQtyChange = (itemKey, newQty) => {
    const currentRate = facturaData.invoiceItems[itemKey]?.rate || 0;
    const newAmount = newQty * currentRate;
    
    // Actualizar estado local inmediatamente para feedback visual
    setFacturaData(prev => ({
      ...prev,
      invoiceItems: {
        ...prev.invoiceItems,
        [itemKey]: {
          ...prev.invoiceItems[itemKey],
          qty: newQty,
          amount: newAmount
        }
      }
    }));
    
    // Recalcular totales inmediatamente
    const updatedItems = {
      ...facturaData.invoiceItems,
      [itemKey]: {
        ...facturaData.invoiceItems[itemKey],
        qty: newQty,
        amount: newAmount
      }
    };
    
    const newTotal = Object.values(updatedItems).reduce((sum, item) => sum + (item.amount || 0), 0);
    const newDeuda = Math.max(0, newTotal - (facturaData.payment || 0));
    
    setFacturaData(prev => ({
      ...prev,
      totalAmount: newTotal,
      deuda: newDeuda
    }));
    
    setHasUnsavedChanges(true);
  };

  // Función para guardar qty en Firebase (al hacer blur)
  const saveQtyToFirebase = async (itemKey, qty) => {
    const currentRate = facturaData.invoiceItems[itemKey]?.rate || 0;
    const newAmount = qty * currentRate;
    
    try {
      const facturaRef = ref(database, `facturas/${numeroFactura}/invoiceItems/${itemKey}`);
      await update(facturaRef, { 
        qty: qty,
        amount: newAmount
      });
      
      await update(ref(database, `facturas/${numeroFactura}`), {
        totalAmount: facturaData.totalAmount,
        deuda: facturaData.deuda
      });
      
      setHasUnsavedChanges(false);
      
    } catch (error) {
      console.error("Error guardando qty:", error);
    }
  };

  // Función para actualizar estado de pago de todos los servicios asociados
  const actualizarEstadoPagoServicios = async (estadoPago, fechaPago = null) => {
    try {
      const fechaPagoFinal = fechaPago || (estadoPago === "Pago" ? new Date().toISOString().split('T')[0] : null);
      
      const updatePromises = serviciosAsociados.map(async (servicio) => {
        const path = servicio.origin === "data" 
          ? `data/${servicio.id}` 
          : `registrofechas/${servicio.fecha}/${servicio.id}`;
        
        return update(ref(database, path), { 
          pago: estadoPago,
          fechapago: fechaPagoFinal
        });
      });

      await Promise.all(updatePromises);
      console.log(`✅ Estado de pago actualizado a "${estadoPago}" para ${serviciosAsociados.length} servicios`);
    } catch (error) {
      console.error("Error actualizando estado de pago:", error);
    }
  };

  // Función simplificada para registrar payment
  const registrarPayment = async (montoDirecto = null) => {
    if (!facturaData || !numeroFactura) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo cargar la información de la factura"
      });
      return;
    }

    let montoPayment = montoDirecto;
    
    // Si no viene un monto directo, preguntar al usuario
    if (!montoDirecto) {
      const result = await Swal.fire({
        title: "Registrar Payment",
        html: `
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Monto del payment (AWG)</label>
            <input id="monto-payment" type="number" class="swal2-input" placeholder="0.00" min="0" step="0.01" style="margin: 0; width: 80%;">
          </div>
          <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Deuda actual:</span>
              <span style="font-weight: bold; color: #dc3545;">AWG ${formatCurrency(facturaData.deuda)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Payments totales:</span>
              <span style="color: #28a745;">AWG ${formatCurrency(facturaData.payment || 0)}</span>
            </div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" id="pago-total" class="swal2-confirm swal2-styled" style="flex: 1;">Pago Total</button>
            <button type="button" id="mitad" class="swal2-confirm swal2-styled" style="flex: 1; background-color: #17a2b8;">50%</button>
          </div>
          <div style="color: #888; font-size: 12px; margin-top: 8px;">
            ¿Necesitas devolver un payment? Ingresa un valor negativo.
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Registrar Payment",
        cancelButtonText: "Cancelar",
        didOpen: () => {
          const montoInput = document.getElementById('monto-payment');
          const pagoTotalBtn = document.getElementById('pago-total');
          const mitadBtn = document.getElementById('mitad');
          
          pagoTotalBtn.onclick = () => {
            montoInput.value = facturaData.deuda.toFixed(2);
          };
          
          mitadBtn.onclick = () => {
            montoInput.value = (facturaData.deuda / 2).toFixed(2);
          };
          
          montoInput.focus();
        },
        preConfirm: () => {
          const value = document.getElementById('monto-payment').value;
          const paymentValue = parseFloat(value);
          if (isNaN(paymentValue) || paymentValue === 0) {
            Swal.showValidationMessage("Debe ingresar un monto distinto de 0");
            return false;
          }
          if (paymentValue > facturaData.deuda && paymentValue > 0) {
            Swal.showValidationMessage("El payment no puede ser mayor que la deuda actual");
            return false;
          }
          if (paymentValue < 0 && Math.abs(paymentValue) > (facturaData.payment || 0)) {
            Swal.showValidationMessage("No puede devolver más de lo que se ha pagado");
            return false;
          }
          return paymentValue;
        }
      });
      
      if (!result.isConfirmed) return;
      montoPayment = result.value;
    }

    try {
      const payment = parseFloat(montoPayment);
      const nuevosPayments = (facturaData.payment || 0) + payment;
      const nuevaDeuda = Math.max(0, facturaData.totalAmount - nuevosPayments);
      const facturaCompletamentePagada = nuevaDeuda === 0;
      
      // Actualizar la factura en Firebase
      const facturaRef = ref(database, `facturas/${numeroFactura}`);
      const updates = {
        payment: parseFloat(nuevosPayments.toFixed(2)),
        deuda: parseFloat(nuevaDeuda.toFixed(2))
      };

      if (facturaCompletamentePagada) {
        // Si está completamente pagada
        const fechaPagoFinal = facturaData.fechapago || new Date().toISOString().split('T')[0];
        updates.pago = "Pago";
        updates.fechapago = fechaPagoFinal;
      } else {
        // ✅ Si NO está completamente pagada (incluyendo devoluciones)
        updates.pago = "Debe";
        updates.fechapago = null;
      }

      await update(facturaRef, updates);
      console.log("✅ Factura actualizada en Firebase");

      // Actualizar estado local
      setFacturaData(prev => ({
        ...prev,
        payment: nuevosPayments,
        deuda: nuevaDeuda,
        pago: facturaCompletamentePagada ? "Pago" : "Debe", // ✅ Actualizar siempre
        fechapago: facturaCompletamentePagada ? (facturaData.fechapago || new Date().toISOString().split('T')[0]) : null // ✅ Actualizar siempre
      }));

      // ✅ ACTUALIZAR SERVICIOS ASOCIADOS SIEMPRE (no solo cuando está completamente pagada)
      const actualizarServiciosAsociados = async () => {
        try {
          // Buscar todos los servicios asociados a esta factura
          const [dataSnapshot, registroFechasSnapshot] = await Promise.all([
            new Promise((resolve) => onValue(ref(database, "data"), resolve, { onlyOnce: true })),
            new Promise((resolve) => onValue(ref(database, "registrofechas"), resolve, { onlyOnce: true }))
          ]);

          const serviciosAsociados = [];
          
          // Buscar en data
          if (dataSnapshot.exists()) {
            const dataVal = dataSnapshot.val();
            Object.entries(dataVal).forEach(([id, registro]) => {
              if (registro.referenciaFactura === numeroFactura || registro.numerodefactura === numeroFactura) {
                serviciosAsociados.push({ id, origin: "data" });
              }
            });
          }
          
          // Buscar en registrofechas
          if (registroFechasSnapshot.exists()) {
            const registroVal = registroFechasSnapshot.val();
            Object.entries(registroVal).forEach(([fecha, registros]) => {
              Object.entries(registros).forEach(([id, registro]) => {
                if (registro.referenciaFactura === numeroFactura || registro.numerodefactura === numeroFactura) {
                  serviciosAsociados.push({ id, fecha, origin: "registrofechas" });
                }
              });
            });
          }

          // ✅ Actualizar todos los servicios con el estado correcto
          const estadoPago = facturaCompletamentePagada ? "Pago" : "Debe";
          const fechaPago = facturaCompletamentePagada ? (facturaData.fechapago || new Date().toISOString().split('T')[0]) : null;

          const updatePromises = serviciosAsociados.map(servicio => {
            const path = servicio.origin === "data" 
              ? `data/${servicio.id}` 
              : `registrofechas/${servicio.fecha}/${servicio.id}`;
            
            return update(ref(database, path), { 
              pago: estadoPago,
              fechapago: fechaPago
            });
          });

          await Promise.all(updatePromises);
          console.log(`✅ Estado de pago actualizado a "${estadoPago}" para ${serviciosAsociados.length} servicios`);
        } catch (error) {
          console.error("Error actualizando servicios asociados:", error);
        }
      };

      await actualizarServiciosAsociados();

      // Mostrar mensaje de éxito
      if (facturaCompletamentePagada) {
        Swal.fire({
          icon: "success",
          title: "¡Factura Pagada Completamente!",
          html: `
            <div style="text-align: center;">
              <p>Se registró un payment de <strong>AWG ${formatCurrency(payment)}</strong></p>
              <p style="color: #28a745; font-weight: bold;">✅ La factura ha sido marcada como PAGADA</p>
              <p style="font-size: 14px; color: #6c757d;">Todos los servicios asociados fueron actualizados</p>
            </div>
          `,
          timer: 3000
        });
      } else {
        const esDevolucion = payment < 0;
        const tipoOperacion = esDevolucion ? "devolución" : "payment";
        const estadoFactura = nuevaDeuda > 0 ? "DEBE" : "PAGADA";
        
        Swal.fire({
          icon: "success",
          title: `${esDevolucion ? "Devolución" : "Payment"} Registrado`,
          html: `
            <div style="text-align: center;">
              <p>${esDevolucion ? "Devolución" : "Payment"} de <strong>AWG ${formatCurrency(Math.abs(payment))}</strong> registrado</p>
              <p>Deuda restante: <strong>AWG ${formatCurrency(nuevaDeuda)}</strong></p>
              <p style="color: ${nuevaDeuda > 0 ? '#dc3545' : '#28a745'}; font-weight: bold;">Estado: ${estadoFactura}</p>
              ${esDevolucion ? '<p style="font-size: 14px; color: #6c757d;">Todos los servicios asociados fueron actualizados</p>' : ''}
            </div>
          `,
          timer: 3000
        });
      }
    } catch (error) {
      console.error("Error registrando payment:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo registrar el payment. Inténtelo nuevamente."
      });
    }
  };

  // Función para agregar un nuevo item a la factura
  const agregarNuevoItem = async () => {
    if (!numeroFactura) return;
    
    try {
      // Contar items existentes y generar el siguiente número
      const existingItems = facturaData.invoiceItems || {};
      const itemKeys = Object.keys(existingItems);
      
      // Extraer números de las keys existentes (1, 2, 3, etc.)
      const itemNumbers = itemKeys
        .map(key => {
          const match = key.match(/^(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(num => num > 0);
      
      // Encontrar el siguiente número disponible
      const nextNumber = itemNumbers.length > 0 ? Math.max(...itemNumbers) + 1 : 1;
      const newItemKey = `${nextNumber}`;
    
      // Crear el nuevo item con valores por defecto
      const nuevoItem = {
        item: "",
        descripcion: "",
        qty: 1,
        rate: 0,
        amount: 0,
        fechaServicioItem: ""
      };
      
      // Agregar el item a Firebase
      const facturaRef = ref(database, `facturas/${numeroFactura}/invoiceItems/${newItemKey}`);
      await set(facturaRef, nuevoItem);
      
      // Actualizar estado local
      setFacturaData(prev => {
        const newInvoiceItems = {
          ...prev.invoiceItems,
          [newItemKey]: nuevoItem
        };
        
        // Recalcular totales
        const newTotal = Object.values(newInvoiceItems).reduce((sum, item) => sum + (item.amount || 0), 0);
        const newDeuda = Math.max(0, newTotal - (prev.payment || 0));
        
        return {
          ...prev,
          invoiceItems: newInvoiceItems,
          totalAmount: newTotal,
          deuda: newDeuda
        };
      });
      
      // Actualizar totales en Firebase
      await update(ref(database, `facturas/${numeroFactura}`), {
        totalAmount: facturaData.totalAmount,
        deuda: facturaData.deuda
      });
      
      setHasUnsavedChanges(true);
      
      console.log(`✅ Nuevo item agregado: ${newItemKey}`);
      
    } catch (error) {
      console.error("Error agregando nuevo item:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo agregar el nuevo item"
      });
    }
  };

  // Función para eliminar un item de la factura
  const eliminarItem = async (itemKey) => {
    if (!numeroFactura) return;
    
    try {
      // Confirmar eliminación
      const result = await Swal.fire({
        title: "¿Eliminar item?",
        text: "Esta acción no se puede deshacer",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
      });
      
      if (!result.isConfirmed) return;
      
      // Eliminar de Firebase
      const facturaRef = ref(database, `facturas/${numeroFactura}/invoiceItems/${itemKey}`);
      await set(facturaRef, null);
      
      // Actualizar estado local
      setFacturaData(prev => {
        const newInvoiceItems = { ...prev.invoiceItems };
        delete newInvoiceItems[itemKey];
        
        // Recalcular totales
        const newTotal = Object.values(newInvoiceItems).reduce((sum, item) => sum + (item.amount || 0), 0);
        const newDeuda = Math.max(0, newTotal - (prev.payment || 0));
        
        return {
          ...prev,
          invoiceItems: newInvoiceItems,
          totalAmount: newTotal,
          deuda: newDeuda
        };
      });
      
      // Actualizar totales en Firebase
      await update(ref(database, `facturas/${numeroFactura}`), {
        totalAmount: facturaData.totalAmount,
        deuda: facturaData.deuda
      });
      
      setHasUnsavedChanges(true);
      
      console.log(`✅ Item eliminado: ${itemKey}`);
      
    } catch (error) {
      console.error("Error eliminando item:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo eliminar el item"
      });
    }
  };

  // Función para guardar todos los cambios pendientes
  const guardarCambios = async () => {
    if (!hasUnsavedChanges) {
      Swal.fire({
        icon: "info",
        title: "No hay cambios",
        text: "No hay cambios pendientes para guardar",
        timer: 1500
      });
      return;
    }

    try {
      Swal.fire({
        title: "Guardando...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Actualizar factura completa en Firebase
      const facturaRef = ref(database, `facturas/${numeroFactura}`);
      await update(facturaRef, facturaData);
      
      setHasUnsavedChanges(false);
      setEditMode(false);
      
      Swal.fire({
        icon: "success",
        title: "Cambios Guardados",
        text: "Todos los cambios han sido guardados correctamente",
        timer: 2000
      });
      
    } catch (error) {
      console.error("Error guardando cambios:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron guardar los cambios"
      });
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : userId || "Sin asignar";
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "No disponible";
    return new Date(timestamp).toLocaleDateString();
  };

  // Función para recalcular amounts en invoiceItems
  const recalcularAmounts = (invoiceItems) => {
    if (!invoiceItems) return {};
    
    const itemsRecalculados = {};
    Object.entries(invoiceItems).forEach(([key, item]) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const amount = qty * rate;
      
      itemsRecalculados[key] = {
        ...item,
        amount: amount
      };
    });
    
    return itemsRecalculados;
  };

  const BANCO_OPTIONS = [
    "Aruba Bank N.V.",
    "Caribbean Mercantile Bank N.V.",
    "RBC Royal Bank N.V."
  ];

  const updateBancoInServicios = async (nuevoBanco) => {
    try {
      const updatePromises = serviciosAsociados.map(servicio => {
        const path = servicio.origin === "data" 
          ? `data/${servicio.id}` 
          : `registrofechas/${servicio.fecha}/${servicio.id}`;
        
        return update(ref(database, path), { banco: nuevoBanco });
      });

      await Promise.all(updatePromises);
      
      setServiciosAsociados(prev => 
        prev.map(servicio => ({ ...servicio, banco: nuevoBanco }))
      );
    } catch (error) {
      console.error("Error actualizando banco en servicios:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el banco en los servicios asociados"
      });
    }
  };

  const updateFacturaFieldWithSync = async (field, value) => {
    if (!numeroFactura) return;
    
    try {
      const facturaRef = ref(database, `facturas/${numeroFactura}`);
      await update(facturaRef, { [field]: value });
      
      setFacturaData(prev => ({ ...prev, [field]: value }));
      setHasUnsavedChanges(false);
      
      if (field === "banco") {
        await updateBancoInServicios(value);
      }
      
    } catch (error) {
      console.error("Error actualizando factura:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el campo"
      });
    }
  };

  // Función para manejar cambios en campos de texto
  const handleFieldChange = (field, value) => {
    setFacturaData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  if (loading) {
    return (
      <div style={{ 
        position: "fixed", 
        top: 0, 
        left: 0, 
        width: "100%", 
        height: "100%", 
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          textAlign: "center"
        }}>
          <div>Cargando...</div>
        </div>
      </div>
    );
  }

  if (!facturaData) {
    return (
      <div style={{ 
        position: "fixed", 
        top: 0, 
        left: 0, 
        width: "100%", 
        height: "100%", 
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          textAlign: "center"
        }}>
          <h3>Factura no encontrada</h3>
          <button onClick={onClose} style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="factura-modal">
      <div className="factura-modal-content">
        {/* Header */}
        <div className="factura-modal-header">
          <div>
            <h2 className="factura-modal-title">
              Factura #{numeroFactura}
            </h2>
            {(facturaData.deuda || 0) <= 0 && (
              <div style={{
                fontSize: "14px",
                color: "#28a745",
                fontWeight: "bold",
                marginTop: "4px"
              }}>
                ✅ PAGADA COMPLETAMENTE
                {facturaData.fechapago && (
                  <span style={{ fontSize: "12px", color: "#6c757d", marginLeft: "8px" }}>
                    ({new Date(facturaData.fechapago).toLocaleDateString()})
                  </span>
                )}
              </div>
            )}
            {hasUnsavedChanges && (
              <div style={{
                fontSize: "12px",
                color: "#ffc107",
                fontWeight: "bold",
                marginTop: "4px"
              }}>
                ⚠️ Cambios sin guardar
              </div>
            )}
          </div>
          <div className="factura-modal-buttons">
            {editMode && (
              <button 
                onClick={guardarCambios}
                className={`factura-modal-btn ${hasUnsavedChanges ? 'success' : 'secondary'}`}
                disabled={!hasUnsavedChanges}
              >
                {hasUnsavedChanges ? "Guardar Cambios" : "Guardado"}
              </button>
            )}
            <button 
              onClick={() => {
                if (hasUnsavedChanges) {
                  Swal.fire({
                    title: "¿Descartar cambios?",
                    text: "Tienes cambios sin guardar. ¿Deseas descartarlos?",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Sí, descartar",
                    cancelButtonText: "Cancelar"
                  }).then((result) => {
                    if (result.isConfirmed) {
                      setEditMode(!editMode);
                      setHasUnsavedChanges(false);
                    }
                  });
                } else {
                  setEditMode(!editMode);
                }
              }}
              className={`factura-modal-btn ${editMode ? 'secondary' : 'primary'}`}
            >
              {editMode ? "Cancelar" : "Editar"}
            </button>
            <button 
              onClick={onClose}
              className="factura-modal-btn danger"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Información de la Factura */}
        <div className="factura-info-grid">
          {/* Columna izquierda */}
          <div>
            <h3 style={{ color: "#495057", marginBottom: "15px" }}>Información General</h3>
            <div className="factura-info-section">
              <div>
                <label className="factura-info-label">
                  Fecha de Emisión:
                </label>
                {editMode ? (
                  <input
                    type="date"
                    value={facturaData.fechaEmision || new Date(facturaData.timestamp).toISOString().split('T')[0]}
                    onChange={(e) => handleFieldChange("fechaEmision", e.target.value)}
                    onBlur={(e) => updateFacturaField("fechaEmision", e.target.value)}
                    className="factura-info-input"
                  />
                ) : (
                  <span>{facturaData.fechaEmision || formatDate(facturaData.timestamp)}</span>
                )}
              </div>
              <div>
                <label className="factura-info-label">
                  Bill To:
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={facturaData.billTo || ""}
                    onChange={(e) => handleFieldChange("billTo", e.target.value)}
                    onBlur={(e) => updateFacturaField("billTo", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px",
                      border: "1px solid #ccc",
                      borderRadius: "4px"
                    }}
                  />
                ) : (
                  <span>{facturaData.billTo || "No especificado"}</span>
                )}
              </div>
              <div>
                <label className="factura-info-label">
                  Fecha de Pago:
                </label>
                {editMode ? (
                  <input
                    type="date"
                    value={facturaData.fechapago || ""}
                    onChange={(e) => handleFieldChange("fechapago", e.target.value)}
                    onBlur={(e) => updateFacturaField("fechapago", e.target.value)}
                    className="factura-info-input"
                  />
                ) : (
                  <span>
                    {facturaData.fechapago 
                      ? facturaData.fechapago
                      : "No especificada"
                    }
                  </span>
                )}
              </div>
              <div>
                <label className="factura-info-label">
                  Banco:
                </label>
                {editMode ? (
                  <select
                    value={facturaData.banco || ""}
                    onChange={(e) => handleFieldChange("banco", e.target.value)}
                    onBlur={(e) => updateFacturaFieldWithSync("banco", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px",
                      border: "1px solid #ccc",
                      borderRadius: "4px"
                    }}
                  >
                    <option value="">Seleccionar banco...</option>
                    {BANCO_OPTIONS.map((banco) => (
                      <option key={banco} value={banco}>
                        {banco}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{facturaData.banco || "No especificado"}</span>
                )}
              </div>
            </div>
          </div>

          {/* Columna derecha */}
          <div>
            <h3 style={{ color: "#495057", marginBottom: "15px" }}>Resumen Financiero</h3>
            
            {/* Estado de la factura */}
            <div style={{
              padding: "10px",
              borderRadius: "6px",
              marginBottom: "15px",
              textAlign: "center",
              backgroundColor: (facturaData.deuda || 0) > 0 ? "#fff3cd" : "#d1edff",
              border: `2px solid ${(facturaData.deuda || 0) > 0 ? "#ffc107" : "#28a745"}`,
              color: (facturaData.deuda || 0) > 0 ? "#856404" : "#155724"
            }}>
              <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                {(facturaData.deuda || 0) > 0 ? "PENDIENTE DE PAGO" : "✅ PAGADA COMPLETAMENTE"}
              </div>
              {(facturaData.deuda || 0) > 0 && (
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  Deuda pendiente: AWG {formatCurrency(facturaData.deuda)}
                </div>
              )}
            </div>

            <div style={{ 
              backgroundColor: "#f8f9fa", 
              padding: "15px", 
              borderRadius: "6px",
              border: "1px solid #dee2e6"
            }}>
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: "bold" }}>Total:</span>
                  <span style={{ fontWeight: "bold", fontSize: "1.1em" }}>
                    AWG {formatCurrency(facturaData.totalAmount)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Payments:</span>
                  <span style={{ color: "#28a745" }}>
                    AWG {formatCurrency(facturaData.payment || 0)}
                  </span>
                </div>
                
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  borderTop: "1px solid #dee2e6",
                  paddingTop: "8px",
                  marginTop: "8px"
                }}>
                  <span style={{ fontWeight: "bold" }}>Deuda:</span>
                  <span style={{ 
                    fontWeight: "bold", 
                    fontSize: "1.2em",
                    color: (facturaData.deuda || 0) > 0 ? "#dc3545" : "#28a745"
                  }}>
                    AWG {formatCurrency(facturaData.deuda || 0)}
                  </span>
                </div>
              </div>
              
              {/* Botones de payment */}
              <div style={{ marginTop: "15px", display: "grid", gap: "8px" }}>
                <button
                  onClick={() => registrarPayment()}
                  style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Registrar Payment / Devolución
                </button>
                {(facturaData.deuda || 0) > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button
                      onClick={() => registrarPayment(facturaData.deuda / 2)}
                      style={{
                        padding: "8px",
                        backgroundColor: "#17a2b8",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      50% (AWG {formatCurrency(facturaData.deuda / 2)})
                    </button>
                    <button
                      onClick={() => registrarPayment(facturaData.deuda)}
                      style={{
                        padding: "8px",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Pago Total
                    </button>
                  </div>
                )}
                {/* Botones de devolución */}
                {(facturaData.payment || 0) > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                    <button
                      onClick={() => registrarPayment(-facturaData.payment / 2)}
                      style={{
                        padding: "8px",
                        backgroundColor: "#ffc107",
                        color: "#212529",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Devolver 50% (AWG {formatCurrency(facturaData.payment / 2)})
                    </button>
                    <button
                      onClick={() => registrarPayment(-facturaData.payment)}
                      style={{
                        padding: "8px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Devolver Total (AWG {formatCurrency(facturaData.payment)})
                    </button>
                  </div>
                )}
                {(facturaData.deuda || 0) === 0 && (
                  <div style={{
                    marginTop: "10px",
                    padding: "10px",
                    backgroundColor: "#d4edda",
                    color: "#155724",
                    borderRadius: "4px",
                    textAlign: "center",
                    fontWeight: "bold"
                  }}>
                    ✅ Factura Pagada Completamente
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Items de la Factura */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: "15px" 
          }}>
            <h3 style={{ color: "#495057", margin: 0 }}>Items de la Factura</h3>
            {editMode && (
              <button
                onClick={agregarNuevoItem}
                className="factura-add-item-btn"
              >
                + Agregar Item
              </button>
            )}
          </div>
          {facturaData.invoiceItems ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ 
                width: "100%", 
                borderCollapse: "collapse",
                border: "1px solid #dee2e6"
              }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8f9fa" }}>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "center" }}>Fecha</th>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "left" }}>Item</th>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "left" }}>Descripción</th>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "center" }}>Qty</th>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "right" }}>Rate</th>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "right" }}>Amount</th>
                    
                    {editMode && (
                      <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "center" }}>Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(facturaData.invoiceItems)
                    .sort(([keyA], [keyB]) => {
                      // Convertir keys a números para ordenar correctamente
                      const numA = parseInt(keyA) || 0;
                      const numB = parseInt(keyB) || 0;
                      return numA - numB;
                    })
                    .map(([key, item]) => (
                    <tr key={key}>
                       <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "center" }}>
                        {editMode ? (
                          <input
                            type="date"
                            value={item.fechaServicioItem || ""}
                            onChange={(e) => {
                              const newFecha = e.target.value;
                              setFacturaData(prev => ({
                                ...prev,
                                invoiceItems: {
                                  ...prev.invoiceItems,
                                  [key]: { ...prev.invoiceItems[key], fechaServicioItem: newFecha }
                                }
                              }));
                              setHasUnsavedChanges(true);
                            }}
                            onBlur={(e) => updateFacturaItem(key, "fechaServicioItem", e.target.value)}
                            className="factura-info-input"
                            style={{
                              fontSize: "11px"
                            }}
                          />
                        ) : (
                          item.fechaServicioItem || "No especificada"
                        )}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6" }}>
                          {editMode ? (
                            <select
                              value={item.item || ""}
                              onChange={(e) => handleItemChange(key, e.target.value)}
                              className="factura-info-input"
                            >
                            <option value="">Seleccione un item...</option>
                            {Object.keys(ITEM_RATES).map((itemName) => (
                              <option key={itemName} value={itemName}>
                                {itemName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.item || "N/A"
                        )}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6" }}>
                        {editMode ? (
                          <textarea
                            value={item.descripcion || ""}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setFacturaData(prev => ({
                                ...prev,
                                invoiceItems: {
                                  ...prev.invoiceItems,
                                  [key]: { ...prev.invoiceItems[key], descripcion: newValue }
                                }
                              }));
                              setHasUnsavedChanges(true);
                            }}
                            onBlur={(e) => updateFacturaItem(key, "descripcion", e.target.value)}
                            className="factura-info-input"
                            style={{
                              minHeight: "60px",
                              resize: "vertical"
                            }}
                          />
                        ) : (
                          item.descripcion || "Sin descripción"
                        )}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "center" }}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.qty || ""}
                            onChange={(e) => {
                              const newQty = parseFloat(e.target.value) || 0;
                              handleQtyChange(key, newQty);
                            }}
                            onBlur={(e) => {
                              const newQty = parseFloat(e.target.value) || 0;
                              saveQtyToFirebase(key, newQty);
                            }}
                            className="factura-info-input"
                            style={{
                              width: "60px",
                              textAlign: "center"
                            }}
                          />
                        ) : (
                          item.qty || 0
                        )}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "right" }}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate || ""}
                            onChange={(e) => {
                              const newRate = parseFloat(e.target.value) || 0;
                              setFacturaData(prev => ({
                                ...prev,
                                invoiceItems: {
                                  ...prev.invoiceItems,
                                  [key]: {
                                    ...prev.invoiceItems[key],
                                    rate: newRate,
                                    amount: (item.qty || 0) * newRate
                                  }
                                }
                              }));
                              setHasUnsavedChanges(true);
                            }}
                            onBlur={(e) => {
                              const newRate = parseFloat(e.target.value) || 0;
                              updateFacturaItem(key, "rate", newRate);
                            }}
                            className="factura-info-input"
                            style={{
                              width: "70px",
                              textAlign: "right"
                            }}
                          />
                        ) : (
                          <div>
                            AWG {formatCurrency(item.rate || 0)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "right" }}>
                        <span style={{ fontWeight: "bold" }}>
                          AWG {formatCurrency(item.amount || 0)}
                        </span>
                      </td>
                      {editMode && (
                        <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "center" }}>
                          <button
                            onClick={() => eliminarItem(key)}
                            className="factura-delete-item-btn"
                            title="Eliminar item"
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "#6c757d", fontStyle: "italic" }}>No hay items registrados</p>
          )}
        </div>

        {/* Servicios Asociados */}
        <div>
          <h3 style={{ color: "#495057", marginBottom: "15px" }}>
            Servicios Asociados ({serviciosAsociados.length})
          </h3>
          {serviciosAsociados.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ 
                width: "100%", 
                borderCollapse: "collapse",
                border: "1px solid #dee2e6"
              }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8f9fa" }}>
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "left" }}>Fecha</th>
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "left" }}>Realizado Por</th>
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "left" }}>A Nombre De</th>
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "left" }}>Dirección</th>
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "left" }}>Servicio</th>
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "center" }}>Cúbicos</th>
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "right" }}>Valor</th>
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "right" }}>Payment</th>
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "left" }}>Banco</th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosAsociados.map((servicio, index) => (
                    <tr key={`${servicio.origin}_${servicio.id}`}>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", fontSize: "12px" }}>
                        {editMode ? (
                          <input
                            type="date"
                            value={servicio.fecha ? servicio.fecha.split('-').reverse().join('-') : ''}
                            onChange={(e) => {
                              // Convertir de DD-MM-YYYY a YYYY-MM-DD para Firebase
                              const [day, month, year] = e.target.value.split('-');
                              const fechaFormateada = `${day}-${month}-${year}`;
                              
                              // Actualizar estado local
                              setServiciosAsociados(prev => 
                                prev.map((s, i) => 
                                  i === index ? { ...s, fecha: fechaFormateada } : s
                                )
                              );
                              setHasUnsavedChanges(true);
                            }}
                            onBlur={async (e) => {
                              // Guardar en Firebase
                              const [day, month, year] = e.target.value.split('-');
                              const fechaFormateada = `${day}-${month}-${year}`;
                              
                              try {
                                const path = servicio.origin === "data" 
                                  ? `data/${servicio.id}` 
                                  : `registrofechas/${servicio.fecha}/${servicio.id}`;
                                
                                await update(ref(database, path), { fecha: fechaFormateada });
                                
                                // Si el origen es registrofechas, también mover el registro a la nueva fecha
                                if (servicio.origin === "registrofechas" && fechaFormateada !== servicio.fecha) {
                                  // Crear en nueva fecha
                                  await set(ref(database, `registrofechas/${fechaFormateada}/${servicio.id}`), servicio);
                                  // Eliminar de fecha anterior
                                  await set(ref(database, `registrofechas/${servicio.fecha}/${servicio.id}`), null);
                                }
                              } catch (error) {
                                console.error("Error actualizando fecha de servicio:", error);
                                Swal.fire({
                                  icon: "error",
                                  title: "Error",
                                  text: "No se pudo actualizar la fecha del servicio"
                                });
                              }
                            }}
                            className="factura-info-input"
                            style={{
                              fontSize: "11px"
                            }}
                          />
                        ) : (
                          servicio.fecha
                        )}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", fontSize: "12px" }}>
                        {getUserName(servicio.realizadopor)}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", fontSize: "12px" }}>
                        {servicio.anombrede || "No especificado"}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", fontSize: "12px" }}>
                        {servicio.direccion || "No especificada"}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", fontSize: "12px" }}>
                        {servicio.servicio || "No especificado"}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", textAlign: "center", fontSize: "12px" }}>
                        {servicio.cubicos || 0}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", textAlign: "right", fontSize: "12px" }}>
                        AWG {formatCurrency(servicio.valor || 0)}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", textAlign: "right", fontSize: "12px" }}>
                        AWG {formatCurrency(servicio.payment || 0)}
                      </td>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", fontSize: "12px" }}>
                        {servicio.banco || "No especificado"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "#6c757d", fontStyle: "italic" }}>No hay servicios asociados</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacturaViewEdit;