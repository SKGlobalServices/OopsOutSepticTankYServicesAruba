import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ref, onValue, off, update, get, child } from "firebase/database";
import { database } from "../Database/firebaseConfig";
import Clock from "./Clock";
import Slidebar from "./Slidebar";

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

// 🎨 Color suave aleatorio (no fuerte) para fondos
const randomSoftHsl = () => {
  const h = Math.floor(Math.random() * 360);   // 0–359
  const s = 30 + Math.random() * 15;           // 30%–45% (suave)
  const l = 85 + Math.random() * 10;           // 85%–95% (clarito)
  return `hsl(${h} ${s}% ${l}%)`;
};

/* ========= Modal desacoplado ========= */
const ScheduleModal = ({ open, onClose, user }) => {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]); // [{dd,start,end,off,note}]
  const [animateIn, setAnimateIn] = useState(false);
  const closeBtnRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (open) {
      setAnimateIn(true);
      const id = requestAnimationFrame(() => setAnimateIn(false));
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => {
    if (open) setViewDate(new Date());
  }, [user?.id, open]);

  const ym = useMemo(() => yyyymm(viewDate), [viewDate]);
  const year = viewDate.getFullYear();
  const m0 = viewDate.getMonth();
  const matrix = useMemo(() => buildMonthMatrix(year, m0), [year, m0]);

  useEffect(() => {
    if (!open || !user?.id) return;
    const base = ref(database);
    const path = `calendario/${user.id}/${ym}`;
    setLoading(true);
    get(child(base, path))
      .then((snap) => {
        const byDay = snap.exists() ? snap.val() : {};
        const next = matrix.map((d) => {
          const row = byDay?.[d.dd] || {};
          return {
            dd: d.dd,
            start: row.start ?? "",
            end: row.end ?? "",
            off: !!row.off,
            note: row.note ?? "",
            isWeekend: d.isWeekend,
            dow: d.dow,
          };
        });
        setRows(next);
      })
      .finally(() => setLoading(false));
  }, [open, user?.id, ym, matrix]);

  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose(false);
    }
  };

  const setCell = useCallback((i, key, val) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [key]: val };
      return copy;
    });
  }, []);

  const copyDayToAll = (i) => {
    const src = rows[i];
    if (!src || !src.start || !src.end || src.off) return;
    setRows((prev) => prev.map((r) => ({ ...r, start: src.start, end: src.end, off: false })));
  };

  const clearAll = () =>
    setRows((prev) => prev.map((r) => ({ ...r, start: "", end: "", off: false, note: "" })));

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const updates = {};
      rows.forEach((r) => {
        const path = `calendario/${user.id}/${ym}/${r.dd}`;
        if (!r.start && !r.end && !r.off && !r.note) updates[path] = null;
        else updates[path] = { start: r.start || "", end: r.end || "", off: !!r.off, note: r.note || "" };
      });
      await update(ref(database), updates);
      onClose(true);
    } catch (e) {
      console.error(e);
      alert("Error guardando horarios.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date());

  const titleId = "schedule-modal-title";
  const descId = "schedule-modal-sub";

  return (
    <div className="modal-backdrop show" onClick={() => onClose(false)} aria-hidden="true">
      <div
        className={`modal ${animateIn ? "modal-animated" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        ref={modalRef}
      >
        <header className="modal-head">
          <div>
            <div className="modal-title" id={titleId}>
              Calendario de {user?.name || user?.displayName || user?.nombre || user?.id}
            </div>
            <div className="modal-sub" id={descId}>
              {viewDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={prevMonth} title="Mes anterior (←)">
              &lt; Mes Anterior
            </button>
            <button type="button" className="btn btn--soft" onClick={goToday} title="Ir a hoy">
              Hoy
            </button>
            <button type="button" className="btn btn--ghost" onClick={nextMonth} title="Mes siguiente (→)">
              Mes Siguiente &gt;
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={clearAll}
              disabled={loading || saving}
              title="Limpiar todo"
            >
              Limpiar
            </button>
            <button
              type="button"
              className={`btn btn--primary ${saving ? "is-loading" : ""}`}
              onClick={handleSave}
              disabled={loading || saving}
              title="Guardar cambios"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              ref={closeBtnRef}
              className="btn btn--danger btn--outline"
              onClick={() => onClose(false)}
              title="Cerrar (Esc)"
            >
              Cerrar
            </button>
          </div>
        </header>

        <div className="grid-days">
          <div className="grid-head">Día</div>
          <div className="grid-head">Inicio</div>
          <div className="grid-head">Fin</div>
          <div className="grid-head">Libre</div>
          <div className="grid-head">Nota</div>

          {rows.map((r, i) => (
            <React.Fragment key={r.dd}>
              <div
                className={`cell day ${r.isWeekend ? "wknd" : ""}`}
                onDoubleClick={() => copyDayToAll(i)}
                title="Doble clic: copiar este horario a todo el mes"
                tabIndex={0}
              >
                <div className="daynum">{r.dd}</div>
                <div className="dow">{r.dow}</div>
              </div>
              <div className="cell">
                <input
                  className="input"
                  type="time"
                  value={r.start}
                  onChange={(e) => setCell(i, "start", e.target.value)}
                  disabled={r.off}
                />
              </div>
              <div className="cell">
                <input
                  className="input"
                  type="time"
                  value={r.end}
                  onChange={(e) => setCell(i, "end", e.target.value)}
                  disabled={r.off}
                />
              </div>
              <div className="cell">
                <label className="switch" title={r.off ? "Día libre" : "Marcar como libre"}>
                  <input
                    aria-label={`Marcar ${r.dd}/${viewDate.getMonth() + 1} como libre`}
                    type="checkbox"
                    checked={r.off}
                    onChange={(e) => setCell(i, "off", e.target.checked)}
                  />
                  <span />
                </label>
              </div>
              <div className="cell">
                <input
                  className="input"
                  type="text"
                  placeholder="Opcional"
                  value={r.note}
                  onChange={(e) => setCell(i, "note", e.target.value)}
                />
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

const Calendarioadmin = () => {
  /* ========= Estado (cards) ========= */
  const [showSlidebar, setShowSlidebar] = useState(false);
  const [users, setUsers] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const todayStr = useMemo(() => new Date().toLocaleDateString(), []);

  // 🎨 Mapa de colores por usuario (se genera en cada carga de la página)
  const [cardBg, setCardBg] = useState({});

  useEffect(() => {
    const usersRef = ref(database, "users");
    const unsub = onValue(
      usersRef,
      (snap) => {
        if (!snap.exists()) { setUsers([]); setCargando(false); return; }
        const val = snap.val();
        const lista = Object.entries(val)
          .filter(([_, u]) => (u.role || u.rol) === "user")
          .map(([id, u]) => ({ id, name: u.name || u.displayName || u.nombre || u.email || id }));
        lista.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
        setUsers(lista); setCargando(false);
      },
      (err) => { console.error(err); setCargando(false); }
    );
    return () => { off(usersRef); unsub?.(); };
  }, []);

  // Generar color suave aleatorio por usuario cuando cambia la lista
  useEffect(() => {
    if (!users || users.length === 0) {
      setCardBg({});
      return;
    }
    const map = {};
    users.forEach((u) => { map[u.id] = randomSoftHsl(); });
    setCardBg(map);
  }, [users]);

  const toggleSlidebar = () => setShowSlidebar((s) => !s);
  const openCalendar = (u) => { setSelected(u); setModalOpen(true); };

  return (
    <div className="homepage-container">
      {/* 🔐 Estilo local para asegurar el fondo por encima de cualquier background existente */}
      <style>{`
        .user-card{ position: relative; overflow: hidden; }
        .user-card::before{
          content: "";
          position: absolute;
          inset: 0;
          background: var(--card-bg, #f5f5f5);
          z-index: 0;
        }
        .user-card > *{ position: relative; z-index: 1; }
        .user-card { transition: filter .2s ease; }
        .user-card:hover { filter: brightness(0.97); }
      `}</style>

      <Slidebar show={showSlidebar} onClose={toggleSlidebar} />
      <div onClick={toggleSlidebar}></div>

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Seleccionar Empleado</h1>
          <div className="current-date">
            <div style={{ cursor: "default" }}>{todayStr}</div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="table-container">
          <div className="users-flex">
            {cargando && <div className="hint">Cargando…</div>}
            {!cargando && users.length === 0 && <div className="hint">Sin usuarios.</div>}
            {users.map((u) => {
              const initials = u.name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
              return (
                <article
                  key={u.id}
                  className="user-card"
                  title={u.name}
                  onClick={() => openCalendar(u)}
                  tabIndex={0}
                  // ⬇️ Seteamos variable CSS; el pseudo-elemento la usa con prioridad real
                  style={{ ["--card-bg"]: cardBg[u.id]  }}
                >
                  <div className="user-avatar">{initials || "U"}</div>
                  <div className="user-name">{u.name}</div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <ScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={selected}
      />
    </div>
  );
};

export default React.memo(Calendarioadmin);
