// src/pages/doctores/DoctorConsentimientoViewer.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { getCitaById } from "../../services/citasService";
import {
  getConsentimientoByCitaId,
  guardarConsentimientoDatosMedico,
  descargarConsentimientoPDF,
} from "../../services/consentimientoService";
import { requiereConsentimiento } from "../../utils/clinicRules";

// CSS del paciente (layout PDF)
import "../pacientes/ConsentimientoPage.css";
// CSS específico del DOCTOR (fondo, container, botones, etc.)
import "./DoctorConsentimientoViewer.css";

import logo from "../../assets/logo.png";
import dermatologiaImg from "../../assets/dermatologia.jpg";

const DoctorConsentimientoViewer = () => {
  const { citaId } = useParams();
  const navigate = useNavigate();

  const [user] = useState(() => getCurrentUser());
  const [cita, setCita] = useState(null);
  const [consentimiento, setConsentimiento] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Campos que el DOCTOR puede llenar
  const [diagnosticoPrincipal, setDiagnosticoPrincipal] = useState("");
  const [procedimientoPropuesto, setProcedimientoPropuesto] = useState("");
  const [beneficios, setBeneficios] = useState("");
  const [riesgos, setRiesgos] = useState("");
  const [alternativas, setAlternativas] = useState("");
  const [testigo1Nombre, setTestigo1Nombre] = useState("");
  const [testigo2Nombre, setTestigo2Nombre] = useState("");

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isDermatologo = user.role === "DERMATOLOGO";

  // Solo Dermatología puede ver el visor de consentimientos
  if (!isDermatologo) {
    return (
      <>
        <Navbar />
        <div className="container my-4">
          <div className="alert alert-warning">
            Solo la especialidad de Dermatología puede acceder a los consentimientos informados.
          </div>
        </div>
      </>
    );
  }

  const formatoFecha = (fechaStr) => {
    if (!fechaStr) return "";
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return "";
    return fecha.toLocaleString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    if (!citaId || !user?.id) {
      setError("No se encontró la cita para este consentimiento.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const init = async () => {
      try {
        const valid = await verifyAuth();
        if (!valid) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        // 1) Traer cita
        const citaData = await getCitaById(citaId, controller.signal);
        if (!isMounted) return;

        const isAdmin = user.role === "ADMIN";
        const isDoctorAsignado =
          citaData?.doctor?.id && citaData.doctor.id === user.id;

        if (!isAdmin && !isDoctorAsignado) {
          setError("No tienes permiso para ver el consentimiento de esta cita.");
          return;
        }

        // La cita debe requerir consentimiento (solo dermatología)
        if (!requiereConsentimiento(citaData)) {
          setError("Esta cita no requiere consentimiento informado.");
          return;
        }

        setCita(citaData);

        // 2) Traer consentimiento del paciente
        let consentimientoData = null;
        try {
          consentimientoData = await getConsentimientoByCitaId(
            citaId,
            controller.signal
          );
        } catch (err) {
          if (err.response?.status === 404) {
            setError(
              "El paciente aún no ha completado el consentimiento para esta cita."
            );
            return;
          }
          throw err;
        }

        if (!isMounted) return;

        setConsentimiento(consentimientoData);

        // Prefill de campos médicos si ya existen en el backend
        if (consentimientoData) {
          setDiagnosticoPrincipal(
            consentimientoData.diagnostico_principal || ""
          );
          setProcedimientoPropuesto(
            consentimientoData.procedimiento_propuesto || ""
          );
          setBeneficios(consentimientoData.beneficios || "");
          setRiesgos(consentimientoData.riesgos || "");
          setAlternativas(consentimientoData.alternativas || "");
          setTestigo1Nombre(consentimientoData.testigo1_nombre || "");
          setTestigo2Nombre(consentimientoData.testigo2_nombre || "");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error(
            "Error cargando datos para el consentimiento del doctor:",
            err
          );
          const detail =
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "Error al cargar la información del consentimiento.";
          setError(detail);
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
  }, [citaId, user?.id, user?.role, navigate]);

  const handleGuardarDatosMedico = async (e) => {
    e.preventDefault();

    if (!cita || !consentimiento) {
      setError(
        "La cita o el consentimiento aún no se han cargado correctamente."
      );
      return;
    }

    try {
      setError("");
      setSaving(true);

      const payload = {
        diagnostico_principal: diagnosticoPrincipal,
        procedimiento_propuesto: procedimientoPropuesto,
        beneficios,
        riesgos,
        alternativas,
        testigo1_nombre: testigo1Nombre,
        testigo2_nombre: testigo2Nombre,
      };

      const updated = await guardarConsentimientoDatosMedico(citaId, payload);

      setConsentimiento((prev) => ({
        ...(prev || {}),
        ...updated,
      }));
    } catch (err) {
      console.error("Error al guardar los datos médicos:", err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        "Ocurrió un error al guardar la información médica.";
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await descargarConsentimientoPDF(citaId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `consentimiento_cita_${citaId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar el PDF del consentimiento:", err);
      setError(
        "No se pudo descargar el PDF del consentimiento (el endpoint devolvió error)."
      );
    }
  };

  // ==== Datos para mostrar en el documento ====
  const nombrePaciente =
    cita?.paciente
      ? `${cita.paciente.nombre} ${cita.paciente.apellidos || ""}`.trim()
      : "";
  const edadPaciente = cita?.paciente?.edad ?? "";
  const sexoPaciente = cita?.paciente?.sexo ?? "";
  const telefonoPaciente =
    cita?.paciente?.telefono ||
    cita?.paciente?.telefono_contacto ||
    cita?.paciente?.telefono_movil ||
    "";

  const tipoTexto =
    cita?.tipo === "S"
      ? "consulta subsecuente"
      : "consulta externa de primera vez";

  const citaFechaTexto = cita?.fecha_hora ? formatoFecha(cita.fecha_hora) : "";
  const [fechaSoloDia, fechaSoloHora] = citaFechaTexto
    ? citaFechaTexto.split(",").map((s) => s.trim())
    : ["", ""];

  const firmaPacienteUrl =
    consentimiento?.firma_paciente_url ||
    consentimiento?.firma_paciente ||
    "";

  return (
    <>
      <Navbar />

      <div className="doctor-cons-viewer-root">
        <div className="doctor-cons-viewer-page">
          <div className="doctor-cons-viewer-inner">
            <div className="cons-page-container">
              <div className="cons-card">
                {loading ? (
                  <div className="loading-spinner">
                    Cargando consentimiento del paciente...
                  </div>
                ) : error ? (
                  <div className="alert alert-danger">{error}</div>
                ) : (
                  <form
                    onSubmit={handleGuardarDatosMedico}
                    className="cons-form"
                  >
                    {/* HEADER TIPO PDF */}
                    <header className="cons-header">
                      <div className="cons-header-logos">
                        <div className="cons-logo-circle cons-logo-main">
                          <img src={logo} alt="Logo PRO-PIEL" />
                        </div>
                        <div className="cons-logo-circle cons-logo-secondary">
                          <img
                            src={dermatologiaImg}
                            alt="Imagen dermatología"
                          />
                        </div>
                      </div>

                      <div className="cons-header-text">
                        <h1 className="cons-clinic-name">PRO-PIEL</h1>
                        <p className="cons-clinic-slogan">
                          “Salud y belleza en cada detalle”
                        </p>
                        <h2 className="cons-main-title">
                          CONSENTIMIENTO INFORMADO
                        </h2>
                        <p className="cons-subtitle">
                          De atención y preinscripción médica dermatológica
                        </p>
                      </div>
                    </header>

                    {/* CUERPO PRINCIPAL */}
                    <section className="cons-body">
                      {/* Bloque visual de datos del paciente (usa el CSS ya definido) */}
                      <div className="patient-info-section">
                        <div className="patient-info-title">
                          Datos del paciente
                        </div>
                        <div className="patient-info-grid">
                          <div className="patient-info-item">
                            <span className="patient-info-label">Paciente</span>
                            <span className="patient-info-value">
                              {nombrePaciente || "-"}
                            </span>
                          </div>
                          <div className="patient-info-item">
                            <span className="patient-info-label">Edad</span>
                            <span className="patient-info-value">
                              {edadPaciente || "-"}
                            </span>
                          </div>
                          <div className="patient-info-item">
                            <span className="patient-info-label">Sexo</span>
                            <span className="patient-info-value">
                              {sexoPaciente || "-"}
                            </span>
                          </div>
                          <div className="patient-info-item">
                            <span className="patient-info-label">
                              Teléfono
                            </span>
                            <span className="patient-info-value">
                              {telefonoPaciente || "-"}
                            </span>
                          </div>
                          <div className="patient-info-item">
                            <span className="patient-info-label">
                              Tipo de consulta
                            </span>
                            <span className="patient-info-value">
                              {tipoTexto || "-"}
                            </span>
                          </div>
                          <div className="patient-info-item">
                            <span className="patient-info-label">Fecha</span>
                            <span className="patient-info-value">
                              {fechaSoloDia || "-"}
                            </span>
                          </div>
                          <div className="patient-info-item">
                            <span className="patient-info-label">Hora</span>
                            <span className="patient-info-value">
                              {fechaSoloHora || "-"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="cons-paragraph">
                        Yo{" "}
                        <span className="cons-field-underline">
                          {nombrePaciente}
                        </span>
                        , autorizo al Dr. Hugo Alarcón Hernández especialista
                        en Dermatología con cédula 0018576 como mi médico
                        tratante de mi (y/o) familia:{" "}
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
                          {telefonoPaciente}
                        </span>{" "}
                        que acudo a {tipoTexto}:{" "}
                        <span className="cons-field-underline">
                          {cita?.tipo === "I" ? "X" : ""}
                        </span>{" "}
                        subsecuente:{" "}
                        <span className="cons-field-underline">
                          {cita?.tipo === "S" ? "X" : ""}
                        </span>{" "}
                        de Dermatología, lo cual manifiesto consciente sin
                        presión y es mi voluntad acudir con él para mi atención
                        médica. Para lo cual me interrogará sobre mi enfermedad
                        y comorbilidades, me explorará el área afectada
                        incluyendo el área genital si fuera necesario, lo cual
                        lo hará siempre con la presencia de la enfermera. Así
                        mismo me solicitará estudios de laboratorio y hasta una
                        biopsia de piel según mi enfermedad, me proporcionará
                        una receta médica en la que indicarán los nombres de los
                        medicamentos, forma de uso y tiempo que debo tomarlos;
                        así mismo, si fuera necesario, mandará una cita
                        subsecuente para valorar la evolución de mi enfermedad.
                        Todo lo anterior apegado a la ética, profesionalismo y
                        responsabilidad y con base en el principio de libertad
                        prescriptiva, de acuerdo a lo establecido en las normas
                        oficiales mexicanas aplicables (Nom 001 y Nom 234).
                      </p>

                      <p className="cons-paragraph">
                        Así mismo tiene la responsabilidad de explicarme sobre
                        el diagnóstico y la forma de tratamiento, la
                        prescripción y algunos de los efectos secundarios que
                        pudieran presentarse durante el tratamiento,
                        aclarándome que derivado del tratamiento pudiera
                        presentarse una reacción alérgica y/o de contacto. Lo
                        cual no es posible saberlo antes de aplicar o tomar el
                        tratamiento; todos los organismos reaccionan de forma
                        diferente y esto lo excluye de cualquier
                        responsabilidad, ya que lo hace con base en su
                        conocimiento y experiencia médica, sin intención de
                        causar daño colateral, para lo cual se señala lo
                        siguiente:
                      </p>

                      {/* BLOQUE EDITABLE PARA EL MÉDICO */}
                      <div className="cons-lines-block">
                        <div className="cons-line-row">
                          <span className="cons-line-label">
                            Diagnóstico principal:
                          </span>
                          <input
                            type="text"
                            className="cons-input-line"
                            value={diagnosticoPrincipal}
                            onChange={(e) =>
                              setDiagnosticoPrincipal(e.target.value)
                            }
                            disabled={saving}
                          />
                        </div>
                        <div className="cons-line-row">
                          <span className="cons-line-label">
                            Procedimiento propuesto:
                          </span>
                          <input
                            type="text"
                            className="cons-input-line"
                            value={procedimientoPropuesto}
                            onChange={(e) =>
                              setProcedimientoPropuesto(e.target.value)
                            }
                            disabled={saving}
                          />
                        </div>
                        <div className="cons-line-row">
                          <span className="cons-line-label">Beneficios:</span>
                          <input
                            type="text"
                            className="cons-input-line"
                            value={beneficios}
                            onChange={(e) => setBeneficios(e.target.value)}
                            disabled={saving}
                          />
                        </div>
                        <div className="cons-line-row">
                          <span className="cons-line-label">
                            Riesgos: reacción a cualquiera de los componentes
                            del tratamiento, otros
                          </span>
                          <input
                            type="text"
                            className="cons-input-line"
                            value={riesgos}
                            onChange={(e) => setRiesgos(e.target.value)}
                            disabled={saving}
                          />
                        </div>
                        <div className="cons-line-row">
                          <span className="cons-line-label">
                            Alternativas de manejo diagnóstico o de tratamiento:
                          </span>
                          <input
                            type="text"
                            className="cons-input-line"
                            value={alternativas}
                            onChange={(e) => setAlternativas(e.target.value)}
                            disabled={saving}
                          />
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
                            value={testigo1Nombre}
                            onChange={(e) =>
                              setTestigo1Nombre(e.target.value)
                            }
                            disabled={saving}
                          />
                        </div>
                        <div className="cons-witness-row">
                          <span className="cons-line-label">
                            Testigo 2: nombre completo
                          </span>
                          <input
                            type="text"
                            className="cons-input-line"
                            value={testigo2Nombre}
                            onChange={(e) =>
                              setTestigo2Nombre(e.target.value)
                            }
                            disabled={saving}
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
                            Nombre del paciente:
                          </span>
                          <span className="cons-field-underline">
                            {nombrePaciente}
                          </span>
                        </div>

                        <p className="firma-help">
                          Firma registrada por el paciente para este
                          consentimiento:
                        </p>

                        <div className="signature-wrapper">
                          {firmaPacienteUrl ? (
                            <img
                              src={firmaPacienteUrl}
                              alt="Firma del paciente"
                              style={{
                                maxWidth: "100%",
                                maxHeight: "200px",
                                objectFit: "contain",
                                display: "block",
                                margin: "0 auto",
                              }}
                            />
                          ) : (
                            <p className="text-muted small m-2">
                              No hay firma registrada para este
                              consentimiento.
                            </p>
                          )}
                        </div>

                        <div className="signature-actions">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => navigate(-1)}
                            disabled={saving}
                          >
                            Volver al listado
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                          >
                            {saving
                              ? "Guardando información..."
                              : "Guardar información médica"}
                          </button>
                          <button
                            type="button"
                            className="btn-payment-submit"
                            onClick={handleDownloadPdf}
                            disabled={saving}
                          >
                            Descargar PDF
                          </button>
                        </div>

                        {error && (
                          <div className="alert alert-danger mt-3">
                            {error}
                          </div>
                        )}
                      </div>
                    </section>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DoctorConsentimientoViewer;
