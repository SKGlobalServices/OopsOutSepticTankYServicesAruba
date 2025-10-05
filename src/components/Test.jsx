import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
} from "firebase/database";
import { database } from "../Database/firebaseConfig";
import Clock from "./Clock";
import Slidebar from "./Slidebar";
import Swal from "sweetalert2";
import "./Test.css";

const IANA_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toLocalISO = (d) =>
  `${toISODate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
const startOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const addMonths = (d, n) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};
const addYears = (d, n) => {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
};
const dayIdx = (d) => d.getDay();

const WEEKDAY_CODE = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
const WEEKDAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const parseTimeToDate = (baseDate, hhmm) => {
  const [hh, mm] = hhmm.split(":").map(Number);
  const dt = new Date(baseDate);
  dt.setHours(hh, mm, 0, 0);
  return dt;
};

const defaultCalendarId = "skgs";
const ROLLING_MONTHS_FWD = 6;
const ROLLING_MONTHS_BACK = 1;

const pSeries = () => `reprogramacion`;
const pInstancesMonth = (calendarId, seriesId, y, m) =>
  `reprogramacion/${calendarId}/${seriesId}/${y}/${pad2(m)}`;

function* occurGenerator({
  dtStart,
  freq,
  interval = 1,
  byDay = null,
  byMonthDay = null,
  bySetPos = null,
  until = null,
  count = null,
}) {
  let produced = 0;

  const inUntil = (date) => !until || date <= until;
  const inc = (d) => {
    if (freq === "DAILY") return addDays(d, interval);
    if (freq === "WEEKLY") return addDays(d, 7 * interval);
    if (freq === "MONTHLY") return addMonths(d, interval);
    if (freq === "YEARLY") return addYears(d, interval);
    return addDays(d, 1);
  };

  const sameTime = (src, target) => {
    target.setHours(src.getHours(), src.getMinutes(), 0, 0);
    return target;
  };

  let cursor = new Date(dtStart);

  while (true) {
    if (freq === "DAILY") {
      if (inUntil(cursor)) {
        yield new Date(cursor);
        produced++;
        if (count && produced >= count) return;
      }
      cursor = inc(cursor);
    } else if (freq === "WEEKLY") {
      const anchor = new Date(cursor);
      const by = byDay?.length ? byDay : [WEEKDAY_CODE[dayIdx(dtStart)]];
      const weekStart = addDays(startOfDay(anchor), -dayIdx(anchor));
      for (const code of by) {
        const idx = WEEKDAY_CODE.indexOf(code);
        const d = addDays(weekStart, idx);
        const dt = sameTime(dtStart, new Date(d));
        if (dt < dtStart && interval === 1 && produced === 0) continue;
        if (inUntil(dt)) {
          yield dt;
          produced++;
          if (count && produced >= count) return;
        }
      }
      cursor = inc(cursor);
    } else if (freq === "MONTHLY") {
      const base = new Date(cursor);
      if (byMonthDay != null) {
        const y = base.getFullYear();
        const m = base.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        const day = byMonthDay === -1 ? dim : Math.min(byMonthDay, dim);
        const dt = new Date(
          y,
          m,
          day,
          dtStart.getHours(),
          dtStart.getMinutes(),
          0,
          0
        );
        if (inUntil(dt)) {
          yield dt;
          produced++;
          if (count && produced >= count) return;
        }
      } else if (byDay && bySetPos) {
        // “cuarto jueves” (BYDAY=TH, BYSETPOS=4) o “último jueves” (BYSETPOS=-1)
        const y = base.getFullYear();
        const m = base.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        const idxWanted = WEEKDAY_CODE.indexOf(byDay[0]);
        const candidates = [];
        for (let d = 1; d <= dim; d++) {
          const dt = new Date(
            y,
            m,
            d,
            dtStart.getHours(),
            dtStart.getMinutes(),
            0,
            0
          );
          if (dayIdx(dt) === idxWanted) candidates.push(dt);
        }
        const pick =
          bySetPos === -1
            ? candidates[candidates.length - 1]
            : candidates[bySetPos - 1];
        if (pick && inUntil(pick)) {
          yield pick;
          produced++;
          if (count && produced >= count) return;
        }
      } else {
        const y = base.getFullYear();
        const m = base.getMonth();
        const wanted = dtStart.getDate();
        const dim = new Date(y, m + 1, 0).getDate();
        const day = Math.min(wanted, dim);
        const dt = new Date(
          y,
          m,
          day,
          dtStart.getHours(),
          dtStart.getMinutes(),
          0,
          0
        );
        if (inUntil(dt)) {
          yield dt;
          produced++;
          if (count && produced >= count) return;
        }
      }
      cursor = inc(cursor);
    } else if (freq === "YEARLY") {
      const dt = new Date(
        cursor.getFullYear(),
        dtStart.getMonth(),
        dtStart.getDate(),
        dtStart.getHours(),
        dtStart.getMinutes(),
        0,
        0
      );
      if (inUntil(dt)) {
        yield dt;
        produced++;
        if (count && produced >= count) return;
      }
      cursor = inc(cursor);
    } else {
      return;
    }
  }
}

function generateOccurrences(series, windowStart, windowEnd) {
  const { start, end, rrule = null, exdates = [] } = series;
  const dtStart = new Date(start.ts);
  const dtEnd = new Date(end.ts);

  const inWindow = (dt) => dt >= windowStart && dt <= windowEnd;
  const occurrences = [];

  const ex = new Set(
    (exdates || []).map((t) => {
      const date = new Date(t);

      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        0,
        0
      ).getTime();
    })
  );

  if (!rrule) {
    const normalizedStart = new Date(
      dtStart.getFullYear(),
      dtStart.getMonth(),
      dtStart.getDate(),
      dtStart.getHours(),
      dtStart.getMinutes(),
      0,
      0
    );
    if (inWindow(dtStart) && !ex.has(normalizedStart.getTime())) {
      occurrences.push({
        occurrenceId: toLocalISO(dtStart),
        start: { ts: dtStart.getTime(), tz: start.tz },
        end: { ts: dtEnd.getTime(), tz: end.tz },
      });
    }
    return occurrences;
  }

  const {
    FREQ,
    INTERVAL = 1,
    BYDAY = null,
    BYMONTHDAY = null,
    BYSETPOS = null,
    COUNT = null,
    UNTIL = null,
    WORKDAYS = false,
  } = rrule;
  const byDay = WORKDAYS ? ["MO", "TU", "WE", "TH", "FR"] : BYDAY;

  const gen = occurGenerator({
    dtStart,
    freq: FREQ,
    interval: INTERVAL,
    byDay,
    byMonthDay: BYMONTHDAY,
    bySetPos: BYSETPOS,
    until: UNTIL ? new Date(UNTIL) : null,
    count: COUNT || null,
  });

  for (const occStart of gen) {
    if (occStart > windowEnd) break;
    if (!inWindow(occStart)) continue;

    const normalizedOccStart = new Date(
      occStart.getFullYear(),
      occStart.getMonth(),
      occStart.getDate(),
      occStart.getHours(),
      occStart.getMinutes(),
      0,
      0
    );
    if (ex.has(normalizedOccStart.getTime())) {
      console.log("Ocurrencia excluida:", normalizedOccStart.toISOString());
      continue;
    }

    const dur = dtEnd.getTime() - dtStart.getTime();
    const occEnd = new Date(occStart.getTime() + dur);
    occurrences.push({
      occurrenceId: toLocalISO(occStart),
      start: { ts: occStart.getTime(), tz: start.tz },
      end: { ts: occEnd.getTime(), tz: end.tz },
    });
  }
  return occurrences;
}

async function upsertInstances(calendarId, seriesId, occurrences) {
  const byMonth = {};
  for (const occ of occurrences) {
    const d = new Date(occ.start.ts);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${pad2(m)}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(occ);
  }

  const updates = {};
  for (const key of Object.keys(byMonth)) {
    const [y, m] = key.split("-");
    for (const occ of byMonth[key]) {
      const path = `${pInstancesMonth(
        calendarId,
        seriesId,
        y,
        Number(m)
      )}/${encodeURIComponent(occ.occurrenceId)}`;
      updates[path] = {
        occurrenceId: occ.occurrenceId,
        seriesId,
        calendarId,
        start: occ.start,
        end: occ.end,
        status: "confirmed",
      };
    }
  }
  if (Object.keys(updates).length) {
    await update(ref(database), updates);
  }
}

function buildWindow(fromDate = new Date()) {
  const start = startOfDay(addMonths(fromDate, -ROLLING_MONTHS_BACK));
  const end = endOfDay(addMonths(fromDate, ROLLING_MONTHS_FWD));
  return { start, end };
}

const EmptyService = {
  serviceId: "",
  fecha: toISODate(new Date()),
  anombrede: "",
  direccion: "",
  cubicos: "",
  valor: "",
  title: "",
  nota: "",
  calendarId: defaultCalendarId,
  allDay: true,
  rrulePreset: "CUSTOM",
  freq: "WEEKLY",
  interval: 1,
  weeklyDays: ["LUN"],
  monthlyMode: "BYMONTHDAY",
  monthlyDay: 15,
  monthlyNth: { pos: 1, day: "LUN" },
  endMode: "NEVER",
  untilDate: "",
  count: "",
};

function ServiceForm({ open, onClose, onSave, initial, clients = [] }) {
  const [data, setData] = useState(initial || EmptyService);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  useEffect(() => {
    setData(initial || EmptyService);
  }, [initial, open]);

  if (!open) return null;

  const change = (k, v) => setData((s) => ({ ...s, [k]: v }));

  const loadClientFields = (direccion) => {
    const cliente = clients.find((c) => c.direccion === direccion);
    if (cliente) {
      setData((prevData) => ({
        ...prevData,
        cubicos: cliente.cubicos || "",
        valor: cliente.valor || "",
        anombrede: cliente.anombrede || "",
        title: cliente.anombrede ? `${cliente.anombrede} - ${direccion}` : "",
      }));
    } else {
      setData((prevData) => ({
        ...prevData,
        cubicos: "",
        valor: "",
        anombrede: "",
        title: "",
      }));
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const modal = (
    <div
      className="calendar-modal-overlay"
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="calendar-modal" role="dialog" aria-modal="true">
        <div className="calendar-modal-header">
          <h3>{initial ? "Editar Servicio" : "Nuevo Servicio"}</h3>
          <button onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="calendar-form">
          {/* === CAMPOS OBLIGATORIOS === */}
          <div className="calendar-form-group">
            <label>Fecha del Servicio</label>
            <input
              className="calendar-input"
              type="date"
              value={data.fecha}
              onChange={(e) => change("fecha", e.target.value)}
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
              required
            />
          </div>

          <div className="calendar-form-group">
            <label>Dirección</label>
            <input
              className="calendar-input"
              list="direcciones-list"
              value={data.direccion}
              onChange={(e) => {
                change("direccion", e.target.value);
                loadClientFields(e.target.value);
              }}
              placeholder="Dirección completa del servicio"
              required
            />
            <datalist id="direcciones-list">
              {clients.map((client, index) => (
                <option key={index} value={client.direccion} />
              ))}
            </datalist>
          </div>

          <div className="calendar-form-group">
            <label>A Nombre De (Cliente)</label>
            <input
              className="calendar-input"
              value={data.anombrede}
              onChange={(e) => {
                change("anombrede", e.target.value);
                const titulo = e.target.value
                  ? `${e.target.value} - ${data.direccion || "Servicio"}`
                  : "";
                change("title", titulo);
              }}
              placeholder="Nombre del cliente (se carga automáticamente)"
              required
            />
          </div>

          <div className="calendar-form-group">
            <label>Cúbicos</label>
            <input
              className="calendar-input"
              type="number"
              min="0"
              step="0.1"
              value={data.cubicos}
              onChange={(e) => change("cubicos", e.target.value)}
              placeholder="Se carga automáticamente desde clientes"
              required
            />
          </div>

          <div className="calendar-form-group">
            <label>Valor (AWG)</label>
            <input
              className="calendar-input"
              type="number"
              min="0"
              step="0.01"
              value={data.valor}
              onChange={(e) => change("valor", e.target.value)}
              placeholder="Se carga automáticamente desde clientes"
              required
            />
          </div>

          <label className="flex flex-col md:col-span-2">
            Nota
            <textarea
              value={data.nota}
              onChange={(e) => change("nota", e.target.value)}
              rows={3}
              placeholder="Detalles adicionales."
            />
          </label>

          {/* Recurrencia */}
          <div className="md:col-span-2 border-t pt-2">
            <div className="font-medium mb-3">Recurrencia personalizada</div>

            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span>Cada</span>
              <input
                type="number"
                min={1}
                style={{ width: 80 }}
                value={data.interval}
                onChange={(e) =>
                  change("interval", Math.max(1, Number(e.target.value) || 1))
                }
              />
              <select
                value={data.freq}
                onChange={(e) => change("freq", e.target.value)}
              >
                <option value="DAILY">día(s)</option>
                <option value="WEEKLY">semana(s)</option>
                <option value="MONTHLY">mes(es)</option>
                <option value="YEARLY">año(s)</option>
              </select>
            </div>

            {data.freq === "WEEKLY" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAY_CODE.map((code, i) => (
                  <label
                    key={code}
                    style={{
                      border: "1px solid #ccc",
                      padding: "4px 8px",
                      borderRadius: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={data.weeklyDays.includes(code)}
                      onChange={(e) => {
                        const set = new Set(data.weeklyDays);
                        e.target.checked ? set.add(code) : set.delete(code);
                        change("weeklyDays", Array.from(set));
                      }}
                    />{" "}
                    {WEEKDAY_NAMES[i]}
                  </label>
                ))}
              </div>
            )}

            {data.freq === "MONTHLY" && (
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mmode"
                    checked={data.monthlyMode === "BYMONTHDAY"}
                    onChange={() => change("monthlyMode", "BYMONTHDAY")}
                  />
                  <span>El día</span>
                  <input
                    type="number"
                    min={-1}
                    max={31}
                    value={data.monthlyDay}
                    onChange={(e) =>
                      change("monthlyDay", Number(e.target.value))
                    }
                  />
                  <small className="text-gray-500">
                    (-1 = último día del mes)
                  </small>
                </label>
                <label className="flex items-center gap-2 flex-wrap">
                  <input
                    type="radio"
                    name="mmode"
                    checked={data.monthlyMode === "BYSETPOS"}
                    onChange={() => change("monthlyMode", "BYSETPOS")}
                  />
                  <span>El</span>
                  <select
                    value={data.monthlyNth.pos}
                    onChange={(e) =>
                      change("monthlyNth", {
                        ...data.monthlyNth,
                        pos: Number(e.target.value),
                      })
                    }
                  >
                    <option value={1}>primer</option>
                    <option value={2}>segundo</option>
                    <option value={3}>tercer</option>
                    <option value={4}>cuarto</option>
                    <option value={-1}>último</option>
                  </select>
                  <select
                    value={data.monthlyNth.day}
                    onChange={(e) =>
                      change("monthlyNth", {
                        ...data.monthlyNth,
                        day: e.target.value,
                      })
                    }
                  >
                    {WEEKDAY_CODE.map((c, i) => (
                      <option key={c} value={c}>
                        {WEEKDAY_NAMES[i]}
                      </option>
                    ))}
                  </select>
                  <span>del mes</span>
                </label>
              </div>
            )}

            {/* Fin de recurrencia */}
            <div className="mt-3 space-y-2">
              <div className="font-medium">Finaliza</div>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="endmode"
                  checked={data.endMode === "NEVER"}
                  onChange={() => change("endMode", "NEVER")}
                />{" "}
                Nunca
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="endmode"
                  checked={data.endMode === "UNTIL"}
                  onChange={() => change("endMode", "UNTIL")}
                />{" "}
                El
                <input
                  type="date"
                  disabled={data.endMode !== "UNTIL"}
                  value={data.untilDate}
                  onChange={(e) => change("untilDate", e.target.value)}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="endmode"
                  checked={data.endMode === "COUNT"}
                  onChange={() => change("endMode", "COUNT")}
                />{" "}
                Después de
                <input
                  type="number"
                  min={1}
                  disabled={data.endMode !== "COUNT"}
                  value={data.count}
                  onChange={(e) => change("count", e.target.value)}
                  style={{ width: 100 }}
                />{" "}
                ocurrencias
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              backgroundColor: "#f8f9fa",
              color: "#333",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(data)}
            style={{
              padding: "8px 16px",
              border: "1px solid #007bff",
              borderRadius: "4px",
              backgroundColor: "#007bff",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  // Render como **portal** para que sea una ventana emergente real
  return createPortal(modal, document.body);
}

const Test = () => {
  const [loading, setLoading] = useState(true);

  const [editingContext, setEditingContext] = useState(null);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);

  const [viewDate, setViewDate] = useState(new Date());
  const [events, setEvents] = useState([]); // series
  const [instances, setInstances] = useState([]); // instancias renderizadas (ventana)
  const [openForm, setOpenForm] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);

  // Estados para cargar clientes
  const [clients, setClients] = useState([]);

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

  const loadSeries = async () => {
    try {
      const snap = await get(ref(database, pSeries()));
      const data = snap.exists() ? snap.val() : {};
      const arr = Object.entries(data)
        .map(([id, val]) => ({ id, ...val }))
        .sort((a, b) => {
          const dateA = new Date(a.start?.ts || 0);
          const dateB = new Date(b.start?.ts || 0);
          return dateA - dateB;
        });
      setEvents(arr);
    } catch (error) {
      console.error("Error loading series:", error);
    }
  };

  // Expandir y cargar instancias visibles
  const loadInstancesForWindow = async () => {
    try {
      const { start, end } = buildWindow(viewDate);
      const occ = [];
      for (const s of events) {
        const list = generateOccurrences(s, start, end);
        await upsertInstances(s.calendarId || defaultCalendarId, s.id, list);
        occ.push(
          ...list.map((o) => ({ ...o, seriesId: s.id, title: s.title }))
        );
      }
      setInstances(occ.sort((a, b) => a.start.ts - b.start.ts));
    } catch (error) {
      console.error("Error loading instances:", error);
    }
  };

  useEffect(() => {
    loadSeries();
    setLoading(false);
  }, []);

  useEffect(() => {
    if (events.length > 0) {
      loadInstancesForWindow();
    }
  }, [events.length, viewDate.getTime()]);

  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetchedClients = Object.entries(snapshot.val()).map(
          ([id, client]) => ({
            id,
            direccion: client.direccion,
            cubicos: client.cubicos,
            valor: client.valor,
            anombrede: client.anombrede,
          })
        );
        setClients(fetchedClients);
      } else {
        setClients([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Guardar servicio (crear/editar)
  const handleSave = async (form) => {
    try {
      // Construcción de fechas - Los servicios son siempre todo el día
      const startDate = new Date(form.fecha);
      const st = startOfDay(startDate);
      const en = endOfDay(startDate);

      // Generar ID único para el servicio si no existe
      const serviceId = form.serviceId || push(ref(database, pSeries())).key;

      // === Builder RRULE desde la UI personalizada ===
      const buildRRULE = () => {
        if (form.rrulePreset === "NONE") return null;
        const base = {
          FREQ: form.freq || "WEEKLY",
          INTERVAL: Math.max(1, Number(form.interval) || 1),
        };
        const endMode = form.endMode || "NEVER";
        if (endMode === "UNTIL" && form.untilDate)
          base.UNTIL = new Date(form.untilDate).getTime();
        if (endMode === "COUNT" && form.count) base.COUNT = Number(form.count);

        if (base.FREQ === "WEEKLY") {
          base.BYDAY =
            form.weeklyDays && form.weeklyDays.length
              ? form.weeklyDays
              : [WEEKDAY_CODE[dayIdx(st)]];
        }
        if (base.FREQ === "MONTHLY") {
          if (form.monthlyMode === "BYSETPOS") {
            base.BYDAY = [form.monthlyNth?.day || WEEKDAY_CODE[dayIdx(st)]];
            base.BYSETPOS = Number(form.monthlyNth?.pos || 1);
          } else {
            base.BYMONTHDAY = Number(form.monthlyDay || st.getDate());
          }
        }
        return base;
      };

      const seriesId = editingSeries?.id || serviceId;

      const nextService = {
        // === Estructura obligatoria del servicio ===
        id: seriesId,
        serviceId: serviceId,
        fecha: form.fecha,
        anombrede: form.anombrede,
        direccion: form.direccion,
        cubicos: parseFloat(form.cubicos) || 0,
        valor: parseFloat(form.valor) || 0,
        nota: form.nota,

        // === Campos del calendario ===
        title: form.title || `${form.anombrede} - ${form.direccion}`,
        calendarId: form.calendarId || defaultCalendarId,
        allDay: true,
        start: { ts: st.getTime(), tz: IANA_TZ },
        end: { ts: en.getTime(), tz: IANA_TZ },

        // === Recurrencia ===
        rrule: buildRRULE(),
        exdates: editingSeries?.exdates || [],
        overrides: editingSeries?.overrides || {},

        // === Timestamps ===
        createdAt: editingSeries?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      // Si no estamos editando, simplemente crear
      if (!editingSeries) {
        await set(ref(database, `${pSeries()}/${seriesId}`), nextService);
        console.log("Servicio creado:", nextService);
        console.log("Datos del formulario validados:", form);
        setOpenForm(false);
        setEditingSeries(null);
        setEditingContext(null);
        setTimeout(() => loadSeries(), 100);

        // Mostrar confirmación de creación
        Swal.fire({
          icon: "success",
          title: "¡Servicio creado!",
          text: "El servicio ha sido programado exitosamente",
          timer: 2000,
          showConfirmButton: false,
          zIndex: 10000,
        });
        return;
      }

      // === Guardar con alcance (solo esta / esta y siguientes / toda la serie) ===
      const askScope = async () => {
        const { value: scope } = await Swal.fire({
          title: "Aplicar cambios a…",
          icon: "question",
          html: `
          <div style="text-align: center; margin: 20px 0;">
            <button id="only" style="width: 100%; margin: 8px 0; padding: 12px; background-color: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
              Solo este evento
            </button>
            <br>
            <button id="following" style="width: 100%; margin: 8px 0; padding: 12px; background-color: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
              Este y los siguientes
            </button>
            <br>
            <button id="all" style="width: 100%; margin: 8px 0; padding: 12px; background-color: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
              Toda la serie
            </button>
          </div>
        `,
          showCancelButton: true,
          showConfirmButton: false,
          cancelButtonText: "Cancelar",
          width: "450px",
          allowOutsideClick: false,
          zIndex: 10000,
          didOpen: () => {
            const popup = Swal.getPopup();
            popup.querySelector("#only").onclick = () => {
              Swal.getPopup().setAttribute("data-scope", "only");
              Swal.clickConfirm();
            };
            popup.querySelector("#following").onclick = () => {
              Swal.getPopup().setAttribute("data-scope", "following");
              Swal.clickConfirm();
            };
            popup.querySelector("#all").onclick = () => {
              Swal.getPopup().setAttribute("data-scope", "all");
              Swal.clickConfirm();
            };
          },
          preConfirm: () => {
            return Swal.getPopup().getAttribute("data-scope");
          },
        });

        return scope || "cancel";
      };

      const scope = await askScope();
      if (scope === "cancel") return;

      if (scope === "only" && editingContext) {
        // override únicamente para la ocurrencia que se estaba editando
        const overrides = editingSeries.overrides
          ? { ...editingSeries.overrides }
          : {};
        const duration = nextService.end.ts - nextService.start.ts;

        // Usar la nueva fecha seleccionada por el usuario (permitir cambio completo de fecha)
        const newStart = new Date(nextService.start.ts);
        const newEnd = new Date(newStart.getTime() + duration);

        overrides[editingContext.occurrenceId] = {
          start: { ts: newStart.getTime(), tz: IANA_TZ },
          end: { ts: newEnd.getTime(), tz: IANA_TZ },
          title: nextService.title,
          // Incluir datos específicos del servicio en el override
          anombrede: nextService.anombrede,
          direccion: nextService.direccion,
          cubicos: nextService.cubicos,
          valor: nextService.valor,
          nota: nextService.nota,
        };
        await update(ref(database, `${pSeries()}/${editingSeries.id}`), {
          overrides,
          updatedAt: Date.now(),
        });
      } else if (scope === "following" && editingContext) {
        // Cerramos serie A antes de la ocurrencia editada
        const until = new Date(editingContext.start.ts - 1);
        const A = {
          ...editingSeries,
          rrule: editingSeries.rrule
            ? { ...editingSeries.rrule, UNTIL: until.getTime() }
            : null,
          updatedAt: Date.now(),
        };
        await set(ref(database, `${pSeries()}/${editingSeries.id}`), A);

        // Agregar fechas excluidas entre la fecha original y la nueva fecha
        const originalDate = new Date(editingContext.start.ts);
        const newDate = new Date(nextService.start.ts);
        const exdates = [...(editingSeries.exdates || [])];

        // Si la nueva fecha es posterior, excluir los días intermedios
        if (newDate > originalDate) {
          const current = new Date(originalDate);
          current.setDate(current.getDate() + 1); // Empezar desde el día siguiente

          while (current < newDate) {
            exdates.push(current.getTime());
            current.setDate(current.getDate() + 1);
          }
        }

        // Creamos serie B que comienza en la nueva fecha
        const newRef = push(ref(database, pSeries()));
        const B = {
          ...nextService,
          id: newRef.key,
          start: { ts: nextService.start.ts, tz: IANA_TZ },
          end: { ts: nextService.end.ts, tz: IANA_TZ },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          exdates: [],
          overrides: {},
        };
        await set(newRef, B);
      } else {
        // Toda la serie
        await set(
          ref(database, `${pSeries()}/${editingSeries.id}`),
          nextService
        );
      }

      setOpenForm(false);
      setEditingSeries(null);
      setEditingContext(null);

      // Mostrar confirmación de edición
      Swal.fire({
        icon: "success",
        title: "¡Servicio actualizado!",
        text: "Los cambios han sido guardados exitosamente",
        timer: 2000,
        showConfirmButton: false,
        zIndex: 10000,
      });
    } catch (error) {
      console.error("Error al guardar servicio:", error);
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: "Hubo un problema al guardar el servicio. Por favor intenta de nuevo.",
        confirmButtonText: "Entendido",
        zIndex: 10000,
      });
    }
  };

  // Eliminar evento con opciones
  const deleteEvent = async (s, occ) => {
    // Mostrar opciones de eliminación con SweetAlert2
    const { value: result } = await Swal.fire({
      title: "¿Qué deseas eliminar?",
      icon: "warning",
      zIndex: 10000,
      html: `
        <div style="text-align: center; margin: 20px 0;">
          <button id="deleteThis" style="width: 100%; margin: 8px 0; padding: 12px; background-color: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 5px; cursor: pointer;">
            Solo este evento (${new Date(occ.start.ts).toLocaleDateString(
              "es-ES"
            )})
          </button>
          <br>
          <button id="deleteSeries" style="width: 100%; margin: 8px 0; padding: 12px; background-color: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 5px; cursor: pointer;">
            Toda la serie "${s.title}"
          </button>
        </div>
      `,
      showCancelButton: true,
      showConfirmButton: false,
      cancelButtonText: "Cancelar",
      width: "450px",
      allowOutsideClick: false,
      didOpen: () => {
        const popup = Swal.getPopup();
        popup.querySelector("#deleteThis").onclick = () => Swal.clickConfirm();
        popup.querySelector("#deleteSeries").onclick = () => {
          Swal.getPopup().setAttribute("data-result", "series");
          Swal.clickConfirm();
        };
      },
      preConfirm: () => {
        return Swal.getPopup().getAttribute("data-result") || "this";
      },
    });

    const finalResult = result || "cancel";

    if (finalResult === "cancel") return;

    try {
      if (finalResult === "this") {
        // Eliminar solo esta ocurrencia (agregar a EXDATE)
        const exdates = Array.isArray(s.exdates) ? [...s.exdates] : [];

        // Normalizar el timestamp al inicio del día para evitar problemas de precisión
        const occDate = new Date(occ.start.ts);
        const normalizedDate = new Date(
          occDate.getFullYear(),
          occDate.getMonth(),
          occDate.getDate(),
          occDate.getHours(),
          occDate.getMinutes(),
          0,
          0
        );

        // Verificar si ya está en exdates
        if (!exdates.includes(normalizedDate.getTime())) {
          exdates.push(normalizedDate.getTime());

          await update(ref(database, `${pSeries()}/${s.id}`), {
            exdates,
            updatedAt: Date.now(),
          });

          console.log(
            "Evento excluido:",
            normalizedDate.toISOString(),
            "de la serie:",
            s.title
          );

          // Mostrar mensaje de confirmación
          setTimeout(() => {
            Swal.fire({
              icon: "success",
              title: "¡Eliminado!",
              text: "Evento eliminado exitosamente",
              timer: 2000,
              showConfirmButton: false,
              zIndex: 10000,
            });
          }, 100);
        }
      } else if (finalResult === "series") {
        // Eliminar toda la serie
        await remove(ref(database, `${pSeries()}/${s.id}`));

        // También eliminar todas las instancias relacionadas
        const { start, end } = buildWindow(new Date());
        const y1 = start.getFullYear(),
          y2 = end.getFullYear();
        const m1 = start.getMonth() + 1,
          m2 = end.getMonth() + 1;

        const deletePromises = [];
        for (let y = y1; y <= y2; y++) {
          const startM = y === y1 ? m1 : 1;
          const endM = y === y2 ? m2 : 12;
          for (let m = startM; m <= endM; m++) {
            deletePromises.push(
              remove(
                ref(
                  database,
                  pInstancesMonth(s.calendarId || defaultCalendarId, s.id, y, m)
                )
              )
            );
          }
        }
        await Promise.all(deletePromises);

        // Mostrar mensaje de confirmación para eliminación de serie
        setTimeout(() => {
          Swal.fire({
            icon: "success",
            title: "¡Serie eliminada!",
            text: "Serie completa eliminada exitosamente",
            timer: 2000,
            showConfirmButton: false,
            zIndex: 10000,
          });
        }, 100);
      }

      setTimeout(() => loadSeries(), 100);
    } catch (error) {
      console.error("Error al eliminar evento:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al eliminar el evento. Inténtalo de nuevo.",
        confirmButtonText: "Entendido",
        zIndex: 10000,
      });
    }
  };

  // Mover una ocurrencia: Solo esta / Esta y siguientes / Toda la serie
  const moveOccurrence = async (s, occ, newStart) => {
    const duration = s.end.ts - s.start.ts;
    const newEnd = new Date(newStart.getTime() + duration);

    const { value: scope } = await Swal.fire({
      title: "Mover servicio",
      icon: "question",
      zIndex: 10000,
      html: `
        <div style="text-align: center; margin: 20px 0;">
          <button id="scope1" style="width: 100%; margin: 8px 0; padding: 12px; background-color: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
            Solo esta ocurrencia
          </button>
          <br>
          <button id="scope2" style="width: 100%; margin: 8px 0; padding: 12px; background-color: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
            Esta y las siguientes
          </button>
          <br>
          <button id="scope3" style="width: 100%; margin: 8px 0; padding: 12px; background-color: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
            Toda la serie
          </button>
        </div>
      `,
      showCancelButton: true,
      showConfirmButton: false,
      cancelButtonText: "Cancelar",
      width: "450px",
      allowOutsideClick: false,
      didOpen: () => {
        const popup = Swal.getPopup();
        popup.querySelector("#scope1").onclick = () => {
          Swal.getPopup().setAttribute("data-scope", "1");
          Swal.clickConfirm();
        };
        popup.querySelector("#scope2").onclick = () => {
          Swal.getPopup().setAttribute("data-scope", "2");
          Swal.clickConfirm();
        };
        popup.querySelector("#scope3").onclick = () => {
          Swal.getPopup().setAttribute("data-scope", "3");
          Swal.clickConfirm();
        };
      },
      preConfirm: () => {
        return Swal.getPopup().getAttribute("data-scope");
      },
    }).then((result) => result.value || null);

    if (!scope) return; // Cancelado

    if (scope === "1") {
      const overrides = s.overrides || {};
      overrides[occ.occurrenceId] = {
        start: { ts: newStart.getTime(), tz: s.start.tz },
        end: { ts: newEnd.getTime(), tz: s.end.tz },
      };
      await update(ref(database, `${pSeries()}/${s.id}`), {
        overrides,
        updatedAt: Date.now(),
      });
    } else if (scope === "2") {
      const until = new Date(occ.start.ts - 1);
      const A = {
        ...s,
        rrule: s.rrule ? { ...s.rrule, UNTIL: until.getTime() } : null,
        updatedAt: Date.now(),
      };
      await set(ref(database, `${pSeries()}/${s.id}`), A);
      const B = {
        ...s,
        start: { ts: newStart.getTime(), tz: s.start.tz },
        end: { ts: newEnd.getTime(), tz: s.end.tz },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        exdates: [],
        overrides: {},
      };
      const newRef = push(ref(database, pSeries()));
      const newId = newRef.key;
      await set(newRef, B);
    } else if (scope === "3") {
      const patch = {
        start: { ts: newStart.getTime(), tz: s.start.tz },
        end: { ts: newEnd.getTime(), tz: s.end.tz },
        updatedAt: Date.now(),
      };
      await update(ref(database, `${pSeries()}/${s.id}`), patch);
    }
    await loadSeries();
  };

  // Vista mensual (agenda por día)
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const monthMatrix = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const dim = daysInMonth(y, m);
    const arr = [];
    for (let d = 1; d <= dim; d++) {
      const day = new Date(y, m, d, 0, 0, 0, 0);
      const eventsToday = instances.filter((i) => {
        const di = new Date(i.start.ts);
        return (
          di.getFullYear() === y && di.getMonth() === m && di.getDate() === d
        );
      });
      arr.push({ day, eventsToday });
    }
    return arr;
  }, [viewDate, instances]);

  const prevMonth = () => setViewDate(addMonths(viewDate, -1));
  const nextMonth = () => setViewDate(addMonths(viewDate, 1));
  const today = () => setViewDate(new Date());

  // Mostrar pantalla de carga mientras se cargan los datos
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
      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Reprogramacion</h1>
          <div className="current-date">
            <div style={{ cursor: "default" }}>
              {new Date().toLocaleDateString("es-ES")}
            </div>
            <Clock />
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="calendar-nav-header">
          <button className="calendar-nav-button" onClick={prevMonth}>
            ◀
          </button>
          <button className="calendar-nav-button today-btn" onClick={today}>
            Hoy
          </button>
          <button className="calendar-nav-button" onClick={nextMonth}>
            ▶
          </button>
          <div className="calendar-month-title">
            {viewDate.toLocaleString("es-ES", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <button
            className="calendar-create-button"
            onClick={() => {
              setEditingSeries(null);
              setOpenForm(true);
            }}
          >
            Programar Servicio
          </button>
        </div>

        {/* Vista tipo “Agenda por día” mensual */}
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="direccion-fixed-th">Dirección</th>
                <th>A Nombre De</th>
                <th>Cúbicos</th>
                <th>Valor</th>
                <th>Notas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {monthMatrix.length > 0 ? (
                monthMatrix.flatMap(({ day, eventsToday }) =>
                  eventsToday.map((ev) => {
                    const s = events.find((x) => x.id === ev.seriesId) || {};
                    return (
                      <tr key={ev.occurrenceId}>
                        <td style={{ minWidth: "10ch" }}>
                          {day.toLocaleDateString("es-ES", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <td className="direccion-fixed-td">
                          <input
                            className="direccion-fixed-input"
                            type="text"
                            style={{ width: "20ch" }}
                            value={s.direccion || ""}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            style={{
                              width: `${Math.max(
                                s.anombrede?.length || 1,
                                20
                              )}ch`,
                            }}
                            value={s.anombrede || ""}
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            style={{ width: "8ch" }}
                            value={s.cubicos || ""}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            style={{ width: "10ch" }}
                            value={s.valor || ""}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            style={{ width: "15ch" }}
                            value={s.nota || ""}
                          />
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button
                              title="Editar servicio"
                              onClick={() => {
                                setEditingSeries(s);
                                setEditingContext(ev);
                                setOpenForm(true);
                              }}
                              style={{
                                padding: "4px 8px",
                                fontSize: "12px",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                cursor: "pointer",
                                background: "#f8f9fa",
                              }}
                            >
                              ✎
                            </button>
                            <button
                              title="Eliminar servicio"
                              onClick={() => deleteEvent(s, ev)}
                              style={{
                                padding: "4px 8px",
                                fontSize: "12px",
                                border: "1px solid #dc3545",
                                borderRadius: "4px",
                                cursor: "pointer",
                                background: "#f8f9fa",
                                color: "#dc3545",
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    style={{ textAlign: "center", padding: "20px" }}
                  >
                    Sin servicios programados para este mes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogo */}
      <ServiceForm
        open={openForm}
        clients={clients}
        initial={
          editingSeries
            ? {
                ...EmptyService,
                // === Campos obligatorios del servicio ===
                serviceId: editingSeries.serviceId || editingSeries.id,
                fecha: editingContext
                  ? toISODate(new Date(editingContext.start.ts))
                  : editingSeries.fecha ||
                    toISODate(new Date(editingSeries.start.ts)),
                anombrede: editingSeries.anombrede || "",
                direccion: editingSeries.direccion || "",
                cubicos: editingSeries.cubicos || "",
                valor: editingSeries.valor || "",

                // === Campos del calendario ===
                title: editingSeries.title,
                nota: editingSeries.nota || "",

                // === Recurrencia ===
                rrulePreset: (() => {
                  const r = editingSeries.rrule;
                  if (!r) return "NONE";
                  if (r.WORKDAYS) return "WORKDAYS";
                  if (r.FREQ === "DAILY") return "DAILY";
                  if (r.FREQ === "WEEKLY") return "WEEKLY";
                  if (r.FREQ === "MONTHLY" && r.BYMONTHDAY != null)
                    return "MONTHLY_DAY";
                  if (r.FREQ === "MONTHLY" && r.BYSETPOS) return "MONTHLY_NTH";
                  if (r.FREQ === "YEARLY") return "YEARLY";
                  return "NONE";
                })(),
                weeklyDays: editingSeries?.rrule?.BYDAY || ["LUN"],
                monthlyDay: editingSeries?.rrule?.BYMONTHDAY ?? 15,
                monthlyNth: {
                  pos: editingSeries?.rrule?.BYSETPOS ?? 4,
                  day: (editingSeries?.rrule?.BYDAY || ["JUE"])[0],
                },
                untilDate: editingSeries?.rrule?.UNTIL
                  ? toISODate(new Date(editingSeries.rrule.UNTIL))
                  : "",
                count: editingSeries?.rrule?.COUNT ?? "",
              }
            : null
        }
        onClose={() => {
          setOpenForm(false);
          setEditingSeries(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
};

export default React.memo(Test);
