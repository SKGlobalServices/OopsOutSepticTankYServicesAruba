import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Swal from "sweetalert2";
import { ref, get, child, onValue } from "firebase/database";
import { database } from "../Database/firebaseConfig";
import { decryptData } from "../utils/security";
import Clock from "./Clock";
import Slidebaruser from "./Slidebaruser";
import "./Calendariouser.css";

/* ========= Helpers ========= */
const pad2 = (n) => String(n).padStart(2, "0");
const yyyymm = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}`;
const daysInMonth = (year, monthIndex0) => new Date(year, monthIndex0 + 1, 0).getDate();
const buildMonthMatrix = (year, monthIndex0) => {
  const total = daysInMonth(year, monthIndex0);
  const days = [];
  for (let i = 1; i <= total; i++) {
    const d = new Date(year, monthIndex0, i);
    days.push({
      date: d,
      dd: pad2(i),
      dow: d.toLocaleDateString("es-ES", { weekday: "short" }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return days;
};

const Calendariouser = () => {
  const [showSlidebar, setShowSlidebar] = useState(false);
  const toggleSlidebar = () => setShowSlidebar((s) => !s);

  const loggedUser = decryptData(localStorage.getItem("user"));
  const myUserId = loggedUser?.id;
  const myName = loggedUser?.name || loggedUser?.displayName || loggedUser?.nombre || "";

  // Fecha de vista (navegación por meses)
  const [viewDate, setViewDate] = useState(() => new Date());
  const ym = useMemo(() => yyyymm(viewDate), [viewDate]);
  const year = viewDate.getFullYear();
  const m0 = viewDate.getMonth();
  const matrix = useMemo(() => buildMonthMatrix(year, m0), [year, m0]);

  const [rows, setRows] = useState([]);
  const cacheRef = useRef(new Map());
  const tableWrapRef = useRef(null);

  // Construye filas vacías
  const emptyRowsForMatrix = useCallback(
    () =>
      matrix.map((d) => ({
        dd: d.dd,
        dateStr: d.date.toLocaleDateString("es-ES"),
        start: "",
        end: "",
        off: false,
        note: "",
        isWeekend: d.isWeekend,
        dow: d.dow,
      })),
    [matrix]
  );

  // Cargar calendario del usuario
  const loadMonth = useCallback(async () => {
    if (!myUserId) {
      setRows(emptyRowsForMatrix());
      return;
    }
    const key = `${myUserId}:${ym}`;
    const cached = cacheRef.current.get(key);

    if (cached) {
      setRows(cached);
    } else {
      setRows(emptyRowsForMatrix());
    }

    try {
      const base = ref(database);
      const path = `calendario/${myUserId}/${ym}`;
      const snap = await get(child(base, path));
      const byDay = snap.exists() ? snap.val() : {};

      const next = matrix.map((d) => {
        const row = byDay?.[d.dd] || {};
        return {
          dd: d.dd,
          dateStr: d.date.toLocaleDateString("es-ES"),
          start: row.start ?? "",
          end: row.end ?? "",
          off: !!row.off,
          note: row.note ?? "",
          isWeekend: d.isWeekend,
          dow: d.dow,
        };
      });

      cacheRef.current.set(key, next);

      const stillSame = yyyymm(viewDate) === ym;
      if (stillSame) setRows(next);
    } catch (e) {
      console.error("Error cargando calendario de usuario:", e);
    }
  }, [myUserId, ym, matrix, emptyRowsForMatrix, viewDate]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  // Detectar cambios remotos: ignorar snapshot inicial; si hay cambio real,
  // iniciar alerta diferida de 30s. No reprogramar si ya hay timer pendiente.
  const alertTimerRef = useRef(null);
  const alertPendingRef = useRef(false);
  const seenInitialSnapshotRef = useRef(false);
  const lastSnapshotValRef = useRef(null);

  useEffect(() => {
    if (!myUserId) return;

    const path = `calendario/${myUserId}/${ym}`;
    const dbRef = ref(database, path);

    const onChange = (snapshot) => {
      const val = snapshot.exists() ? snapshot.val() : null;

      // Ignorar la primera invocación que devuelve el snapshot inicial
      if (!seenInitialSnapshotRef.current) {
        seenInitialSnapshotRef.current = true;
        lastSnapshotValRef.current = val;
        return;
      }

      // Si no cambió realmente el contenido, no hacer nada
      try {
        const prev = lastSnapshotValRef.current;
        const same = JSON.stringify(prev) === JSON.stringify(val);
        if (same) return;
      } catch (e) {
        // Si falla la comparación por tamaño, asumimos cambio y seguimos
      }

      // Guardar nuevo snapshot como referencia
      lastSnapshotValRef.current = val;

      // Si ya hay un timer pendiente, no volver a programar
      if (alertPendingRef.current) return;

      alertPendingRef.current = true;

      // Programar la alerta para dentro de 30 segundos
      alertTimerRef.current = setTimeout(() => {
        Swal.fire({
          icon: "info",
          title: "Cambio en horarios detectado",
          html: "Se detectaron cambios en el calendario. Actualiza la página para ver los horarios más recientes.",
          confirmButtonText: "Actualizar ahora",
          showCancelButton: true,
          cancelButtonText: "Más tarde",
        }).then((res) => {
          if (res.isConfirmed) {
            window.location.reload();
          }
        });

        alertPendingRef.current = false;
        alertTimerRef.current = null;
      }, 30000);
    };

    const unsubscribe = onValue(dbRef, onChange);

    return () => {
      try {
        if (typeof unsubscribe === "function") unsubscribe();
      } catch (e) {}
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }
      alertPendingRef.current = false;
      seenInitialSnapshotRef.current = false;
      lastSnapshotValRef.current = null;
    };
  }, [myUserId, ym]);

  // Navegación de mes
  const prevMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date());

  // Auto-scroll animado hasta el día de hoy
  useEffect(() => {
    const cont = tableWrapRef.current;
    if (!cont) return;

    const today = new Date();
    const sameMonth =
      viewDate.getFullYear() === today.getFullYear() &&
      viewDate.getMonth() === today.getMonth();
    if (!sameMonth) return;

    const id = requestAnimationFrame(() => {
      const row = cont.querySelector(".calendar-table tbody tr.today");
      if (!row) return;

      const margin = 72;
      const target = row.offsetTop - margin;

      cont.scrollTop = 0;
      const duration = 700;
      const start = performance.now();
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        cont.scrollTop = target * easeOutCubic(p);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(id);
  }, [ym, rows.length, viewDate]);

  if (!myUserId) {
    return (
      <div className="homepage-container">
        <Slidebaruser />
        <div className="homepage-title">
          <div className="homepage-card">
            <h1 className="title-page">Calendario</h1>
            <div className="current-date">
              <div style={{ cursor: "default" }}>{new Date().toLocaleDateString()}</div>
              <Clock />
            </div>
          </div>
        </div>
        <div className="homepage-card">
          <div className="table-container">
            <p style={{ padding: 12, color: "#6b7280" }}>
              No hay usuario logueado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const today = new Date();
  const sameMonthAsToday =
    viewDate.getFullYear() === today.getFullYear() &&
    viewDate.getMonth() === today.getMonth();
  const todayDD = pad2(today.getDate());

  return (
    <div className="homepage-container user">
      <Slidebaruser show={showSlidebar} onClose={toggleSlidebar} />
      <div onClick={toggleSlidebar}></div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Mi Calendario</h1>
          <div className="current-date">
            <div style={{ cursor: "default" }}>{new Date().toLocaleDateString()}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        {/* Controles de mes */}
        <div className="calendar-controls">
          <div className="user-label">
            {myName ? `Usuario: ${myName}` : "Mi usuario"}
          </div>

          <div className="btn-group">
            <button type="button" className="btn btn--ghost" onClick={prevMonth}>
              &lt; Mes Anterior
            </button>
            <button type="button" className="btn btn--soft" onClick={goToday}>
              Hoy
            </button>
            <button type="button" className="btn btn--ghost" onClick={nextMonth}>
              Mes Siguiente &gt;
            </button>
          </div>

          <div className="month-label">
            {viewDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </div>
        </div>

        {/* Tabla del calendario (solo lectura) */}
        <div className="table-container" ref={tableWrapRef}>
          <table className="calendar-table">
            <thead>
              <tr>
                <th>Día</th>
                <th>Fecha</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Libre</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => {
                  const isToday = sameMonthAsToday && r.dd === todayDD;
                  return (
                    <tr
                      key={r.dd}
                      className={`${isToday ? "today" : ""} ${r.isWeekend ? "wknd" : ""}`}
                    >
                      <td>
                        <div className="daycell">
                          <span className="daynum">{r.dd}</span>
                          <span className="dow">{r.dow}</span>
                        </div>
                      </td>
                      <td className={r.off ? "td--muted" : "td--hour"}>{r.dateStr}</td>
                      <td className={r.off ? "td--muted" : "td--hour"}>{r.start || "—"}</td>
                      <td className={r.off ? "td--muted" : "td--hour"}>{r.end || "—"}</td>
                      <td>
                        <span className={`badge ${r.off ? "badge--off" : "badge--on"}`}>
                          {r.off ? "Sí" : "No"}
                        </span>
                      </td>
                      <td>
                        <span className={r.off ? "td--muted" : "td--description"}>
                          {r.note || ""}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: "#6b7280", textAlign: "center" }}>
                    Sin datos para este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Calendariouser);
