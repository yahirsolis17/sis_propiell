// src/pages/admin/AdminCitasPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import {
  getCitasAdmin,
  getEspecialidades,
  confirmarCita,
  cancelarCitaAdmin,
  reprogramarCita,
} from "../../services/adminCitasService";
import TableLayout from "../../components/TableLayout";

import "./Citas.css"; // reutiliza estilos clínicos si ya los tienes

const mapEstadoBadge = (estadoCodigo) => {
  switch (estadoCodigo) {
    case "P":
      return { label: "Pendiente", className: "badge badge-pendiente" };
    case "C":
      return { label: "Confirmada", className: "badge badge-confirmada" };
    case "X":
      return { label: "Cancelada", className: "badge badge-cancelada" };
    default:
      return { label: estadoCodigo || "-", className: "badge" };
  }
};

const formatDateTime = (fechaStr) => {
  if (!fechaStr) return "-";
  const d = new Date(fechaStr);
  if (Number.isNaN(d.getTime())) return fechaStr;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const AdminCitasPage = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [cargando, setCargando] = useState(false);
  const [citas, setCitas] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);

  const [filtros, setFiltros] = useState({
    estado: "TODAS",
    especialidad: "",
    paciente: "",
    doctor: "",
    fechaDesde: "",
    fechaHasta: "",
  });

  const [reprogramandoId, setReprogramandoId] = useState(null);
  const [nuevaFechaHora, setNuevaFechaHora] = useState("");

  // ========================
  //  Auth + rol
  // ========================
  useEffect(() => {
    let abort = new AbortController();

    const checkAuth = async () => {
      try {
        await verifyAuth(abort.signal);
        const current = await getCurrentUser();
        setUser(current);
      } catch (error) {
        console.error("Error verificando auth:", error);
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();

    return () => {
      abort.abort();
    };
  }, []);

  const isAdmin = user && user.role === "ADMIN";

  if (authChecked && (!user || !isAdmin)) {
    // Si no es admin, lo mandamos fuera
    return <Navigate to="/login" replace />;
  }

  // ========================
  //  Cargar catálogos
  // ========================
  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();

    const fetchEspecialidades = async () => {
      try {
        const data = await getEspecialidades(controller.signal);
        setEspecialidades(data || []);
      } catch (error) {
        console.error("Error cargando especialidades:", error);
        toast.error("Error al cargar especialidades");
      }
    };

    fetchEspecialidades();

    return () => controller.abort();
  }, [isAdmin]);

  // ========================
  //  Fetch de citas
  // ========================
  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();

    const fetchCitas = async () => {
      setCargando(true);
      try {
        const params = {};

        if (filtros.estado && filtros.estado !== "TODAS") {
          params.estado = filtros.estado;
        }
        if (filtros.especialidad) {
          params.especialidad = filtros.especialidad;
        }
        if (filtros.paciente) {
          params.paciente = filtros.paciente;
        }
        if (filtros.doctor) {
          params.doctor = filtros.doctor;
        }
        if (filtros.fechaDesde) {
          params.fecha_desde = filtros.fechaDesde;
        }
        if (filtros.fechaHasta) {
          params.fecha_hasta = filtros.fechaHasta;
        }

        const data = await getCitasAdmin(params, controller.signal);
        setCitas(Array.isArray(data) ? data : data.results || []);
      } catch (error) {
        if (error.name === "CanceledError") return;
        console.error("Error cargando citas:", error);
        toast.error("Error al cargar citas");
      } finally {
        setCargando(false);
      }
    };

    fetchCitas();

    return () => controller.abort();
  }, [isAdmin, filtros]);

  // ========================
  //  Handlers de filtros
  // ========================

  const handleChangeFiltro = (e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResetFiltros = () => {
    setFiltros({
      estado: "TODAS",
      especialidad: "",
      paciente: "",
      doctor: "",
      fechaDesde: "",
      fechaHasta: "",
    });
  };

  // ========================
  //  Acciones sobre citas
  // ========================

  const handleConfirmar = async (cita) => {
    try {
      await confirmarCita(cita.id, "confirmar");
      toast.success("Cita confirmada correctamente");
      // Refetch
      setFiltros((prev) => ({ ...prev })); // disparar useEffect
    } catch (error) {
      console.error("Error confirmando cita:", error);
      toast.error("No se pudo confirmar la cita");
    }
  };

  const handleCancelar = async (cita) => {
    try {
      await cancelarCitaAdmin(cita.id);
      toast.success("Cita cancelada correctamente");
      setFiltros((prev) => ({ ...prev }));
    } catch (error) {
      console.error("Error cancelando cita:", error);
      toast.error("No se pudo cancelar la cita");
    }
  };

  const handleOpenReprogramar = (cita) => {
    setReprogramandoId(cita.id);
    setNuevaFechaHora("");
  };

  const handleCloseReprogramar = () => {
    setReprogramandoId(null);
    setNuevaFechaHora("");
  };

  const handleReprogramarSubmit = async (e) => {
    e.preventDefault();
    if (!reprogramandoId || !nuevaFechaHora) return;

    // datetime-local → "YYYY-MM-DDTHH:mm"
    const iso = new Date(nuevaFechaHora).toISOString();

    try {
      await reprogramarCita(reprogramandoId, { fecha_hora: iso });
      toast.success("Cita reprogramada correctamente");
      handleCloseReprogramar();
      setFiltros((prev) => ({ ...prev }));
    } catch (error) {
      console.error("Error reprogramando cita:", error);
      toast.error(
        error?.response?.data?.detail ||
          "No se pudo reprogramar la cita. Verifique fecha/hora."
      );
    }
  };

  // ========================
  //  Definición de columnas (TableLayout)
  // ========================

  const columns = useMemo(
    () => [
      {
        id: "paciente",
        label: "Paciente",
        render: (row) =>
          row.paciente
            ? `${row.paciente.nombre} ${row.paciente.apellidos}`
            : "-",
      },
      {
        id: "doctor",
        label: "Doctor",
        render: (row) =>
          row.doctor ? `${row.doctor.nombre} ${row.doctor.apellidos}` : "-",
      },
      {
        id: "especialidad",
        label: "Especialidad",
        render: (row) => row.especialidad?.nombre || "-",
      },
      {
        id: "fecha_hora",
        label: "Fecha / Hora",
        render: (row) => formatDateTime(row.fecha_hora),
      },
      {
        id: "estado",
        label: "Estado",
        render: (row) => {
          const { label, className } = mapEstadoBadge(row.estado_codigo);
          return <span className={className}>{label}</span>;
        },
      },
      {
        id: "pago",
        label: "Pago",
        render: (row) => {
          if (!row.pagos || row.pagos.length === 0) {
            return "Sin pago";
          }
          const pago = row.pagos[0];
          return pago.estado_pago_display || "Registrado";
        },
      },
      {
        id: "consentimiento",
        label: "Consentimiento",
        render: (row) => {
          if (!row.requiere_consentimiento) return "No requerido";
          return row.consentimiento_completado ? "Completado" : "Pendiente";
        },
      },
      {
        id: "tratamiento",
        label: "Tratamiento",
        render: (row) => {
          if (!row.tratamiento) return "Sin tratamiento";
          return row.tratamiento.activo ? "Activo" : "Finalizado";
        },
      },
      {
        id: "atendida",
        label: "Atendida",
        render: (row) => (row.atendida ? "Sí" : "No"),
      },
      {
        id: "acciones",
        label: "Acciones",
        render: (row) => {
          const puedeConfirmar = row.estado_codigo === "P";
          const puedeCancelar = row.estado_codigo === "P" || row.estado_codigo === "C";
          const puedeReprogramar =
            row.estado_codigo !== "X" && !row.atendida; // backend seguirá validando

          return (
            <div className="citas-acciones">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!puedeConfirmar}
                onClick={() => handleConfirmar(row)}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={!puedeCancelar}
                onClick={() => handleCancelar(row)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={!puedeReprogramar}
                onClick={() => handleOpenReprogramar(row)}
              >
                Reprogramar
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  const toolbarRight = (
    <div className="citas-filtros">
      {/* Estado */}
      <div className="filtro-item">
        <label>Estado</label>
        <select
          name="estado"
          value={filtros.estado}
          onChange={handleChangeFiltro}
        >
          <option value="TODAS">Todas</option>
          <option value="P">Pendientes</option>
          <option value="C">Confirmadas</option>
          <option value="X">Canceladas</option>
        </select>
      </div>

      {/* Especialidad */}
      <div className="filtro-item">
        <label>Especialidad</label>
        <select
          name="especialidad"
          value={filtros.especialidad}
          onChange={handleChangeFiltro}
        >
          <option value="">Todas</option>
          {especialidades.map((esp) => (
            <option key={esp.id} value={esp.id}>
              {esp.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Doctor / Paciente opcionales (por id) */}
      <div className="filtro-item">
        <label>ID Paciente</label>
        <input
          type="text"
          name="paciente"
          value={filtros.paciente}
          onChange={handleChangeFiltro}
          placeholder="ID paciente"
        />
      </div>

      <div className="filtro-item">
        <label>ID Doctor</label>
        <input
          type="text"
          name="doctor"
          value={filtros.doctor}
          onChange={handleChangeFiltro}
          placeholder="ID doctor"
        />
      </div>

      {/* Rango de fechas */}
      <div className="filtro-item">
        <label>Desde</label>
        <input
          type="date"
          name="fechaDesde"
          value={filtros.fechaDesde}
          onChange={handleChangeFiltro}
        />
      </div>
      <div className="filtro-item">
        <label>Hasta</label>
        <input
          type="date"
          name="fechaHasta"
          value={filtros.fechaHasta}
          onChange={handleChangeFiltro}
        />
      </div>

      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={handleResetFiltros}
      >
        Limpiar filtros
      </button>
    </div>
  );

  // ========================
  //  Render
  // ========================

  return (
    <>
      <Navbar />
      <div className="citas-container">
        <div className="citas-header">
          <h1>Panel de Citas (Admin)</h1>
          <p className="citas-subtitle">
            Gestiona todas las citas de la clínica: confirma, cancela o
            reprograma según sea necesario.
          </p>
        </div>

        <TableLayout
          title="Listado de citas"
          data={citas}
          loading={cargando}
          columns={columns}
          toolbarRight={toolbarRight}
          emptyMessage="No hay citas con los filtros seleccionados."
        />

        {/* Modal simple para reprogramar */}
        {reprogramandoId && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Reprogramar cita</h2>
              <form onSubmit={handleReprogramarSubmit}>
                <div className="form-group">
                  <label>Nueva fecha y hora</label>
                  <input
                    type="datetime-local"
                    value={nuevaFechaHora}
                    onChange={(e) => setNuevaFechaHora(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseReprogramar}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminCitasPage;
