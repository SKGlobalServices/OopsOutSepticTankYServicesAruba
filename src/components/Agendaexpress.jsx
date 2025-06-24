/* ─────────────────────  AgendaExpress.jsx  ───────────────────── */
import React, { useState, useEffect } from "react";
import { database } from "../Database/firebaseConfig";
import { push, ref, set, onValue } from "firebase/database";
import Swal from "sweetalert2";
import Slidebar from "./Slidebar";
import servicioHoyIcon2 from "../assets/img/servicioHoyIcon2.png";
import servicioMananaIcon2 from "../assets/img/servicioMananaIcon2.png";
import servicioPasadoMananaIcon2 from "../assets/img/servicioPasadoMananaIcon2.png";

/*  rutas Firebase por día  */
const RUTA = {
  hoy: "data",
  manana: "hojamañana",
  pasado: "hojapasadomañana",
};
const vibrate = (ms = 35) => navigator.vibrate && navigator.vibrate(ms);

const AgendaExpress = () => {
  /* ---------- estados ---------- */
  const [fase, setFase] = useState("seleccion");
  const [dia, setDia] = useState("");
  const [clients, setClients] = useState([]);

  /* ---------- cargar clientes ---------- */
  useEffect(() => {
    const dbRef = ref(database, "clientes");
    const unsub = onValue(dbRef, (snap) => {
      if (snap.exists()) {
        const arr = Object.values(snap.val()).map((c) => ({
          direccion: c.direccion,
          cubicos: c.cubicos,
        }));
        setClients(arr);
      } else {
        setClients([]);
      }
    });
    return () => unsub();
  }, []);

  /* ---------- guardar ---------- */
  const save = async (payload) => {
    try {
      await set(push(ref(database, RUTA[dia])), {
        ...payload,
        creadoEn: Date.now(),
      });
      Swal.fire({ icon: "success", title: "¡Agendado!" });
      setFase("seleccion");
      setDia("");
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "Error al guardar" });
    }
  };

  const rootCls = `agendaEX ${
    fase === "formulario" ? "fase-form" : ""
  }`;
  const labelDia = { hoy: "HOY", manana: "MAÑANA", pasado: "PASADO MAÑANA" }[dia];

  /* ============================================================= */
  /*                       Wizard Form v2                           */
  /* ============================================================= */
  const campos = ["direccion", "servicio", "cubicos", "valor", "notas"];
  const colores = ["#00eaff", "#a3ff00", "#ffd600", "#ff007c", "#9b5cff"];

  const WizardForm = ({ onCancel, onSubmit, clients }) => {
    const [step, setStep] = useState(0);
    const [data, setData] = useState({
      direccion: "",
      servicio: "",
      cubicos: "",
      valor: "",
      notas: "",
    });
    const accent = colores[step];

    const next = () => setStep((s) => Math.min(s + 1, campos.length - 1));
    const prev = () => setStep((s) => Math.max(s - 1, 0));
    const update = (k, v) => setData((d) => ({ ...d, [k]: v }));
    const ok = () => onSubmit(data);

    // Cuando cambie la dirección, carga automáticamente 'cubicos'
    useEffect(() => {
      const cli = clients.find(
        (c) => c.direccion === data.direccion
      );
      if (cli && cli.cubicos != null) {
        setData((d) => ({ ...d, cubicos: cli.cubicos }));
      }
    }, [data.direccion, clients]);

    const campo = campos[step];
    const props = { accent, onEnter: next, onEsc: prev };

    /* ---------- Aquí redefinimos AutoInput, NumInput y TextArea ---------- */
    const AutoInput = ({
      fieldKey,   // ej: "direccion" o "servicio"
      label,
      value,
      onChange,
      lista,
      accent,
      onEnter,
      onEsc,
    }) => {
      // Creamos un id único para el datalist basado en el campo
      const listId = `datalist-${fieldKey}`;

      return (
        <div className="autoField">
          <input
            id={fieldKey}
            list={listId}
            placeholder={label}
            value={value}
            autoFocus
            style={{ "--accent": accent }}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEnter();
              if (e.key === "Escape") onEsc();
            }}
          />
          <datalist id={listId}>
            {lista.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
      );
    };

    const NumInput = ({
      label,
      value,
      onChange,
      min,
      max,
      step = 1,
      accent,
      onEnter,
      onEsc,
    }) => (
      <div className="autoField">
        <input
          type="number"
          placeholder={label}
          value={value}
          min={min}
          max={max}
          step={step}
          style={{ "--accent": accent }}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter();
            if (e.key === "Escape") onEsc();
          }}
        />
      </div>
    );

    const TextArea = ({ label, value, onChange, accent, onEnter, onEsc }) => (
      <div className="autoField">
        <textarea
          rows={3}
          placeholder={label}
          value={value}
          style={{ "--accent": accent }}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl+Enter para confirmar
            if (e.key === "Enter" && e.ctrlKey) onEnter();
            if (e.key === "Escape") onEsc();
          }}
        />
        <small>Ctrl + Enter para confirmar</small>
      </div>
    );

    /* ---------- Ahora asignamos el UI correspondiente a cada paso ---------- */
    const fieldUI = {
      direccion: (
        <AutoInput
          fieldKey="direccion"
          label="Dirección *"
          value={data.direccion}
          lista={clients.map((c) => c.direccion).sort()}
          onChange={(v) => update("direccion", v)}
          {...props}
        />
      ),
      servicio: (
        <AutoInput
          fieldKey="servicio"
          label="Servicio"
          value={data.servicio}
          lista={[
            "Poso",
            "Tuberia",
            "Poso + Tuberia",
            "Poso + Grease Trap",
            "Tuberia + Grease Trap",
            "Grease Trap",
            "Water",
            "Poll",
          ]}
          onChange={(v) => update("servicio", v)}
          {...props}
        
        />
      ),
      cubicos: (
        <NumInput
          label="Cúbicos"
          value={data.cubicos}
          min={1}
          max={50}
          onChange={(v) => update("cubicos", v)}
          accent={accent}
          onEnter={next}
          onEsc={prev}
        />
      ),
      valor: (
        <NumInput
          label="Valor (Afl)"
          value={data.valor}
          step={5}
          onChange={(v) => update("valor", v)}
          accent={accent}
          onEnter={next}
          onEsc={prev}
        />
      ),
      notas: (
        <TextArea
          label="Notas"
          value={data.notas}
          onChange={(v) => update("notas", v)}
          accent={accent}
          onEnter={ok}
          onEsc={prev}
        />
      ),
    }[campo];

    const listo = data.direccion.trim() !== "";

    return (
      <div className="turboCard" style={{ "--accent": accent }}>
        <Progress paso={step} total={campos.length} />
        {fieldUI}
        <div className="turboBtns">
          <button onClick={prev} disabled={step === 0}>
            ←
          </button>
          {step === campos.length - 1 ? (
            <button className="ok" onClick={ok} disabled={!listo}>
              Agendar
            </button>
          ) : (
            <button onClick={next} disabled={!listo}>
              →
            </button>
          )}
        </div>
        <button className="cancel" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    );
  };

  const Progress = ({ paso, total }) => (
    <div className="chips">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={i === paso ? "on" : i < paso ? "done" : ""}
        />
      ))}
    </div>
  );

  return (
    <div className={rootCls}>
      <Slidebar />
      <header className={`aexp-header ${dia ? "withDia" : ""}`}>
        <h1 className="aexp-title">AGENDA EXPRESS</h1>
        {labelDia && <h2 className="aexp-subtitle">AGENDANDO: {labelDia}</h2>}
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
        <WizardForm
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

export default AgendaExpress;
