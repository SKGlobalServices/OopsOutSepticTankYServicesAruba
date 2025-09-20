import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ref, get, child } from "firebase/database";
import { database } from "../Database/firebaseConfig";
import { decryptData } from "../utils/security";
import Clock from "./Clock";
import Slidebaruser from "./Slidebaruser";

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

  // Usuario logueado
  const loggedUser = decryptData(localStorage.getItem("user"));
  const myUserId = loggedUser?.id;
  const myName = loggedUser?.name || loggedUser?.displayName || loggedUser?.nombre || "";

  // Fecha de vista (navegación por meses)
  const [viewDate, setViewDate] = useState(() => new Date());
  const ym = useMemo(() => yyyymm(viewDate), [viewDate]);
  const year = viewDate.getFullYear();
  const m0 = viewDate.getMonth();
  const matrix = useMemo(() => buildMonthMatrix(year, m0), [year, m0]);

  // Filas del mes (solo lectura)
  const [rows, setRows] = useState([]); // [{dd,start,end,off,note,isWeekend,dow,dateStr}]
  const cacheRef = useRef(new Map());   // key = `${userId}:${ym}` -> rows[]

  // Construye filas vacías al vuelo (sin "cargando")
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

  // Cargar calendario del usuario (sin flashes)
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

      // Evita condición de carrera si cambiaste de mes durante la carga
      const stillSame = yyyymm(viewDate) === ym;
      if (stillSame) setRows(next);
    } catch (e) {
      console.error("Error cargando calendario de usuario:", e);
      // Mantener lo que ya se muestra (cache/empty)
    }
  }, [myUserId, ym, matrix, emptyRowsForMatrix, viewDate]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  // Navegación de mes sin tocar el estado del modal (no hay modal aquí)
  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date());

  // Si no hay usuario logueado, mostrar mensaje simple
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
        <div
          className="calendar-controls"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 800 }}>
            {myName ? `Usuario: ${myName}` : "Mi usuario"}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {viewDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </div>
        </div>

        {/* Tabla del calendario (solo lectura) */}
        <div className="table-container">
          <table className="calendar-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={thS}>Día</th>
                <th style={thS}>Fecha</th>
                <th style={thS}>Inicio</th>
                <th style={thS}>Fin</th>
                <th style={thS}>Libre</th>
                <th style={thS}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.dd} style={trS}>
                    <td style={tdS}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontWeight: 800 }}>{r.dd}</span>
                        <span style={{ color: "#6b7280", fontSize: 12 }}>{r.dow}</span>
                      </div>
                    </td>
                    <td style={tdS}>{r.dateStr}</td>
                    <td style={tdSMuted(r.off)}>{r.start || "—"}</td>
                    <td style={tdSMuted(r.off)}>{r.end || "—"}</td>
                    <td style={tdS}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: r.off ? "#dcfce7" : "#f3f4f6",
                          color: r.off ? "#16a34a" : "#374151",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {r.off ? "Sí" : "No"}
                      </span>
                    </td>
                    <td style={tdS}>
                      <span style={{ color: r.off ? "#9ca3af" : "#111827" }}>
                        {r.note || ""}
                      </span>
                    </td>
                  </tr>
                ))
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

/* ===== Estilos inline reutilizables (si ya tienes CSS global, puedes moverlos) ===== */
const thS = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(0,0,0,.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,.96))",
  position: "sticky",
  top: 0,
  zIndex: 1,
  fontWeight: 800,
  color: "#374151",
};

const trS = {
  borderBottom: "1px solid rgba(0,0,0,.06)",
};

const tdS = {
  padding: "10px 12px",
  minHeight: 42,
  verticalAlign: "middle",
};

const tdSMuted = (off) => ({
  ...tdS,
  color: off ? "#9ca3af" : "#111827",
});

export default React.memo(Calendariouser);
