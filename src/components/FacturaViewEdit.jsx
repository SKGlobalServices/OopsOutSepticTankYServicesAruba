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
          setFacturaData(facturaSnapshot.val());
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
      
      setHasUnsavedChanges(false);
      
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

    if (facturaData.deuda <= 0) {
      Swal.fire({
        icon: "info",
        title: "Factura ya pagada",
        text: "Esta factura ya está completamente pagada"
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
          if (!value || parseFloat(value) <= 0) {
            Swal.showValidationMessage("Debe ingresar un monto válido mayor a 0");
            return false;
          }
          if (parseFloat(value) > facturaData.deuda) {
            Swal.showValidationMessage("El payment no puede ser mayor que la deuda actual");
            return false;
          }
          return parseFloat(value);
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
      
      console.log(`Registrando payment: AWG ${payment}`);
      console.log(`Payments actuales: AWG ${facturaData.payment || 0}`);
      console.log(`Nuevos payments: AWG ${nuevosPayments}`);
      console.log(`Nueva deuda: AWG ${nuevaDeuda}`);
      
      // Actualizar la factura en Firebase
      const facturaRef = ref(database, `facturas/${numeroFactura}`);
      const updates = {
        payment: parseFloat(nuevosPayments.toFixed(2)),
        deuda: parseFloat(nuevaDeuda.toFixed(2))
      };

      // Si está completamente pagada, actualizar estado
      const fechaPagoFinal = facturaData.fechapago || new Date().toISOString().split('T')[0];
      if (facturaCompletamentePagada) {
        updates.pago = "Pago";
        updates.fechapago = fechaPagoFinal;
      }

      await update(facturaRef, updates);
      console.log("✅ Factura actualizada en Firebase");

      // Actualizar estado local
      setFacturaData(prev => ({
        ...prev,
        payment: nuevosPayments,
        deuda: nuevaDeuda,
        pago: facturaCompletamentePagada ? "Pago" : prev.pago,
        fechapago: facturaCompletamentePagada ? fechaPagoFinal : prev.fechapago
      }));

      // Si está completamente pagada, actualizar servicios asociados
      if (facturaCompletamentePagada) {
        await actualizarEstadoPagoServicios("Pago", fechaPagoFinal);
      }

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
        Swal.fire({
          icon: "success",
          title: "Payment Registrado",
          text: `Payment de AWG ${formatCurrency(payment)} registrado. Deuda restante: AWG ${formatCurrency(nuevaDeuda)}`,
          timer: 2000
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
      zIndex: 1000,
      overflow: "auto"
    }}>
      <div style={{
        backgroundColor: "white",
        width: "95%",
        maxWidth: "1200px",
        maxHeight: "90%",
        borderRadius: "8px",
        overflow: "auto",
        padding: "20px"
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          borderBottom: "2px solid #eee",
          paddingBottom: "10px"
        }}>
          <div>
            <h2 style={{ margin: 0, color: "#2196F3" }}>
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
          <div style={{ display: "flex", gap: "10px" }}>
            {editMode && (
              <button 
                onClick={guardarCambios}
                style={{
                  padding: "8px 16px",
                  backgroundColor: hasUnsavedChanges ? "#28a745" : "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: hasUnsavedChanges ? "pointer" : "not-allowed",
                  fontWeight: "bold"
                }}
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
              style={{
                padding: "8px 16px",
                backgroundColor: editMode ? "#6c757d" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              {editMode ? "Cancelar" : "Editar"}
            </button>
            <button 
              onClick={onClose}
              style={{
                padding: "8px 16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Información de la Factura */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px"
        }}>
          {/* Columna izquierda */}
          <div>
            <h3 style={{ color: "#495057", marginBottom: "15px" }}>Información General</h3>
            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <label style={{ fontWeight: "bold", display: "block", marginBottom: "5px" }}>
                  Fecha de Emisión:
                </label>
                <span>{formatDate(facturaData.timestamp)}</span>
              </div>
              <div>
                <label style={{ fontWeight: "bold", display: "block", marginBottom: "5px" }}>
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
                <label style={{ fontWeight: "bold", display: "block", marginBottom: "5px" }}>
                  Fecha de Pago:
                </label>
                {editMode ? (
                  <input
                    type="date"
                    value={facturaData.fechapago || ""}
                    onChange={(e) => handleFieldChange("fechapago", e.target.value)}
                    onBlur={(e) => updateFacturaField("fechapago", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px",
                      border: "1px solid #ccc",
                      borderRadius: "4px"
                    }}
                  />
                ) : (
                  <span>
                    {facturaData.fechapago 
                      ? new Date(facturaData.fechapago).toLocaleDateString()
                      : "No especificada"
                    }
                  </span>
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
              {(facturaData.deuda || 0) > 0 ? (
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
                    Registrar Payment
                  </button>
                  
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
                </div>
              ) : (
                <div style={{
                  marginTop: "15px",
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

        {/* Items de la Factura */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ color: "#495057", marginBottom: "15px" }}>Items de la Factura</h3>
          {facturaData.invoiceItems ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ 
                width: "100%", 
                borderCollapse: "collapse",
                border: "1px solid #dee2e6"
              }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8f9fa" }}>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "left" }}>Item</th>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "left" }}>Descripción</th>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "center" }}>Qty</th>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "right" }}>Rate</th>
                    <th style={{ padding: "10px", border: "1px solid #dee2e6", textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(facturaData.invoiceItems).map(([key, item]) => (
                    <tr key={key}>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6" }}>
                        {editMode ? (
                          <select
                            value={item.item || ""}
                            onChange={(e) => handleItemChange(key, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "4px",
                              border: "1px solid #ccc",
                              borderRadius: "3px"
                            }}
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
                            style={{
                              width: "100%",
                              padding: "4px",
                              border: "1px solid #ccc",
                              borderRadius: "3px",
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
                            style={{
                              width: "60px",
                              padding: "4px",
                              border: "1px solid #ccc",
                              borderRadius: "3px",
                              textAlign: "center"
                            }}
                          />
                        ) : (
                          item.qty || 0
                        )}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "right" }}>
                        <div style={{
                          padding: "4px",
                          backgroundColor: editMode ? "#f8f9fa" : "transparent",
                          borderRadius: "3px",
                          color: editMode ? "#6c757d" : "inherit",
                          fontStyle: editMode ? "italic" : "normal"
                        }}>
                          AWG {formatCurrency(item.rate || 0)}
                          {editMode && (
                            <div style={{ fontSize: "10px", marginTop: "2px" }}>
                              (Rate fijo)
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "right" }}>
                        <span style={{ fontWeight: "bold" }}>
                          AWG {formatCurrency(item.amount || 0)}
                        </span>
                      </td>
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
                  </tr>
                </thead>
                <tbody>
                  {serviciosAsociados.map((servicio, index) => (
                    <tr key={`${servicio.origin}_${servicio.id}`}>
                      <td style={{ padding: "6px", border: "1px solid #dee2e6", fontSize: "12px" }}>
                        {servicio.fecha}
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