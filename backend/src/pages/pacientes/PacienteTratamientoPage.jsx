// src/pages/pacientes/PacienteTratamientoPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { getTratamientoActual } from "../../services/tratamientoService";
import { formatearFechaHora } from "../../components/clinicFormatters";
import "./PacienteTratamientoPage.css";

const PacienteTratamientoPage = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const userId = user?.id; // ✅ primitivo estable

  const [tratamiento, setTratamiento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔐 Verificación de autenticación
  useEffect(() => {
    if (!userId) return;

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

    return () => {
      controller.abort();
    };
  }, [userId, navigate]);

  // 📥 Cargar tratamiento actual del paciente autenticado
  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    let isMounted = true;

    const fetchTratamiento = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getTratamientoActual(controller.signal);
        if (!isMounted) return;

        setTratamiento(data || null);
      } catch (err) {
        if (controller.signal.aborted || !isMounted) return;
        console.error("Error cargando tratamiento actual:", err);

        if (err.response?.status === 404) {
          // Sin tratamiento activo
          setTratamiento(null);
        } else if (
          err.response?.data?.detail ||
          err.response?.data?.error
        ) {
          setError(
            err.response.data.detail ||
              err.response.data.error ||
              "Error al cargar la información de tu tratamiento."
          );
        } else {
          setError(
            "Error al cargar la información de tu tratamiento. Intenta de nuevo."
          );
        }
      } finally {
        if (!controller.signal.aborted && isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTratamiento();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [userId]);

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  const getFechaInicio = (t) =>
    t?.fecha_inicio || t?.creado_en || t?.created_at || null;

  const getFechaFin = (t) =>
    t?.fecha_fin || (!t?.activo && (t?.actualizado_en || t?.updated_at)) ||
    null;

  const getNombreTratamiento = (t) =>
    t?.nombre ||
    t?.nombre_tratamiento ||
    t?.descripcion ||
    "Tratamiento dermatológico";

  const getTotalCitas = (t) =>
    t?.total_citas ??
    t?.cantidad_citas ??
    t?.num_citas ??
    t?.citas_count ??
    null;

  const getTotalRecetas = (t) =>
    t?.total_recetas ??
    t?.cantidad_recetas ??
    t?.recetas_count ??
    null;

  const getDoctorNombre = (t) => {
    if (!t) return null;

    // Preferimos los campos calculados del backend
    if (t.doctor_nombre) return t.doctor_nombre;

    const doctor = t.doctor;
    if (!doctor || typeof doctor !== "object") {
      return null;
    }

    const nombreCompleto = `${doctor.nombre || ""} ${
      doctor.apellidos || ""
    }`.trim();

    return nombreCompleto || doctor.username || null;
  };

  const getDoctorEspecialidad = (t) => {
    if (!t) return null;

    if (t.doctor_especialidad) return t.doctor_especialidad;

    const doctor = t.doctor;
    if (!doctor || typeof doctor !== "object") return null;

    return (
      doctor.especialidad?.nombre ||
      doctor.especialidad_nombre ||
      doctor.especialidad ||
      null
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="tratamiento-loading-card">
          <div className="tratamiento-loading-text">
            Cargando información de tu tratamiento...
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="tratamiento-error-card">
          <h5 className="tratamiento-error-title">Error</h5>
          <p className="tratamiento-error-message">{error}</p>
        </div>
      );
    }

    if (!tratamiento) {
      return (
        <div className="tratamiento-empty-card">
          <h5 className="tratamiento-empty-title">Sin tratamiento activo</h5>
          <p className="tratamiento-empty-description">
            Actualmente no tienes un tratamiento activo registrado. Si
            presentas molestias o necesitas seguimiento, agenda una cita
            inicial con tu especialista.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/citas")}
          >
            Agendar cita inicial
          </button>
        </div>
      );
    }

    const fechaInicio = getFechaInicio(tratamiento);
    const fechaFin = getFechaFin(tratamiento);
    const nombreTratamiento = getNombreTratamiento(tratamiento);
    const totalCitas = getTotalCitas(tratamiento);
    const totalRecetas = getTotalRecetas(tratamiento);
    const doctorNombre = getDoctorNombre(tratamiento);
    const doctorEspecialidad = getDoctorEspecialidad(tratamiento);

    return (
      <div className="paciente-tratamiento-main-card">
        <div className="tratamiento-card-body">
          <h5 className="tratamiento-card-title">Resumen de tu tratamiento</h5>
          <p className="tratamiento-card-description">
            Aquí puedes revisar la información más importante de tu
            tratamiento actual.
          </p>

          <dl className="row tratamiento-details mb-0">
            {/* Nombre del tratamiento */}
            <dt className="col-sm-4">Tratamiento</dt>
            <dd className="col-sm-8">
              <strong>{nombreTratamiento}</strong>
            </dd>

            {/* Estado */}
            <dt className="col-sm-4">Estado</dt>
            <dd className="col-sm-8">
              {tratamiento.activo ? (
                <span className="badge bg-success">Activo</span>
              ) : (
                <span className="badge bg-secondary">
                  Finalizado / inactivo
                </span>
              )}
            </dd>

            {/* Médico tratante con chip de especialidad */}
            {doctorNombre && (
              <>
                <dt className="col-sm-4">Médico tratante</dt>
                <dd className="col-sm-8 d-flex flex-wrap align-items-center gap-2">
                  {doctorEspecialidad && (
                    <span className="badge rounded-pill bg-info-subtle text-info">
                      {doctorEspecialidad}
                    </span>
                  )}
                  <span>{doctorNombre}</span>
                </dd>
              </>
            )}

            {/* Inicio de tratamiento */}
            {fechaInicio && (
              <>
                <dt className="col-sm-4">Inicio de tratamiento</dt>
                <dd className="col-sm-8">
                  {formatearFechaHora(fechaInicio)}
                </dd>
              </>
            )}

            {/* Fin / última actualización */}
            {fechaFin && (
              <>
                <dt className="col-sm-4">Última actualización / fin</dt>
                <dd className="col-sm-8">{formatearFechaHora(fechaFin)}</dd>
              </>
            )}

            {/* Cantidad de citas asociadas */}
            {totalCitas != null && (
              <>
                <dt className="col-sm-4">Citas en este tratamiento</dt>
                <dd className="col-sm-8">
                  <span className="badge bg-light text-dark">
                    {totalCitas} cita
                    {totalCitas === 1 ? "" : "s"}
                  </span>
                </dd>
              </>
            )}

            {/* Cantidad de recetas asociadas */}
            {totalRecetas != null && (
              <>
                <dt className="col-sm-4">Recetas emitidas</dt>
                <dd className="col-sm-8">
                  <span className="badge bg-light text-dark">
                    {totalRecetas} receta
                    {totalRecetas === 1 ? "" : "s"}
                  </span>
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>
    );
  };

  return (
    <>
      <Navbar />

      <div className="paciente-tratamiento-container">
        <div className="paciente-tratamiento-page">
          <div className="paciente-tratamiento-content">
            {/* Header principal con patrón médico */}
            <header className="paciente-tratamiento-main-header">
              <div className="paciente-tratamiento-header-content">
                <div className="paciente-tratamiento-header-left">
                  <h2 className="paciente-tratamiento-title">Mi tratamiento</h2>
                  <p className="paciente-tratamiento-subtitle">
                    Visualiza un resumen de tu tratamiento actual y su evolución.
                  </p>
                </div>
                <div className="paciente-tratamiento-header-right">
                  {/* Espacio para posible elemento futuro (ej. icono o badge) */}
                </div>
              </div>
            </header>

            {/* Contenido principal */}
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
};

export default PacienteTratamientoPage;