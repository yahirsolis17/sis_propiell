// src/pages/doctores/DoctorPagosPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { getPagosByDoctor } from "../../services/doctorService";

import TableLayout from "../../components/TableLayout";
import "./DoctorPagosPage.css";

const DoctorPagosPage = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  // 🔒 Si no hay usuario -> al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtro rápido: TODOS | VERIFICADOS | PENDIENTES
  const [filtroVerificado, setFiltroVerificado] = useState("TODOS");

  // ✅ Protección por JWT
  useEffect(() => {
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
  }, [navigate]);

  // 📥 Cargar pagos del doctor
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadPagos = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getPagosByDoctor(user.id, controller.signal);

        if (!isMounted) return;
        setPagos(data || []);
      } catch (err) {
        if (!isMounted || controller.signal.aborted) return;

        console.error("Error cargando pagos del doctor:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          navigate("/login", { replace: true });
          return;
        }

        setError(
          "Error cargando los pagos. Intenta de nuevo en unos momentos."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPagos();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [user.id, navigate]);

  const formatoFecha = (fechaStr) => {
    if (!fechaStr) return "-";
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

  // 🎯 Filtro en memoria por verificado / pendiente
  const pagosFiltrados = useMemo(
    () =>
      pagos.filter((pago) => {
        if (filtroVerificado === "TODOS") return true;
        if (filtroVerificado === "VERIFICADOS") return !!pago.verificado;
        if (filtroVerificado === "PENDIENTES") return !pago.verificado;
        return true;
      }),
    [pagos, filtroVerificado]
  );

  const totalPagos = pagosFiltrados.length;

  // 🧱 Definición de columnas para TableLayout
  const columns = [
    {
      id: "paciente",
      label: "Paciente",
      render: (pago) => {
        const paciente = pago.cita?.paciente || pago.paciente || null;

        const nombrePaciente = paciente
          ? `${paciente.nombre} ${paciente.apellidos || ""}`
          : "N/A";

        return nombrePaciente;
      },
    },
    {
      id: "fecha_cita",
      label: "Fecha cita",
      render: (pago) =>
        pago.cita?.fecha_hora ? formatoFecha(pago.cita.fecha_hora) : "-",
    },
    {
      id: "fecha_pago",
      label: "Fecha pago",
      render: (pago) => (pago.fecha ? formatoFecha(pago.fecha) : "-"),
    },
    {
      id: "total",
      label: "Total",
      render: (pago) =>
        typeof pago.total === "number" || typeof pago.total === "string"
          ? `$${pago.total}`
          : "-",
    },
    {
      id: "pagado",
      label: "Pagado",
      render: (pago) =>
        typeof pago.pagado === "number" || typeof pago.pagado === "string"
          ? `$${pago.pagado}`
          : "-",
    },
    {
      id: "estado",
      label: "Estado",
      render: (pago) =>
        pago.verificado ? (
          <span className="badge bg-success">Verificado</span>
        ) : (
          <span className="badge bg-warning text-dark">Pendiente</span>
        ),
    },
    {
      id: "comprobante",
      label: "Comprobante",
      render: (pago) =>
        pago.comprobante ? (
          <a
            href={pago.comprobante}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline-primary"
          >
            Ver comprobante
          </a>
        ) : (
          <span className="text-muted small">Sin comprobante</span>
        ),
    },
  ];

  return (
    <>
      <Navbar />

      <div className="doctor-pagos-page">
        <div className="doctor-pagos-wrapper">
          {/* HEADER */}
          <header className="doctor-pagos-header">
            <div className="doctor-pagos-header-left">
              <h1 className="doctor-pagos-title">Pagos de pacientes</h1>
              <p className="doctor-pagos-subtitle">
                {user.nombre} {user.apellidos} ·{" "}
                <span className="doctor-role-pill">
                  {user.role === "DERMATOLOGO" && "Dermatólogo"}
                  {user.role === "PODOLOGO" && "Podólogo"}
                  {user.role === "TAMIZ" && "Tamiz"}
                  {!["DERMATOLOGO", "PODOLOGO", "TAMIZ"].includes(user.role) &&
                    user.role}
                </span>
              </p>
            </div>
            <div className="doctor-pagos-header-right">
              <span className="doctor-pagos-badge-count">
                Registros: <strong>{totalPagos}</strong> pago
                {totalPagos === 1 ? "" : "s"}
              </span>
            </div>
          </header>

          {/* CARD PRINCIPAL */}
          <section className="doctor-citas-card">
            {/* Filtro de verificación */}
            <div className="doctor-estado-filters">
              <span className="doctor-estado-label">Filtrar por estado:</span>
              <div className="doctor-estado-buttons">
                {[
                  { label: "Todos", value: "TODOS" },
                  { label: "Verificados", value: "VERIFICADOS" },
                  { label: "Pendientes", value: "PENDIENTES" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`doctor-estado-btn ${
                      filtroVerificado === opt.value
                        ? "doctor-estado-btn-active"
                        : "doctor-estado-btn-outline"
                    }`}
                    onClick={() => setFiltroVerificado(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ESTADOS: error / tabla */}
            {error ? (
              <div className="doctor-citas-error">{error}</div>
            ) : (
              <TableLayout
                title="Pagos de pacientes"
                columns={columns}
                data={pagosFiltrados}
                loading={loading}
                emptyMessage="No hay pagos registrados con este filtro."
                enableSearch={false}
                enablePagination={false}
                dense={false}
                striped={true}
                hover={true}
                rowKey="id"
              />
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default DoctorPagosPage;
