// src/components/dashboards/AdminDashboard.jsx
import React, { useState } from "react";
import { animated } from "@react-spring/web";
import { useNavigate } from "react-router-dom";
import { FiUsers } from "react-icons/fi";

import { getCurrentUser } from "../../services/authService";

const AdminDashboard = ({ cardAnimation }) => {
  const [user] = useState(() => getCurrentUser());
  const navigate = useNavigate();

  const nombre =
    (user && (user.nombre || user.username)) || "Administrador del sistema";

  const cardBaseStyle = {
    borderRadius: "16px",
    cursor: "pointer",
    transition: "transform 0.12s ease, box-shadow 0.12s ease",
  };

  const handleNavigateUsuarios = () => {
    navigate("/admin/usuarios");
  };

  return (
    <animated.div style={cardAnimation} className="dashboard-card">
      {/* HEADER */}
      <header className="mb-4">
        <h3 className="mb-1">Panel Administrativo</h3>
        <p className="text-muted mb-0">
          Hola <strong>{nombre}</strong>, gestiona cuentas de especialistas y pacientes.
        </p>
      </header>

      {/* Tarjeta de gestión de usuarios */}
      <div className="row g-3">
        <div className="col-12">
          <div
            className="card shadow-sm h-100 admin-card"
            style={cardBaseStyle}
            onClick={handleNavigateUsuarios}
          >
            <div className="card-body d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h5 className="card-title mb-0">Gestión de usuarios</h5>
                <FiUsers size={22} />
              </div>
              <p className="card-text text-muted mb-3">
                Crea, edita y desactiva cuentas de especialistas y pacientes.
              </p>
              <button
                type="button"
                className="admin-users-btn btn-sm align-self-start"
              >
                Abrir módulo
              </button>
            </div>
          </div>
        </div>
      </div>
    </animated.div>
  );
};

export default AdminDashboard;
