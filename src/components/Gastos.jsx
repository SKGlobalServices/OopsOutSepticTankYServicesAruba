import React, { useEffect, useMemo, useRef, useState } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue, push, remove, set } from "firebase/database";
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
  const [categorias, setCategorias] = useState([]);

  // Carga gastos
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

  // Carga/Inicializa categorías desde /catalogos/gastosCategorias
  useEffect(() => {
    const catRef = ref(database, "catalogos/gastosCategorias");
    const unsubscribe = onValue(catRef, async (snap) => {
      if (snap.exists()) {
        const arr = Array.isArray(snap.val()) ? snap.val() : [];
        setCategorias(arr.filter(Boolean).map(String));
      } else {
        // Si el catálogo no existe, detecta desde los gastos actuales
        const detectadas = Array.from(
          new Set(gastos.map((g) => (g.categoria || "").trim()).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));

        // Persiste el catálogo detectado (puede ser [] si aún no hay categorías)
        await set(catRef, detectadas);
        setCategorias(detectadas);
      }
    });

    return () => unsubscribe();
  }, [gastos]);

  const guardarCategorias = async (lista) => {
    const limpias = Array.from(
      new Set((lista || []).map((s) => s.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    await set(ref(database, "catalogos/gastosCategorias"), limpias);
    setCategorias(limpias);
    return limpias;
  };

  /* ---------- Editor de Categorías ---------- */
  const abrirEditorCategorias = async ({ onClose } = {}) => {
    let categoriasLocal = [...categorias];
    let filtroTexto = false;

    const renderLista = () => `
      <div class="cat-modal">
        <div class="cat-toolbar">
          <div class="cat-toolbar-left">
            <button id="btn-cat-add" class="cat-btn cat-btn-success" title="Agregar categoría">➕ Agregar</button>
            <button id="btn-cat-del" class="cat-btn cat-btn-danger" title="Eliminar seleccionadas">🗑️ Eliminar</button>
            <button id="btn-cat-save" class="cat-btn cat-btn-primary" title="Guardar cambios">💾 Guardar</button>
          </div>
          <div class="cat-toolbar-right">
            <input id="cat-input" class="cat-input" placeholder="Nueva categoría...">
          </div>
        </div>

        <div class="cat-subtoolbar">
          <div class="cat-search-wrap">
            <input id="cat-search" class="cat-search" placeholder="Buscar en categorías...">
          </div>
          <div class="cat-actions-right">
            <label class="cat-selectall">
              <input type="checkbox" id="cat-all"> Seleccionar todo
            </label>
            <span id="cat-count" class="cat-badge">${
              categoriasLocal.length
            } categoría(s)</span>
          </div>
        </div>

        <div id="cat-list" class="cat-list">
          ${categoriasLocal
            .map(
              (c, i) => `
            <label class="cat-item">
              <input type="checkbox" class="cat-check" data-index="${i}">
              <span class="cat-name" title="${c}">${c}</span>
            </label>`
            )
            .join("")}
          ${
            categoriasLocal.length === 0
              ? `<div class="cat-empty">(Sin categorías)</div>`
              : ""
          }
        </div>
      </div>
    `;

    const abrirSwalEditor = async () => {
      await Swal.fire({
        title: "Editar categorías",
        html: renderLista(),
        width: 680,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: "Cerrar",
        reverseButtons: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          // ===== Estilos centralizados =====
          const style = document.createElement("style");
          style.textContent = `
            .swal2-cancel {
            background: #2276c5ff !important; /* Verde */
            color: #fff !important;
            font-weight: 700;
            border-radius: 10px;
            padding: 9px 16px;
            }
            .swal2-cancel:hover { filter: brightness(1.1); }
            .cat-modal { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Helvetica Neue", sans-serif; }
            .cat-toolbar {
              display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px;
              padding:8px; background:#f6f8ff; border:1px solid #e5e7fb; border-radius:10px;
            }
            .cat-toolbar-left { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
            .cat-toolbar-right { display:flex; gap:8px; width: 50%; min-width: 240px; }
            .cat-btn {
              border:none; border-radius:10px; padding:9px 14px; font-weight:700; cursor:pointer;
              transition:transform .08s ease, box-shadow .12s ease, filter .12s ease;
              box-shadow:0 2px 6px rgba(0,0,0,.06);
              display:inline-flex; align-items:center; gap:6px;
            }
            .cat-btn:hover { filter:brightness(1.05); box-shadow:0 6px 18px rgba(0,0,0,.12); }
            .cat-btn:active { transform: translateY(1px); }
            .cat-btn-success { background:#22c55e; color:#fff; }
            .cat-btn-danger { background:#ef4444; color:#fff; }
            .cat-btn-primary { background:#5271ff; color:#fff; }

            .cat-input {
              flex:1; height:2.8em; padding:0 12px; font-size:14px; border:1px solid #d9defb; border-radius:10px;
              outline:none; transition:border-color .12s ease, box-shadow .12s ease; background:#fff;
            }
            .cat-input:focus { border-color:#5271ff; box-shadow:0 0 0 3px rgba(82,113,255,.15); }

            .cat-subtoolbar {
              display:flex; align-items:center; justify-content:space-between; gap:10px; margin:8px 0 8px 0;
            }
            .cat-search-wrap { flex:1; display:flex; }
            .cat-search {
              width:100%; height:2.6em; border:1px solid #e2e6fb; border-radius:10px; padding:0 12px;
              outline:none; transition:border-color .12s ease, box-shadow .12s ease;
            }
            .cat-search:focus { border-color:#5271ff; box-shadow:0 0 0 3px rgba(82,113,255,.12); }
            .cat-actions-right { display:flex; align-items:center; gap:12px; }
            .cat-selectall { display:flex; align-items:center; gap:6px; user-select:none; }

            .cat-badge {
              background:#eef2ff; color:#3949ab; border:1px solid #dfe4ff; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:800;
            }

            .cat-list {
              max-height:320px; overflow:auto; border:1px solid #ececf3; border-radius:10px; padding:6px; background:#fff;
            }
            .cat-item {
              display:flex; align-items:center; gap:10px; padding:10px 8px; border-bottom:1px dashed #f1f1f6;
            }
            .cat-item:last-child { border-bottom:none; }
            .cat-check { width:18px; height:18px; }
            .cat-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:14px; }
            .cat-empty { color:#8a8a98; text-align:center; padding:16px 0; }
          `;
          document.body.appendChild(style);

          const input = document.getElementById("cat-input");
          const cont = document.getElementById("cat-list");
          const badge = document.getElementById("cat-count");
          const search = document.getElementById("cat-search");
          const checkAll = document.getElementById("cat-all");
          const btnCancel = document.querySelector(".swal2-cancel");

          const pintar = (lista = categoriasLocal) => {
            if (!cont) return;
            const texto = (search?.value || "").toLowerCase().trim();
            const filtradas = texto
              ? lista.filter((c) => c.toLowerCase().includes(texto))
              : lista;
            cont.innerHTML = filtradas
              .map(
                (c, i) => `
              <label class="cat-item">
                <input type="checkbox" class="cat-check" data-index="${i}">
                <span class="cat-name" title="${c}">${c}</span>
              </label>`
              )
              .join("");
            if (filtradas.length === 0)
              cont.innerHTML = `<div class="cat-empty">(Sin categorías)</div>`;
            if (badge) badge.textContent = `${lista.length} categoría(s)`;
          };

          const agregar = () => {
            const val = (input?.value || "").trim();
            if (!val) return;
            if (
              categoriasLocal.some((c) => c.toLowerCase() === val.toLowerCase())
            ) {
              Swal.showValidationMessage?.("Esa categoría ya existe.");
              setTimeout(() => Swal.resetValidationMessage?.(), 1200);
              return;
            }
            categoriasLocal.push(val);
            input.value = "";
            pintar();
            input?.focus();
          };

          const eliminarSeleccionadas = () => {
            const checks = Array.from(document.querySelectorAll(".cat-check"));
            // Si hay filtro activo, los índices visuales no coinciden con el array original,
            // por eso tomamos el texto del nodo hermano y eliminamos por nombre.
            const nombresAEliminar = checks
              .filter((ch) => ch.checked)
              .map((ch) =>
                ch.parentElement
                  ?.querySelector(".cat-name")
                  ?.textContent?.trim()
              )
              .filter(Boolean);

            if (nombresAEliminar.length === 0) {
              Swal.showValidationMessage?.(
                "Selecciona al menos una categoría para eliminar."
              );
              setTimeout(() => Swal.resetValidationMessage?.(), 1200);
              return;
            }
            categoriasLocal = categoriasLocal.filter(
              (c) => !nombresAEliminar.includes(c)
            );
            pintar();
          };

          const guardarYRecargar = async () => {
            if (categoriasLocal.length === 0) {
              Swal.showValidationMessage?.(
                "Debes dejar al menos una categoría."
              );
              setTimeout(() => Swal.resetValidationMessage?.(), 1200);
              return;
            }
            const limpias = await guardarCategorias(categoriasLocal);
            categoriasLocal = [...limpias];
            pintar(categoriasLocal); // 🔁 repinta con la nueva lista
            const badge = document.getElementById("cat-count");
            if (badge)
              badge.textContent = `${categoriasLocal.length} categoría(s)`;
            Swal.fire({
              toast: true,
              position: "top-end",
              icon: "success",
              title: "Categorías guardadas",
              showConfirmButton: false,
              timer: 1200,
            });
          };
          // Eventos
          document
            .getElementById("btn-cat-add")
            ?.addEventListener("click", agregar);
          input?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          });

          document
            .getElementById("btn-cat-del")
            ?.addEventListener("click", eliminarSeleccionadas);

          document
            .getElementById("btn-cat-save")
            ?.addEventListener("click", guardarYRecargar);

          search?.addEventListener("input", () => {
            filtroTexto = !!search.value.trim();
            pintar();
          });

          checkAll?.addEventListener("change", (e) => {
            const marcado = e.target.checked;
            document
              .querySelectorAll(".cat-check")
              .forEach((ch) => (ch.checked = marcado));
          });

          pintar();
        },
      });
      if (typeof onClose === "function") onClose();
    };

    await abrirSwalEditor();
  };

  // Form agregar gasto (con botón Editar categorías)
  // ✅ acepta un override y una categoría a preseleccionar opcional
  const agregarGastoSwal = async ({ catsOverride, preselect } = {}) => {
    const cats = Array.isArray(catsOverride) ? catsOverride : categorias;

    const construirOpciones = (arr) =>
      (arr || []).map((c) => `<option value="${c}">${c}</option>`).join("");

    const { value: formValues } = await Swal.fire({
      title: "Agregar nuevo gasto",
      html: `
      <input id="swal-fecha" type="date" class="swal2-input swal-input-sm" placeholder="Fecha" style="font-size:13px">

      <div style="display:flex;gap:6px;align-items:center;">
        <select id="swal-categoria" class="swal2-select swal-select-lg" style="font-size:16px;flex:1;">
          <option value="">Categoría...</option>
          ${construirOpciones(cats)}
        </select>
        <button id="btn-edit-categorias" class="swal2-styled" style="min-width:44px;padding:0 10px;height:2.6em;background:yellow;border-radius:10px;border:1px solid black" title="Editar categorías">✎</button>
      </div>

      <input id="swal-descripcion" class="swal2-input swal-input-sm" placeholder="Descripción" style="font-size:14px">
      <input id="swal-proveedor" class="swal2-input swal-input-sm" placeholder="Proveedor" style="font-size:14px">

      <select id="swal-metodo" class="swal2-select swal-select-lg" style="font-size:16px">
        <option value="">Método de pago...</option>
        ${["Efectivo", "Transferencia", "Tarjeta"]
          .map((m) => `<option value="${m}">${m}</option>`)
          .join("")}
      </select>

      <select id="swal-banco" class="swal2-select swal-select-lg" style="font-size:16px">
        <option value="">Banco...</option>
        <option value="Aruba Bank N.V.">Aruba Bank N.V.</option>
        <option value="Caribbean Mercantile Bank N.V.">Caribbean Mercantile Bank N.V.</option>
        <option value="RBC Royal Bank N.V.">RBC Royal Bank N.V.</option>
      </select>

      <input id="swal-idBanco" type="number" class="swal2-input swal-input-sm" placeholder="Id banco" style="font-size:14px">
      <input id="swal-monto" type="number" class="swal2-input swal-input-sm" placeholder="Monto" style="font-size:14px">
      <input id="swal-numFactura" class="swal2-input swal-input-sm" placeholder="N° Factura" style="font-size:14px">
      <input id="swal-responsable" class="swal2-input swal-input-sm" placeholder="Responsable" style="font-size:14px">
    `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Agregar",
      cancelButtonText: "Cancelar",
      didOpen: (popup) => {
        const style = document.createElement("style");
        style.textContent = `
        .swal2-popup .swal-input-sm { font-size:13px !important; }
        .swal2-popup .swal-select-lg { font-size:16px !important; }
        .swal2-popup .swal2-select { height: 2.6em; }
      `;
        popup.appendChild(style);

        // ✅ preselecciona la nueva categoría si viene
        if (preselect) {
          const sel = document.getElementById("swal-categoria");
          if (sel) sel.value = preselect;
        }

        document
          .getElementById("btn-edit-categorias")
          ?.addEventListener("click", async (e) => {
            e.preventDefault();
            Swal.close();
            await abrirEditorCategorias(); // vuelve al editor
          });
      },
      preConfirm: () => ({
        fecha: document.getElementById("swal-fecha").value,
        categoria: document.getElementById("swal-categoria").value,
        descripcion: document.getElementById("swal-descripcion").value,
        proveedor: document.getElementById("swal-proveedor").value,
        metodoPago: document.getElementById("swal-metodo").value,
        banco: document.getElementById("swal-banco").value,
        idBanco: document.getElementById("swal-idBanco").value,
        monto: document.getElementById("swal-monto").value,
        numFactura: document.getElementById("swal-numFactura").value,
        responsable: document.getElementById("swal-responsable").value,
      }),
    });

    if (formValues) {
      let fechaFormateada = formValues.fecha;
      if (formValues.fecha) {
        const [y, m, d] = formValues.fecha.split("-");
        fechaFormateada = `${d}-${m}-${y}`;
      }
      const nuevoRef = push(ref(database, "gastos"));
      await set(nuevoRef, {
        fecha: fechaFormateada || "",
        categoria: formValues.categoria || "",
        descripcion: formValues.descripcion || "",
        proveedor: formValues.proveedor || "",
        metodoPago: formValues.metodoPago || "",
        banco: formValues.banco || "",
        idBanco: formValues.idBanco || "",
        monto: formValues.monto || "",
        moneda: "AWG",
        numFactura: formValues.numFactura || "",
        responsable: formValues.responsable || "",
        timestamp: Date.now(),
      });
      if (formValues.categoria) {
        const nueva = formValues.categoria.trim();
        if (
          nueva &&
          !categorias.some((c) => c.toLowerCase() === nueva.toLowerCase())
        ) {
          await guardarCategorias([...categorias, nueva]);
        }
      }
      Swal.fire(
        "¡Agregado!",
        "El gasto fue registrado correctamente.",
        "success"
      );
    }
  };

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

  /* ========================= Utilidades ========================= */
  const formatearDinero = (n) =>
    typeof n === "number"
      ? `${n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} AWG`
      : "0.00 AWG";

  const formatearFecha = (d) => {
    const day = ("0" + d.getDate()).slice(-2);
    const month = ("0" + (d.getMonth() + 1)).slice(-2);
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  /* ---------- Opciones para filtros ---------- */
  const opcionesCategoria = useMemo(
    () =>
      (categorias || [])
        .slice()
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v })),
    [categorias]
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
      row.getCell(7).numFmt = '"AWG" #,##0.00';
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
    doc.text(
      `Total General De Gastos: ${formatearDinero(totalGeneral)}`,
      14,
      y
    );
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

  /* ---------- Update campo en Firebase ---------- */
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
      <div onClick={() => setMostrarSlidebar((v) => !v)}></div>

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
        <h2 style={{ color: "white" }}>Filtros</h2>
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
              backgroundColor: "#28a745",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              e.currentTarget.style.backgroundColor = "#218838";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              e.currentTarget.style.backgroundColor = "#28a745";
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
                <th>Id banco</th>
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
                        <DatePicker
                          selected={
                            valoresLocales[`${r.id}_fecha`]
                              ? new Date(valoresLocales[`${r.id}_fecha`])
                              : r.fecha
                              ? (() => {
                                  const [d, m, y] = r.fecha.split("-");
                                  return new Date(y, m - 1, d);
                                })()
                              : null
                          }
                          onChange={(date) => {
                            const fechaStr = formatearFecha(date);
                            setValoresLocales((prev) => ({
                              ...prev,
                              [`${r.id}_fecha`]: fechaStr,
                            }));
                            actualizarCampo(r.id, "fecha", fechaStr);
                          }}
                          dateFormat="dd-MM-yyyy"
                          customInput={
                            <input
                              style={{
                                width: "10ch",
                                textAlign: "center",
                                fontWeight: "bold",
                              }}
                              readOnly
                            />
                          }
                        />
                      </td>

                      {/* Categoría */}
                      <td>
                        <select
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
                          onBlur={async (e) => {
                            const nueva = (e.target.value || "").trim();
                            if (nueva !== (r.categoria || "")) {
                              await actualizarCampo(r.id, "categoria", nueva);
                            }
                            // Alta automática en catálogo si no existe
                            if (
                              nueva &&
                              !categorias.some(
                                (c) => c.toLowerCase() === nueva.toLowerCase()
                              )
                            ) {
                              await guardarCategorias([...categorias, nueva]);
                            }
                          }}
                          style={{ width: "14ch" }}
                        >
                          <option value=""></option>
                          {categorias
                            .slice()
                            .sort((a, b) => a.localeCompare(b))
                            .map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                        </select>
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
                          style={{ width: "24ch", fontSize: "13px" }}
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
                          style={{ width: "14ch", fontSize: "13px" }}
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
                          {["Efectivo", "Transferencia", "Tarjeta"].map((m) => (
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

                      {/* Id banco */}
                      <td>
                        <input
                          type="number"
                          value={
                            valoresLocales[`${r.id}_idBanco`] ?? r.idBanco ?? ""
                          }
                          onChange={(e) =>
                            setValoresLocales((prev) => ({
                              ...prev,
                              [`${r.id}_idBanco`]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (e.target.value !== (r.idBanco || "")) {
                              actualizarCampo(r.id, "idBanco", e.target.value);
                            }
                          }}
                          style={{
                            width: "10ch",
                            textAlign: "center",
                            fontSize: "13px",
                          }}
                        />
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
                          style={{
                            width: "10ch",
                            textAlign: "right",
                            fontSize: "13px",
                          }}
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
                          style={{ width: "10ch", fontSize: "13px" }}
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
                          style={{ width: "14ch", fontSize: "13px" }}
                        />
                      </td>

                      {/* Eliminar */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="delete-button"
                          style={{ marginLeft: "10px", marginRight: "6px" }}
                          onClick={() => {
                            Swal.fire({
                              title: "¿Deseas eliminar el registro?",
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
                                Swal.fire({
                                  title: "¡Registro eliminado!",
                                  text: "El Registro ha sido eliminado exitosamente.",
                                  icon: "success",
                                  position: "center",
                                  backdrop: "rgba(0,0,0,0.4)",
                                  timer: 2000,
                                  showConfirmButton: false,
                                  heightAuto: false,
                                });
                              }
                            });
                          }}
                        >
                          Eliminar
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
              {" "}
              Página {paginaActual} de {totalPaginas || 1}{" "}
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

      <button className="create-table-button" onClick={agregarGastoSwal}>
        +
      </button>
    </div>
  );
};

export default Gastos;
