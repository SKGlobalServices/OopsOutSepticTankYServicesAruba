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

const FacturaViewEdit = ({ numeroFactura, onClose }) => {
  const [facturaData, setFacturaData] = useState(null);
  const [serviciosAsociados, setServiciosAsociados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [invoiceConfig, setInvoiceConfig] = useState({});
  const [users, setUsers] = useState([]);

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
      
      Swal.fire({
        icon: "success",
        title: "Actualizado",
        text: "Campo actualizado correctamente",
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error("Error actualizando factura:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el campo"
      });
    }
  };

  // Función para actualizar estado de pago de todos los servicios asociados
  const actualizarEstadoPagoServicios = async (estadoPago) => {
    try {
      const updatePromises = serviciosAsociados.map(async (servicio) => {
        const path = servicio.origin === "data" 
          ? `data/${servicio.id}` 
          : `registrofechas/${servicio.fecha}/${servicio.id}`;
        
        return update(ref(database, path), { 
          pago: estadoPago,
          fechapago: estadoPago === "Pago" ? new Date().toISOString().split('T')[0] : null
        });
      });

      await Promise.all(updatePromises);
      console.log(`✅ Estado de pago actualizado a "${estadoPago}" para ${serviciosAsociados.length} servicios`);
    } catch (error) {
      console.error("Error actualizando estado de pago:", error);
    }
  };

  // Función para registrar abono y actualizar deuda automáticamente
  const registrarAbono = async (montoDirecto = null) => {
    let montoAbono = montoDirecto;
    
    if (!montoDirecto) {
      const result = await Swal.fire({
        title: "Registrar Abono",
        html: `
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Monto del abono (AWG)</label>
            <input id="monto-abono" type="number" class="swal2-input" placeholder="0.00" min="0" step="0.01" style="margin: 0; width: 80%;">
          </div>
          <div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Deuda actual:</span>
              <span style="font-weight: bold; color: #dc3545;">AWG ${formatCurrency(facturaData.deuda)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Abonos totales:</span>
              <span style="color: #28a745;">AWG ${formatCurrency(facturaData.abonos || 0)}</span>
            </div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" id="pago-total" class="swal2-confirm swal2-styled" style="flex: 1;">Pago Total</button>
            <button type="button" id="mitad" class="swal2-confirm swal2-styled" style="flex: 1; background-color: #17a2b8;">50%</button>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Registrar",
        cancelButtonText: "Cancelar",
        didOpen: () => {
          const montoInput = document.getElementById('monto-abono');
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
          const value = document.getElementById('monto-abono').value;
          if (!value || parseFloat(value) <= 0) {
            Swal.showValidationMessage("Debe ingresar un monto válido mayor a 0");
            return false;
          }
          if (parseFloat(value) > facturaData.deuda) {
            Swal.showValidationMessage("El abono no puede ser mayor que la deuda actual");
            return false;
          }
          return parseFloat(value);
        }
      });
      
      if (!result.isConfirmed) return;
      montoAbono = result.value;
    }

    const abono = parseFloat(montoAbono);
    const nuevosAbonos = (facturaData.abonos || 0) + abono;
    const nuevaDeuda = Math.max(0, facturaData.totalAmount - nuevosAbonos);
    const facturaCompletamentePagada = nuevaDeuda === 0;
    
    try {
      // Actualizar la factura
      const facturaRef = ref(database, `facturas/${numeroFactura}`);
      const facturaUpdates = {
        abonos: parseFloat(nuevosAbonos.toFixed(2)),
        deuda: parseFloat(nuevaDeuda.toFixed(2))
      };

      // Si está completamente pagada, actualizar el estado en la factura también
      if (facturaCompletamentePagada) {
        facturaUpdates.pago = "Pago";
        facturaUpdates.fechapago = new Date().toISOString().split('T')[0];
      }

      await update(facturaRef, facturaUpdates);

      // Si está completamente pagada, actualizar todos los servicios asociados
      if (facturaCompletamentePagada) {
        await actualizarEstadoPagoServicios("Pago");
      }

      // Actualizar estado local
      setFacturaData(prev => ({
        ...prev,
        abonos: nuevosAbonos,
        deuda: nuevaDeuda,
        pago: facturaCompletamentePagada ? "Pago" : prev.pago,
        fechapago: facturaCompletamentePagada ? new Date().toISOString().split('T')[0] : prev.fechapago
      }));

      // Mostrar mensaje de éxito
      if (facturaCompletamentePagada) {
        Swal.fire({
          icon: "success",
          title: "¡Factura Pagada Completamente!",
          html: `
            <div style="text-align: center;">
              <p>Se registró un abono de <strong>AWG ${formatCurrency(abono)}</strong></p>
              <p style="color: #28a745; font-weight: bold;">✅ La factura ha sido marcada como PAGADA</p>
              <p style="font-size: 14px; color: #6c757d;">Todos los servicios asociados fueron actualizados automáticamente</p>
            </div>
          `,
          timer: 3000
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "Abono Registrado",
          text: `Se registró un abono de AWG ${formatCurrency(abono)}. Deuda restante: AWG ${formatCurrency(nuevaDeuda)}`,
          timer: 2000
        });
      }
    } catch (error) {
      console.error("Error registrando abono:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo registrar el abono"
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
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={() => setEditMode(!editMode)}
              style={{
                padding: "8px 16px",
                backgroundColor: editMode ? "#6c757d" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              {editMode ? "Ver" : "Editar"}
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
                    onChange={(e) => setFacturaData(prev => ({ ...prev, billTo: e.target.value }))}
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
                  <span>Abonos:</span>
                  <span style={{ color: "#28a745" }}>
                    AWG {formatCurrency(facturaData.abonos || 0)}
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
              
              {/* Botones de abono */}
              {(facturaData.deuda || 0) > 0 ? (
                <div style={{ marginTop: "15px", display: "grid", gap: "8px" }}>
                  <button
                    onClick={registrarAbono}
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
                    Registrar Abono
                  </button>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button
                      onClick={() => registrarAbono(facturaData.deuda / 2)}
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
                      onClick={() => registrarAbono(facturaData.deuda)}
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
                  {Object.values(facturaData.invoiceItems).map((item, index) => (
                    <tr key={index}>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6" }}>
                        {item.item || "N/A"}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6" }}>
                        {item.descripcion || "Sin descripción"}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "center" }}>
                        {item.qty || 0}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "right" }}>
                        AWG {formatCurrency(item.rate || 0)}
                      </td>
                      <td style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "right" }}>
                        AWG {formatCurrency(item.amount || 0)}
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
                    <th style={{ padding: "8px", border: "1px solid #dee2e6", textAlign: "right" }}>Abono</th>
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
                        AWG {formatCurrency(servicio.abono || 0)}
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