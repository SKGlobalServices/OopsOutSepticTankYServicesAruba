/* ─────────────────────  AgendaExpress.jsx  ───────────────────── */
import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import Swal from "sweetalert2";
import Slidebar from "./Slidebar";
import servicioHoyIcon2 from "../assets/img/servicioHoyIcon2.png";
import servicioMananaIcon2 from "../assets/img/servicioMananaIcon2.png";
import servicioPasadoMananaIcon2 from "../assets/img/servicioPasadoMananaIcon2.png";
import { auditCreate } from "../utils/auditLogger";

const RUTA = {
  hoy: "data",
  manana: "hojamañana",
  pasado: "hojapasadomañana",
};
const vibrate = (ms = 35) => navigator.vibrate && navigator.vibrate(ms);

const colores = ["#000000", "#000000", "#000000", "#000000", "#000000"];

const labelStyle = (color) => ({
  margin: "0 0 0.3rem 0",
  fontSize: "0.68rem",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color,
  textAlign: "center",
  width: "100%",
});

const fieldSt = {
  padding: "0.55rem 1rem",
  fontSize: "0.92rem",
};

/* ─────────────────────  NumInput  ───────────────────── */
const NumInput = ({ value, onChange, min, max, step = 1, accent, onEnter }) => {
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <input
      ref={inputRef}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      style={{ "--accent": accent, ...fieldSt }}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEnter();
      }}
    />
  );
};

/* ─────────────────────  TextArea  ───────────────────── */
const TextArea = ({ value, onChange, accent, onEnter }) => {
  const ref = useRef(null);
  const [temp, setTemp] = useState(value);

  useEffect(() => {
    setTemp(value);
  }, [value]);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const save = () => onChange(temp);

  return (
    <>
      <textarea
        ref={ref}
        rows={2}
        value={temp}
        style={{
          "--accent": accent,
          ...fieldSt,
          maxHeight: "65px",
          resize: "none",
          overflowY: "auto",
        }}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            save();
            onEnter();
          }
        }}
      />
    </>
  );
};

/* ─────────────────────  AgendaExpress  ───────────────────── */
const AgendaExpress = () => {
  const [fase, setFase] = useState("seleccion");
  const [dia, setDia] = useState("");
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsub = onValue(dbRef, (snap) => {
      if (snap.exists()) {
        setClients(
          Object.entries(snap.val()).map(([id, c]) => ({
            id,
            nombre: c.nombre,
            direccion: c.direccion,
            cubicos: c.cubicos,
            valor: c.valor,
            anombrede: c.anombrede || "",
            email: c.email || "",
            telefono1: c.telefono1 || "",
          })),
        );
      } else {
        setClients([]);
      }
    });
    return () => unsub();
  }, []);

  const save = async (payload) => {
    try {
      const moduloNombres = {
        hoy: "Servicios Hoy",
        manana: "Servicios Mañana",
        pasado: "Servicios Pasado Mañana",
      };
      const { email: _e, telefono1: _t, ...payloadServicio } = payload;
      await auditCreate(
        RUTA[dia],
        { ...payloadServicio, creadoEn: Date.now() },
        {
          modulo: "Agenda Express",
          extra: `Agendado en ${moduloNombres[dia]} - Dirección: ${payload.direccion || " - "}`,
        },
      );

      const clienteExistente = clients.find(
        (c) =>
          (c.direccion || "").trim().toLowerCase() ===
          (payload.direccion || "").trim().toLowerCase(),
      );

      const result = await Swal.fire({
        title: "¿Actualizar datos del cliente?",
        html: `
          <div style="display:flex;gap:12px;text-align:left;font-size:0.9rem">
            <div style="flex:1;background:#e8f0fe;border-radius:10px;padding:10px 12px">
              <div style="font-weight:900;color:#1a56db;margin-bottom:8px;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em">Anterior</div>
              <p style="margin:4px 0"><b>Cúbicos:</b> ${clienteExistente?.cubicos ?? "N/A"}</p>
              <p style="margin:4px 0"><b>Valor:</b> ${clienteExistente?.valor ?? "N/A"}</p>
              <p style="margin:4px 0"><b>A nombre de:</b> ${clienteExistente?.anombrede || "N/A"}</p>
              <p style="margin:4px 0"><b>Email:</b> ${clienteExistente?.email || "N/A"}</p>
              <p style="margin:4px 0"><b>Teléfono:</b> ${clienteExistente?.telefono1 || "N/A"}</p>
            </div>
            <div style="flex:1;background:#e6f9f0;border-radius:10px;padding:10px 12px">
              <div style="font-weight:900;color:#057a55;margin-bottom:8px;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em">Nuevo</div>
              <p style="margin:4px 0"><b>Cúbicos:</b> ${payload.cubicos || "N/A"}</p>
              <p style="margin:4px 0"><b>Valor:</b> ${payload.valor || "N/A"}</p>
              <p style="margin:4px 0"><b>A nombre de:</b> ${payload.anombrede || "N/A"}</p>
              <p style="margin:4px 0"><b>Email:</b> ${payload.email || "N/A"}</p>
              <p style="margin:4px 0"><b>Teléfono:</b> ${payload.telefono1 || "N/A"}</p>
            </div>
          </div>
          <p style="margin-top:10px;font-size:0.82rem;color:#555"><b>Dirección:</b> ${payload.direccion || "N/A"}</p>
        `,
        icon: "info",
        showCancelButton: true,
        confirmButtonText: "Sí, actualizar",
        cancelButtonText: "No, mantener actual",
        confirmButtonColor: "#057a55",
        cancelButtonColor: "#1a56db",
      });

      if (result.isConfirmed && clienteExistente?.id) {
        const updateData = {
          cubicos: payload.cubicos,
          valor: payload.valor,
          email: payload.email,
          telefono1: payload.telefono1,
        };
        if (payload.anombrede) updateData.anombrede = payload.anombrede;
        await update(
          ref(database, `clientes/${clienteExistente.id}`),
          updateData,
        );
      }

      Swal.fire({ icon: "success", title: "¡Agendado!" });
      setFase("seleccion");
      setDia("");
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "Error al guardar" });
    }
  };

  const rootCls = `agendaEX ${fase === "formulario" ? "fase-form" : ""}`;
  const labelDia = { hoy: "HOY", manana: "MAÑANA", pasado: "PASADO MAÑANA" }[
    dia
  ];

  /* ─────────────────────  SingleForm  ───────────────────── */
  const SingleForm = ({ onCancel, onSubmit, clients }) => {
    const [data, setData] = useState({
      direccion: "",
      servicio: "",
      cubicos: "",
      valor: "",
      notas: "",
      anombrede: "",
      email: "",
      telefono1: "",
    });

    const upd = (k, v) => setData((d) => ({ ...d, [k]: v }));
    const ok = () => onSubmit(data);

    useEffect(() => {
      const norm = (data.direccion || "").trim().toLowerCase();
      const cli = clients.find(
        (c) => (c.direccion || "").trim().toLowerCase() === norm,
      );
      if (cli) {
        setData((d) => ({
          ...d,
          ...(cli.cubicos != null ? { cubicos: cli.cubicos } : {}),
          ...(cli.valor != null ? { valor: cli.valor } : {}),
          anombrede: cli.anombrede ?? d.anombrede,
          email: cli.email ?? d.email,
          telefono1: cli.telefono1 ?? d.telefono1,
        }));
      }
    }, [data.direccion, clients]);

    const listo = data.direccion.trim() !== "";

    return (
      <div
        className="turboCard"
        style={{
          boxSizing: "border-box",
        }}
      >
        <div className="autoField">
          <p style={labelStyle(colores[0])}>A Nombre De</p>
          <input
            value={data.anombrede}
            style={{ "--accent": colores[0], ...fieldSt }}
            onChange={(e) => upd("anombrede", e.target.value)}
          />
        </div>

        <div className="autoField">
          <p style={labelStyle(colores[0])}>Dirección</p>
          <input
            autoFocus
            value={data.direccion}
            list="direccion-list-aexp"
            style={{ "--accent": colores[0], ...fieldSt }}
            onChange={(e) => upd("direccion", e.target.value)}
            placeholder="Rellena para autocompletar campos"
          />
          <datalist id="direccion-list-aexp">
            {clients
              .map((c) => c.direccion)
              .filter(Boolean)
              .sort()
              .map((d, i) => (
                <option key={i} value={d} />
              ))}
          </datalist>
        </div>

        <div className="autoField">
          <p style={labelStyle(colores[1])}>Servicio</p>
          <select
            value={data.servicio}
            style={{
              "--accent": colores[1],
              ...fieldSt,
              paddingRight: "2.2rem",
            }}
            onChange={(e) => upd("servicio", e.target.value)}
          >
            <option value=""></option>
            <option value="Poso">Poso</option>
            <option value="Tuberia">Tuberia</option>
            <option value="Poso + Tuberia">Poso + Tuberia</option>
            <option value="Poso + Grease Trap">Poso + Grease Trap</option>
            <option value="Tuberia + Grease Trap">Tuberia + Grease Trap</option>
            <option value="Grease Trap">Grease Trap</option>
            <option value="Water">Water</option>
            <option value="Pool">Pool</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "0.7rem", width: "100%" }}>
          <div className="autoField" style={{ flex: 1 }}>
            <p style={labelStyle(colores[2])}>Cúbicos</p>
            <NumInput
              value={data.cubicos}
              min={0}
              max={50}
              onChange={(v) => upd("cubicos", v)}
              accent={colores[2]}
              onEnter={ok}
            />
          </div>
          <div className="autoField" style={{ flex: 1 }}>
            <p style={labelStyle(colores[3])}>Valor (AWG)</p>
            <NumInput
              value={data.valor}
              step={5}
              onChange={(v) => upd("valor", v)}
              accent={colores[3]}
              onEnter={ok}
            />
          </div>
        </div>

        <div className="autoField">
          <p style={labelStyle(colores[4])}>Notas</p>
          <TextArea
            value={data.notas}
            onChange={(v) => upd("notas", v)}
            accent={colores[4]}
            onEnter={ok}
          />
        </div>

        <div className="autoField">
          <p style={labelStyle(colores[0])}>Teléfono</p>
          <input
            type="tel"
            value={data.telefono1}
            style={{ "--accent": colores[0], ...fieldSt }}
            onChange={(e) => upd("telefono1", e.target.value)}
            placeholder="Ejemplo: +2975942808"
          />
        </div>

        <div className="autoField">
          <p style={labelStyle(colores[0])}>Email</p>
          <input
            type="email"
            value={data.email}
            style={{ "--accent": colores[0], ...fieldSt }}
            onChange={(e) => upd("email", e.target.value)}
          />
        </div>

        <div className="turboBtns" style={{ marginTop: "0.4rem" }}>
          <button className="ok" onClick={ok} disabled={!listo}>
            Agendar
          </button>
        </div>
        <button
          className="cancel"
          style={{ marginTop: "0.5rem" }}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    );
  };

  return (
    <div className={rootCls}>
      <Slidebar />
      <header className={`aexp-header ${dia ? "withDia" : ""}`}>
        <h1 className="aexp-title">AGENDA EXPRESS</h1>
        {labelDia && <h2 className="aexp-subtitle">AGENDANDAR: {labelDia}</h2>}
      </header>

      {fase === "seleccion" && (
        <div className="tarjetas-dia">
          {["hoy", "manana", "pasado"].map((id) => (
            <button
              key={id}
              className="tarjeta"
              onClick={() => {
                vibrate();
                setDia(id);
                setFase("formulario");
              }}
            >
              <span className="icono-dia">
                <img
                  src={
                    id === "hoy"
                      ? servicioHoyIcon2
                      : id === "manana"
                        ? servicioMananaIcon2
                        : servicioPasadoMananaIcon2
                  }
                  alt={id}
                  className="icono-dia-img"
                />
              </span>
              <span className="titulo-dia">
                {id === "hoy"
                  ? "HOY"
                  : id === "manana"
                    ? "MAÑANA"
                    : "PASADO MAÑANA"}
              </span>
              <div className="shine" />
            </button>
          ))}
        </div>
      )}

      {fase === "formulario" && (
        <SingleForm
          key={dia}
          clients={clients}
          onCancel={() => {
            setFase("seleccion");
            setDia("");
          }}
          onSubmit={save}
        />
      )}
    </div>
  );
};

export default React.memo(AgendaExpress);
