// src/pages/doctores/DoctorPacientesPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getCurrentUser, verifyAuth } from "../../services/authService";
import { getPacientes } from "../../services/pacientesService";

import TableLayout from "../../components/TableLayout";
import "./DoctorPacientesPage.css";

const DoctorPacientesPage = () => {
  const navigate = useNavigate();
  const [user] = useState(() => getCurrentUser());

  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isDoctorOrAdmin = ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"].includes(
    user.role
  );

  useEffect(() => {
    if (!isDoctorOrAdmin) {
      setError("No tienes permiso para ver la lista de pacientes.");
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

        const data = await getPacientes(controller.signal);
        if (!isMounted) return;
        setPacientes(data || []);
      } catch (err) {
        if (!controller.signal.aborted && isMounted) {
          console.error("Error al cargar pacientes:", err);
          const detail =
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "Error al cargar la lista de pacientes.";
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
  }, [isDoctorOrAdmin, navigate]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleVerDetalle = (paciente) => {
    if (!paciente?.id) return;

    // Mantengo tu flujo actual: llevar al doctor a la pantalla de reportes
    // filtrados por paciente, con state.
    navigate("/doctor/reportes", {
      state: { from: "doctor-pacientes", paciente },
    });
  };

  // 🔍 Búsqueda en memoria
  const filteredPacientes = useMemo(() => {
    if (!searchTerm.trim()) return pacientes;

    const term = searchTerm.toLowerCase();
    return pacientes.filter((p) => {
      const nombreCompleto = `${p.nombre || ""} ${
        p.apellidos || ""
      }`.toLowerCase();
      const telefono = (p.telefono || "").toLowerCase();
      const edad = (p.edad ?? "").toString().toLowerCase();

      return (
        nombreCompleto.includes(term) ||
        telefono.includes(term) ||
        edad.includes(term)
      );
    });
  }, [pacientes, searchTerm]);

  // Para mantener la columna "#"
  const tableRows = useMemo(
    () =>
      filteredPacientes.map((p, index) => ({
        ...p,
        __rowIndex: index + 1,
      })),
    [filteredPacientes]
  );

  const columns = [
    {
      id: "index",
      label: "#",
      render: (row) => row.__rowIndex,
    },
    {
      id: "nombre_completo",
      label: "Nombre completo",
      render: (row) => `${row.nombre || ""} ${row.apellidos || ""}`.trim(),
    },
    {
      id: "edad",
      label: "Edad",
      render: (row) => row.edad ?? "-",
    },
    {
      id: "sexo",
      label: "Sexo",
      render: (row) => row.sexo || "-",
    },
    {
      id: "telefono",
      label: "Teléfono",
      render: (row) => row.telefono || "-",
    },
    {
      id: "acciones",
      label: "Acciones",
      align: "right",
      render: (row) => (
        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => handleVerDetalle(row)}
          >
            Ver detalle
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Navbar />

      <div className="doctor-pacientes-page">
        <div className="doctor-pacientes-container">
          {/* HEADER */}
          <div className="doctor-pacientes-header">
            <div>
              <h1 className="doctor-pacientes-title">Pacientes</h1>
              <p className="doctor-pacientes-subtitle">
                Lista de pacientes asociados a tus consultas.
              </p>
            </div>

            <div className="doctor-pacientes-search-wrapper">
              <input
                type="text"
                className="form-control doctor-pacientes-search-input"
                placeholder="Buscar por nombre, teléfono o edad..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </div>

          {/* CARD PRINCIPAL + TABLELAYOUT */}
          <div className="doctor-pacientes-card">
            {error ? (
              <div className="alert alert-danger mb-0">{error}</div>
            ) : (
              <TableLayout
                title="Pacientes"
                columns={columns}
                data={tableRows}
                loading={loading}
                emptyMessage="No se encontraron pacientes para mostrar."
                enableSearch={false}     // búsqueda ya se maneja en el header
                enablePagination={false} // todo en memoria por ahora
                dense={false}
                striped={true}
                hover={true}
                rowKey="id"
                onRowClick={handleVerDetalle}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DoctorPacientesPage;
