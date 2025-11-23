// src/pages/ConsentimientoPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getCurrentUser, verifyAuth } from "../services/authService";
import { getCitaById, saveConsentimiento } from "../services/citasService";
import "./ConsentimientoPage.css";

// Ajusta las rutas de los assets si en tu proyecto están en otra carpeta
import logo from "../assets/logo.png";
import dermatologiaImg from "../assets/dermatologia.jpg";

const ConsentimientoPage = () => {
  const { citaId } = useParams();
  const navigate = useNavigate();

  // Congelamos el usuario
  const [user] = useState(() => getCurrentUser());

  const [cita, setCita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [firmaDataURL, setFirmaDataURL] = useState(null);

  const [testigo1, setTestigo1] = useState("");
  const [testigo2, setTestigo2] = useState("");

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Helper: convertir dataURL de canvas a Blob (PNG)
  const dataURLToBlob = (dataURL) => {
    const [header, base64] = dataURL.split(",");
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";

    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  };

  // Cargar cita + validar flujo
  useEffect(() => {
    if (!citaId || !user?.id) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const init = async () => {
      try {
        const valid = await verifyAuth(controller.signal);
        if (!valid) {
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }

        const data = await getCitaById(citaId, controller.signal);
        if (!isMounted) return;

        // La cita debe pertenecer al paciente autenticado
        if (data?.paciente?.id !== user.id) {
          setError("No tienes permiso para acceder a este consentimiento.");
          return;
        }

        // Debe estar confirmada por el médico
        if (data.estado !== "Confirmada") {
          setError(
            "Solo puedes completar el consentimiento cuando la cita está confirmada por el médico."
          );
          return;
        }

        // Si ya está completado, no mostramos el formulario
        if (data.consentimiento_completado) {
          setError("El consentimiento para esta cita ya fue completado.");
          return;
        }

        setCita(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Error cargando cita:", err);
          setError("Error al cargar la información de la cita.");
        }
      } finally {
        if (!controller.signal.aborted && isMounted) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [citaId, user?.id, navigate]);

  // Config básica del canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Posición del puntero CORREGIDA con escala (para que dibuje en la punta del mouse/dedo)
  const getCanvasPos = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const e = event.touches ? event.touches[0] : event;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (event) => {
    const pos = getCanvasPos(event);
    isDrawingRef.current = true;
    lastPointRef.current = pos;
  };

  const handlePointerMove = (event) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getCanvasPos(event);

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPointRef.current = pos;
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    if (canvas) {
      const dataURL = canvas.toDataURL("image/png");
      setFirmaDataURL(dataURL);
    }
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaDataURL(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!firmaDataURL) {
      setError("Por favor, dibuja tu firma antes de continuar.");
      return;
    }

    if (!cita) {
      setError("La cita aún no se ha cargado correctamente.");
      return;
    }

    try {
      setError("");
      setSubmitting(true);

      const blob = dataURLToBlob(firmaDataURL);
      const formData = new FormData();
      formData.append("firma_paciente", blob, `firma_cita_${citaId}.png`);

      if (testigo1.trim()) {
        formData.append("testigo1_nombre", testigo1.trim());
      }
      if (testigo2.trim()) {
        formData.append("testigo2_nombre", testigo2.trim());
      }

      await saveConsentimiento(citaId, formData);

      navigate("/dashboard/paciente");
    } catch (err) {
      console.error("Error al guardar el consentimiento:", err);
      const detail =
        err.response?.data?.detail ||
        "Ocurrió un error al guardar el consentimiento.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const formatoFecha = (fechaStr) => {
    if (!fechaStr) return "";
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const nombreCompleto = `${user.nombre} ${user.apellidos}`;
  const tipoTexto =
    cita?.tipo === "S" ? "consulta subsecuente" : "consulta externa de primera vez";

  // Estos datos salen de la cita (porque el user en localStorage no trae edad/sexo)
  const edadPaciente = cita?.paciente?.edad ?? "";
  const sexoPaciente = cita?.paciente?.sexo ?? "";
  const fechaTexto = formatoFecha(cita?.fecha_hora);
  const [fechaSoloDia, fechaSoloHora] = fechaTexto.split(",");

  return (
    <>
      <Navbar />
      <div className="cons-page-container" style={{ paddingTop: "100px" }}>
        <div className="cons-card">
          {loading ? (
            <div className="loading-spinner">Cargando consentimiento...</div>
          ) : error ? (
            <div className="alert alert-danger">{error}</div>
          ) : (
            <form onSubmit={handleSubmit} className="cons-form">
              {/* HEADER TIPO PDF */}
              <header className="cons-header">
                <div className="cons-header-logos">
                  <div className="cons-logo-circle cons-logo-main">
                    <img src={logo} alt="Logo PRO-PIEL" />
                  </div>
                  <div className="cons-logo-circle cons-logo-secondary">
                    <img src={dermatologiaImg} alt="Imagen dermatología" />
                  </div>
                </div>

                <div className="cons-header-text">
                  <h1 className="cons-clinic-name">PRO-PIEL</h1>
                  <p className="cons-clinic-slogan">
                    “Salud y belleza en cada detalle”
                  </p>
                  <h2 className="cons-main-title">CONSENTIMIENTO INFORMADO</h2>
                  <p className="cons-subtitle">
                    De atención y preinscripción médica dermatológica
                  </p>
                </div>
              </header>

              {/* CUERPO PRINCIPAL */}
              <section className="cons-body">
                <p className="cons-paragraph">
                  Yo{" "}
                  <span className="cons-field-underline">
                    {nombreCompleto}
                  </span>
                  , autorizo al Dr. Hugo Alarcón Hernández especialista en
                  Dermatología con cédula 0018576 como mi médico tratante de mi
                  (y/o) familia:{" "}
                  <span className="cons-field-underline cons-field-empty">
                    {/* campo manual para familia */}
                  </span>{" "}
                  edad:{" "}
                  <span className="cons-field-underline">
                    {edadPaciente}
                  </span>{" "}
                  sexo:{" "}
                  <span className="cons-field-underline">
                    {sexoPaciente}
                  </span>{" "}
                  número de teléfono:{" "}
                  <span className="cons-field-underline">
                    {user.telefono}
                  </span>{" "}
                  que acudo a consulta externa de primera vez:{" "}
                  <span className="cons-field-underline">
                    {cita?.tipo === "I" ? "X" : ""}
                  </span>{" "}
                  subsecuente:{" "}
                  <span className="cons-field-underline">
                    {cita?.tipo === "S" ? "X" : ""}
                  </span>{" "}
                  de Dermatología, lo cual manifiesto consciente sin presión y es
                  mi voluntad acudir con él para mi atención médica. Para lo
                  cual me interrogará sobre mi enfermedad y comorbilidades, me
                  explorará el área afectada incluyendo el área genital si fuera
                  necesario, lo cual lo hará siempre con la presencia de la
                  enfermera. Así mismo me solicitará estudios de laboratorio y
                  hasta una biopsia de piel según mi enfermedad, me
                  proporcionará una receta médica en la que indicarán los
                  nombres de los medicamentos, forma de uso y tiempo que debo
                  tomarlos; así mismo, si fuera necesario, mandará una cita
                  subsecuente para valorar la evolución de mi enfermedad. Todo
                  lo anterior apegado a la ética, profesionalismo y
                  responsabilidad y con base en el principio de libertad
                  prescriptiva, de acuerdo a lo establecido en las normas
                  oficiales mexicanas aplicables (Nom 001 y Nom 234).
                </p>

                <p className="cons-paragraph">
                  Así mismo tiene la responsabilidad de explicarme sobre el
                  diagnóstico y la forma de tratamiento, la prescripción y
                  algunos de los efectos secundarios que pudieran presentarse
                  durante el tratamiento, aclarándome que derivado del
                  tratamiento pudiera presentarse una reacción alérgica y/o de
                  contacto. Lo cual no es posible saberlo antes de aplicar o
                  tomar el tratamiento; todos los organismos reaccionan de forma
                  diferente y esto lo excluye de cualquier responsabilidad, ya
                  que lo hace con base en su conocimiento y experiencia médica,
                  sin intención de causar daño colateral, para lo cual se señala
                  lo siguiente:
                </p>

                {/* LÍNEAS PARA SER LLENADAS POR EL MÉDICO (solo visual aquí) */}
                <div className="cons-lines-block">
                  <div className="cons-line-row">
                    <span className="cons-line-label">
                      Diagnóstico principal:
                    </span>
                    <span className="cons-line" />
                  </div>
                  <div className="cons-line-row">
                    <span className="cons-line-label">
                      Procedimiento propuesto:
                    </span>
                    <span className="cons-line" />
                  </div>
                  <div className="cons-line-row">
                    <span className="cons-line-label">Beneficios:</span>
                    <span className="cons-line" />
                  </div>
                  <div className="cons-line-row">
                    <span className="cons-line-label">
                      Riesgos: reacción a cualquiera de los componentes del
                      tratamiento, otros
                    </span>
                    <span className="cons-line" />
                  </div>
                  <div className="cons-line-row">
                    <span className="cons-line-label">
                      Alternativas de manejo diagnóstico o de tratamiento:
                    </span>
                    <span className="cons-line" />
                  </div>
                </div>

                {/* TESTIGOS */}
                <div className="cons-witnesses">
                  <div className="cons-witness-row">
                    <span className="cons-line-label">
                      Testigo 1: nombre completo
                    </span>
                    <input
                      type="text"
                      className="cons-input-line"
                      value={testigo1}
                      onChange={(e) => setTestigo1(e.target.value)}
                      placeholder="Opcional"
                      disabled={submitting}
                    />
                  </div>
                  <div className="cons-witness-row">
                    <span className="cons-line-label">
                      Testigo 2: nombre completo
                    </span>
                    <input
                      type="text"
                      className="cons-input-line"
                      value={testigo2}
                      onChange={(e) => setTestigo2(e.target.value)}
                      placeholder="Opcional"
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* LUGAR / FECHA / HORA */}
                <div className="cons-footer-meta">
                  <div className="cons-meta-row">
                    <span className="cons-line-label">Lugar:</span>
                    <span className="cons-field-underline">
                      Zihuatanejo, Guerrero
                    </span>
                    <span className="cons-line-label cons-meta-spacer">
                      Fecha:
                    </span>
                    <span className="cons-field-underline">
                      {fechaSoloDia || ""}
                    </span>
                    <span className="cons-line-label cons-meta-spacer">
                      Hora:
                    </span>
                    <span className="cons-field-underline">
                      {fechaSoloHora || ""}
                    </span>
                  </div>
                </div>

                {/* NOMBRE + FIRMA DEL PACIENTE */}
                <div className="firma-section">
                  <div className="firma-name-row">
                    <span className="cons-line-label">
                      Nombre y firma del paciente:
                    </span>
                    <span className="cons-field-underline">
                      {nombreCompleto}
                    </span>
                  </div>

                  <p className="firma-help">
                    Firma dentro del recuadro. Puedes usar mouse, touchpad o
                    dedo (en celular/tablet).
                  </p>

                  <div className="signature-wrapper">
                    <canvas
                      ref={canvasRef}
                      className="signature-canvas"
                      width={600}
                      height={200}
                      onMouseDown={handlePointerDown}
                      onMouseMove={handlePointerMove}
                      onMouseUp={handlePointerUp}
                      onMouseLeave={handlePointerUp}
                      onTouchStart={handlePointerDown}
                      onTouchMove={handlePointerMove}
                      onTouchEnd={handlePointerUp}
                    />
                  </div>

                  <div className="signature-actions">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleClearSignature}
                      disabled={submitting}
                    >
                      Limpiar firma
                    </button>
                    <button
                      type="submit"
                      className="btn-payment-submit"
                      disabled={submitting || !firmaDataURL}
                    >
                      {submitting
                        ? "Enviando consentimiento..."
                        : "Finalizar consentimiento"}
                    </button>
                  </div>
                </div>
              </section>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ConsentimientoPage;
