// src/pages/doctores/DoctorConsentimientosPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FiFileText, FiUser, FiStar, FiCalendar } from "react-icons/fi";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { getCitasByDoctor } from "../../services/citasService";
import { requiereConsentimiento } from "../../utils/clinicRules";

import TableLayout from "../../components/TableLayout";
import "./DoctorConsentimientosPage.css"; // 👈 CSS propio, mismo patrón visual

const DoctorConsentimientosPage = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isDermatologo = user?.role === "DERMATOLOGO";

  const [citasConConsentimiento, setCitasConConsentimiento] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔐 Verificación de sesión (igual patrón que DoctorCitasPage)
  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        const valid = await verifyAuth();
        if (!valid) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
        }
      }
    };

    checkAuth();

    return () => controller.abort();
  }, [navigate, user]);

  // 📥 Cargar citas confirmadas con consentimiento completado
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadConsentimientos = async () => {
      // Si no es dermatólogo o no hay usuario, no cargamos nada
      if (!isDermatologo || !user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await getCitasByDoctor(user.id, {
          estado: "C",
          signal: controller.signal,
        });

        if (!isMounted) return;

        const filtradas = (data || []).filter(
          (cita) =>
            requiereConsentimiento(cita) && cita.consentimiento_completado
        );
        setCitasConConsentimiento(filtradas);
      } catch (err) {
        if (!isMounted || controller.signal.aborted) return;

        console.error("Error cargando consentimientos:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        setError(
          "Error cargando los consentimientos. Intenta de nuevo en unos momentos."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadConsentimientos();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isDermatologo, user?.id, navigate]);

  const formatoFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    if (Number.isNaN(fecha.getTime())) return "-";

    return fecha.toLocaleString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleVerConsentimiento = (citaId) => {
    navigate(`/doctor/consentimientos/${citaId}`);
  };

  const total = citasConConsentimiento.length;

  const data = useMemo(
    () => citasConConsentimiento,
    [citasConConsentimiento]
  );

  // 🔹 Tarjeta de resumen (mismo concepto que en DoctorCitasPage)
  const toolbarSummary = (
    <div className="doctor-consent-summary-card">
      <div className="doctor-consent-count">{total}</div>
      <div className="doctor-consent-label">
        {total === 1 ? "Consentimiento" : "Consentimientos"}
      </div>
    </div>
  );

  // 🔹 Mensaje vacío custom para TableLayout (mismo patrón visual)
  const emptyMessageContent = (
    <div className="consent-empty-state">
      <FiFileText size={48} style={{ opacity: 0.6 }} />
      <h4>No hay consentimientos registrados</h4>
      <p>
        Aún no tienes consentimientos completados por tus pacientes en el
        historial.
      </p>
    </div>
  );

  // 🧱 Columnas para TableLayout (alineadas visualmente al estilo de Citas)
  const columns = [
    {
      id: "paciente",
      label: "Paciente",
      render: (cita) => (
        <div className="d-flex align-items-center gap-2">
          <FiUser size={16} style={{ color: "var(--dc-text-medium)" }} />
          <div>
            {cita.paciente
              ? `${cita.paciente.nombre} ${cita.paciente.apellidos || ""}`
              : "N/A"}
          </div>
        </div>
      ),
    },
    {
      id: "especialidad",
      label: "Especialidad",
      render: (cita) => cita.especialidad?.nombre || "Sin especialidad",
    },
    {
      id: "fecha_cita",
      label: "Fecha de la cita",
      render: (cita) => (
        <div className="d-flex align-items-center gap-2">
          <FiCalendar
            size={14}
            style={{ color: "var(--dc-text-medium)" }}
          />
          <span>{formatoFecha(cita.fecha_hora)}</span>
        </div>
      ),
    },
    {
      id: "acciones",
      label: "Acciones",
      align: "right",
      render: (cita) => (
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={() => handleVerConsentimiento(cita.id)}
        >
          Ver consentimiento
        </button>
      ),
    },
  ];

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Solo Dermatología tiene esta vista de consentimientos
  if (!isDermatologo) {
    return (
      <>
        <Navbar />
        <div className="container my-4">
          <div className="alert alert-warning mb-0">
            Esta sección de consentimientos está disponible únicamente para
            Dermatología.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="doctor-consent-container">
        <div className="doctor-consent-page">
          <div className="doctor-consent-content">
            {/* ====== HEADER PRINCIPAL (mismo estilo que DoctorCitasPage) ====== */}
            <header className="doctor-consent-main-header">
              <div className="doctor-consent-header-content">
                <div className="doctor-consent-header-left">
                  <h1 className="doctor-consent-title">
                    <FiFileText size={28} />
                    Consentimientos informados
                  </h1>
                  <p className="doctor-consent-subtitle">
                    Administra y consulta los consentimientos informados
                    completados por tus pacientes en un entorno limpio y
                    profesional.
                  </p>

                  <div className="doctor-profile-info">
                    <span className="doctor-name-badge">
                      <FiUser size={16} />
                      Dr. {user.nombre} {user.apellidos}
                    </span>
                    <span className="doctor-specialty-badge">
                      <FiStar size={16} />
                      {user.role === "DERMATOLOGO" && "Dermatología"}
                      {user.role === "PODOLOGO" && "Podología"}
                      {user.role === "TAMIZ" && "Medicina General"}
                      {!["DERMATOLOGO", "PODOLOGO", "TAMIZ"].includes(
                        user.role
                      ) && user.role}
                    </span>
                  </div>
                </div>

                <div className="doctor-consent-header-right">
                  {toolbarSummary}
                </div>
              </div>
            </header>

            {/* ====== CARD PRINCIPAL CON TABLELAYOUT ====== */}
            <section className="doctor-consent-main-card">
              <div className="consent-table-content">
                {error ? (
                  <div className="doctor-consent-error">{error}</div>
                ) : (
                  <TableLayout
                    title="Consentimientos informados"
                    columns={columns}
                    data={data}
                    loading={loading}
                    emptyMessage={emptyMessageContent}
                    enableSearch={false}
                    enablePagination={false}
                    striped
                    hover
                    toolbarRight={toolbarSummary}
                    rowKey="id"
                  />
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default DoctorConsentimientosPage;
