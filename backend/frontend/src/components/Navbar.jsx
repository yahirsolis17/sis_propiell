// src/components/Navbar.jsx
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCurrentUser, logout } from "../services/authService";
import { FiLogOut } from "react-icons/fi";
import { toast, ToastContainer } from "react-toastify";

import logo from "../assets/logo.png";
import "./Navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (location.state?.fromLogin) {
      toast.success("¡Inicio de sesión exitoso!", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
        theme: "light",
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleLogout = () => {
    toast.info(
      <div
        style={{
          background: "white",
          padding: "16px",
          borderRadius: "12px",
          boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
          maxWidth: "300px",
          width: "100%",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <p
          style={{
            fontSize: "16px",
            fontWeight: "600",
            color: "#333",
            marginBottom: "12px",
          }}
        >
          ¿Seguro que deseas cerrar sesión?
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              logout();
              toast.dismiss();
              navigate("/login", { replace: true });
            }}
            style={{
              padding: "8px 14px",
              background: "linear-gradient(to right, #0086C9, #007780)",
              color: "white",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0px 2px 5px rgba(0, 0, 0, 0.2)",
              transition: "opacity 0.3s ease-in-out",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.target.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.target.style.opacity = "1")}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => toast.dismiss()}
            style={{
              padding: "8px 14px",
              background: "#e0e0e0",
              color: "#333",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0px 2px 5px rgba(0, 0, 0, 0.2)",
              transition: "background 0.3s ease-in-out",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#d6d6d6")}
            onMouseLeave={(e) => (e.target.style.background = "#e0e0e0")}
          >
            Cancelar
          </button>
        </div>
      </div>,
      {
        position: "top-center",
        autoClose: false,
        closeOnClick: false,
        draggable: false,
      }
    );
  };

  const renderNavLinks = () => {
    if (!user) return null;

    const commonStyles = "hover-underline mx-3 px-2 py-1";
    const role = user?.role?.toUpperCase();
    const roleLower = user?.role?.toLowerCase();
    const dashboardPath = roleLower ? `/dashboard/${roleLower}` : "/dashboard";

    switch (role) {
      case "ADMIN":
        return (
          <>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to={dashboardPath}
            >
              Inicio
            </Link>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/admin/usuarios"
            >
              Usuarios
            </Link>
          </>
        );

      case "PACIENTE":
        return (
          <>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to={dashboardPath}
            >
              Inicio
            </Link>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/citas"
            >
              Registrar cita
            </Link>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/paciente/pagos"
            >
              Pagos y comprobantes
            </Link>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/paciente/recetas"
            >
              Mis recetas
            </Link>

            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/paciente/tratamiento"
            >
              Mi tratamiento
            </Link>
          </>
        );

      // Dermatólogo: flujo completo incluyendo consentimientos
      case "DERMATOLOGO":
        return (
          <>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to={dashboardPath}
            >
              Inicio
            </Link>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/doctor/citas"
            >
              Citas
            </Link>

            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/doctor/pagos"
            >
              Pagos
            </Link>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/doctor/consentimientos"
            >
              Consentimientos
            </Link>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/doctor/recetas"
            >
              Recetas
            </Link>
          </>
        );

      // Podólogo y Tamiz: mismo flujo de citas/pagos/recetas, sin consentimiento
      case "PODOLOGO":
      case "TAMIZ":
        return (
          <>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to={dashboardPath}
            >
              Inicio
            </Link>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/doctor/citas"
            >
              Citas
            </Link>

            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/doctor/pagos"
            >
              Pagos
            </Link>
            <Link
              onClick={closeMenu}
              className={commonStyles}
              to="/doctor/recetas"
            >
              Recetas
            </Link>
          </>
        );

      default:
        return (
          <Link
            onClick={closeMenu}
            className={commonStyles}
            to="/dashboard"
          >
            Inicio
          </Link>
        );
    }
  };

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        pauseOnHover={false}
      />

      <nav className="navbar-glass">
        <div className="nav-container">
          {/* Logo (no redirige, se queda como marca) */}
          <div className="brand-container">
            <img src={logo} alt="Logo" className="logo-hover-effect" />
            <span className="clinic-name">Pro-Piel</span>
          </div>

          {/* Botón hamburguesa (móvil) */}
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </button>

          {/* Menú */}
          <div className={`nav-links-container ${menuOpen ? "open" : ""}`}>
            <div className="nav-links">{renderNavLinks()}</div>

            {user && (
              <button
                type="button"
                className="logout-button"
                onClick={() => {
                  handleLogout();
                  closeMenu();
                }}
              >
                <FiLogOut className="logout-icon" />
                Cerrar Sesión
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;

