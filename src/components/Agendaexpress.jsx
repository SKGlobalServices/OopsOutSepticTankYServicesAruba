/* ─────────────────────  AgendaExpress.jsx  ───────────────────── */
import React, { useState, useEffect, useRef, useMemo } from "react";
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

  const rootCls = `agendaEX ${fase === "formulario" ? "fase-form" : ""}`;
  const labelDia = { hoy: "HOY", manana: "MAÑANA", pasado: "PASADO MAÑANA" }[
    dia
  ];

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
      const cli = clients.find((c) => c.direccion === data.direccion);
      if (cli && cli.cubicos != null) {
        setData((d) => ({ ...d, cubicos: cli.cubicos }));
      }
    }, [data.direccion, clients]);

    const campo = campos[step];
    const props = { accent, onEnter: next, onEsc: prev };

    /* ---------- Aquí redefinimos AutoInput, NumInput y TextArea ---------- */
    const AutoInput = ({
      fieldKey,
      label,
      value,
      onChange,
      lista,
      accent,
      onEnter,
      onEsc,
    }) => {
      const [showDropdown, setShowDropdown] = useState(false);
      const filtered = lista.filter((v) =>
        v.toLowerCase().includes(value.toLowerCase())
      );

      return (
        <div className="autoField" style={{ position: "relative" }}>
          <input
            id={fieldKey}
            placeholder={label}
            value={value}
            autoFocus
            style={{ "--accent": accent }}
            onChange={(e) => {
              onChange(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 100)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEnter();
              if (e.key === "Escape") onEsc();
            }}
          />
          {showDropdown && filtered.length > 0 && (
            <ul
              className="dropdown-list"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                maxHeight: "200px",
                overflowY: "auto",
                background: "#222",
                color: "white",
                border: "1px solid var(--accent)",
                zIndex: 9999,
              }}
            >
              {filtered.map((item, i) => (
                <li
                  key={i}
                  style={{
                    padding: "10px",
                    cursor: "pointer",
                    borderBottom: "1px solid #444",
                  }}
                  onMouseDown={() => {
                    onChange(item);
                    onEnter();
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
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
    }) => {
      const inputRef = React.useRef(null);

      useEffect(() => {
        inputRef.current?.focus();
      }, []);

      return (
        <div className="autoField">
          <input
            ref={inputRef}
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
    };

    const TextArea = ({ label, value, onChange, accent, onEnter, onEsc }) => {
      const textAreaRef = React.useRef(null);
      const [hasFocused, setHasFocused] = useState(false);
      const [temp, setTemp] = useState(value);

      useEffect(() => {
        if (!hasFocused) {
          textAreaRef.current?.focus();
          setHasFocused(true);
          // Colocar el cursor al final al iniciar
          textAreaRef.current.selectionStart = textAreaRef.current.value.length;
          textAreaRef.current.selectionEnd = textAreaRef.current.value.length;
        }
      }, [hasFocused]);

      // Cada vez que se actualice `value`, actualizar `temp` también
      useEffect(() => {
        setTemp(value);
      }, [value]);

      const guardarYColocarCursor = () => {
        onChange(temp);

        // Timeout para esperar al render y colocar el cursor al final
        setTimeout(() => {
          if (textAreaRef.current) {
            const length = textAreaRef.current.value.length;
            textAreaRef.current.selectionStart = length;
            textAreaRef.current.selectionEnd = length;
            textAreaRef.current.focus();
          }
        }, 0);
      };

      return (
        <div className="autoField">
          <textarea
            ref={textAreaRef}
            rows={3}
            placeholder={label}
            value={temp}
            style={{ "--accent": accent }}
            onChange={(e) => setTemp(e.target.value)}
            onBlur={guardarYColocarCursor}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                guardarYColocarCursor();
                onEnter();
              }
              if (e.key === "Escape") onEsc();
            }}
          />
          <small>Ctrl + Enter para confirmar</small>
        </div>
      );
    };

    /* ---------- Ahora asignamos el UI correspondiente a cada paso ---------- */
    const fieldUI = useMemo(() => {
      return {
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
              "Pool",
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
    }, [campo, data, clients, accent]); // <- asegúrate de incluir estas dependencias

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
        <span key={i} className={i === paso ? "on" : i < paso ? "done" : ""} />
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
