// src/pages/pacientes/PacientePagosPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { getPagos } from "../../services/pagosService";
import TableLayout from "../../components/TableLayout";
import { formatearFechaHora } from "../../components/clinicFormatters";
import "./PacientePagosPage.css";

const mapMetodoPago = (metodoRaw) => {
  const m = (metodoRaw || "").toString().toUpperCase();
  if (m === "TRANSFERENCIA") return "Transferencia";
  if (m === "CONSULTORIO") return "Pago en consultorio";
  if (m === "EFECTIVO") return "Efectivo";
  if (!m) return "No especificado";
  return m.charAt(0) + m.slice(1).toLowerCase();
};

const mapEstadoPago = (estadoRaw) => {
  const e = (estadoRaw || "").toString().toUpperCase();
  if (e === "PENDIENTE") return "Pendiente";
  if (e === "APROBADO") return "Aprobado";
  if (e === "REVERTIDO") return "Revertido";
  if (e === "RECHAZADO") return "Rechazado";
  if (!e) return "Sin estado";
  return e.charAt(0) + e.slice(1).toLowerCase();
};

const getFechaPagoBase = (pago) =>
  pago.fecha_pago ||
  pago.fecha ||
  pago.creado_en ||
  pago.created_at ||
  pago.actualizado_en ||
  pago.updated_at;

const getCitaLabel = (pago) => {
  const c = pago?.cita;
  if (!c) return "Sin cita asociada";

  if (typeof c === "number") {
    return `Cita #${c}`;
  }

  const id = c.id || c.pk;
  const fecha = c.fecha_hora ? formatearFechaHora(c.fecha_hora) : "";
  const esp = c.especialidad?.nombre || c.especialidad_nombre || "";

  if (fecha || esp) {
    return `${esp ? esp + " · " : ""}${fecha}`;
  }

  if (id) return `Cita #${id}`;
  return "Cita asociada";
};

const formatMoney = (value) => {
  if (value == null) return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  try {
    return n.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });
  } catch {
    return n.toFixed(2);
  }
};

const PacientePagosPage = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const userId = user?.id;

  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFiltro, setLoadingFiltro] = useState(false);
  const [error, setError] = useState("");

  const [estadoFilter, setEstadoFilter] = useState("");
  const [metodoFilter, setMetodoFilter] = useState("");
  const [search, setSearch] = useState("");

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

  // 📥 Cargar pagos del paciente
  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    let isMounted = true;

    const fetchPagos = async () => {
      try {
        setLoading(true);
        setError("");

        const params = { paciente: userId };
        if (estadoFilter) params.estado_pago = estadoFilter;
        if (metodoFilter) params.metodo_pago = metodoFilter;

        const data = await getPagos(params, controller.signal);
        if (!isMounted) return;

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];
        setPagos(list);
      } catch (err) {
        if (!controller.signal.aborted && isMounted) {
          console.error("Error al cargar pagos del paciente:", err);
          const msg =
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "Error al cargar tus pagos. Intenta de nuevo.";
          setError(msg);
        }
      } finally {
        if (!controller.signal.aborted && isMounted) {
          setLoading(false);
          setLoadingFiltro(false);
        }
      }
    };

    fetchPagos();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [userId, estadoFilter, metodoFilter]);

  // 🎯 Micro-feedback visual al escribir búsqueda
  useEffect(() => {
    if (!loading) {
      setLoadingFiltro(true);
      const t = setTimeout(() => setLoadingFiltro(false), 200);
      return () => clearTimeout(t);
    }
  }, [search, loading]);

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  const pagosFiltrados = useMemo(() => {
    if (!Array.isArray(pagos)) return [];

    const q = search.trim().toLowerCase();
    if (!q) return pagos;

    return pagos.filter((pago) => {
      const citaText = getCitaLabel(pago).toLowerCase();
      const metodoText = mapMetodoPago(pago.metodo_pago).toLowerCase();
      const estadoText = mapEstadoPago(pago.estado_pago).toLowerCase();
      const totalText = (pago.total ?? pago.monto ?? "")
        .toString()
        .toLowerCase();

      return (
        citaText.includes(q) ||
        metodoText.includes(q) ||
        estadoText.includes(q) ||
        totalText.includes(q)
      );
    });
  }, [pagos, search]);

  const totalPagos = pagos.length;

  const columns = [
    {
      id: "fecha",
      label: "Fecha",
      render: (pago) => formatearFechaHora(getFechaPagoBase(pago)),
    },
    {
      id: "cita",
      label: "Cita",
      render: (pago) => (
        <span
          className="small text-truncate d-inline-block"
          style={{ maxWidth: 260 }}
        >
          {getCitaLabel(pago)}
        </span>
      ),
    },
    {
      id: "metodo",
      label: "Método",
      render: (pago) => (
        <span className="badge bg-light text-dark">
          {mapMetodoPago(pago.metodo_pago)}
        </span>
      ),
    },
    {
      id: "estado",
      label: "Estado",
      render: (pago) => {
        const e = (pago.estado_pago || "").toString().toUpperCase();
        const label = mapEstadoPago(pago.estado_pago);
        const badgeClass =
          e === "APROBADO"
            ? "bg-success"
            : e === "PENDIENTE"
            ? "bg-warning text-dark"
            : e === "REVERTIDO" || e === "RECHAZADO"
            ? "bg-danger"
            : "bg-secondary";
        return <span className={`badge ${badgeClass}`}>{label}</span>;
      },
    },
    {
      id: "total",
      label: "Monto",
      render: (pago) => (
        <span className="fw-semibold d-block text-end">
          {formatMoney(pago.total ?? pago.monto)}
        </span>
      ),
    },
  ];

  return (
    <>
      <Navbar />

      <div className="paciente-pagos-container">
        <div className="paciente-pagos-page">
          <div className="paciente-pagos-content">
            {/* Header principal con patrón médico */}
            <header className="paciente-pagos-main-header">
              <div className="paciente-pagos-header-content">
                <div className="paciente-pagos-header-left">
                  <h2 className="paciente-pagos-title">Mis pagos</h2>
                  <p className="paciente-pagos-subtitle">
                    Consulta el historial de pagos relacionados con tus citas.
                  </p>
                </div>
                <div className="paciente-pagos-header-right">
                  <div className="pagos-summary-card">
                    <div className="pagos-count">{totalPagos}</div>
                    <div className="pagos-label">Registros</div>
                  </div>
                </div>
              </div>
            </header>

            {/* Card principal con filtros y tabla */}
            <div className="paciente-pagos-main-card">
              {/* Encabezado de la tabla */}
              <div className="pagos-table-header">
                <h3 className="pagos-table-title">Pagos de tus citas</h3>
              </div>

              {/* Filtros */}
              <div className="pagos-filters-container">
                {error && (
                  <div className="alert alert-danger mb-4">{error}</div>
                )}

                <div className="filter-group-row">
                  <div className="filter-group">
                    <label className="filter-label">Estado del pago</label>
                    <select
                      className="form-select"
                      value={estadoFilter}
                      onChange={(e) => setEstadoFilter(e.target.value)}
                    >
                      <option value="">Todos</option>
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="APROBADO">Aprobado</option>
                      <option value="REVERTIDO">Revertido</option>
                      <option value="RECHAZADO">Rechazado</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">Método de pago</label>
                    <select
                      className="form-select"
                      value={metodoFilter}
                      onChange={(e) => setMetodoFilter(e.target.value)}
                    >
                      <option value="">Todos</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="CONSULTORIO">Consultorio</option>
                      <option value="EFECTIVO">Efectivo</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">
                      Buscar (cita / método / estado / monto)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej. dermatología, transferencia, aprobado..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="filter-group">
                    {loadingFiltro && !loading && (
                      <div className="pagos-filtro-loading">
                        Actualizando resultados...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contenido de la tabla */}
              <div className="pagos-table-content">
                <TableLayout
                  title=""
                  columns={columns}
                  data={pagosFiltrados}
                  loading={loading}
                  emptyMessage="No se encontraron pagos con los filtros actuales."
                  enableSearch={false}
                  enablePagination={false}
                  striped={true}
                  hover={true}
                  rowKey="id"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PacientePagosPage;