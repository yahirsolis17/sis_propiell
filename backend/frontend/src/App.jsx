// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

// 🔹 Páginas PACIENTE
import Citas from "./pages/pacientes/Citas";
import PaymentPage from "./pages/pacientes/PaymentPage";
import ConsentimientoPage from "./pages/pacientes/ConsentimientoPage";
import ReportesPacientePage from "./pages/pacientes/ReportesPacientePage";
import RecetasPacientePage from "./pages/pacientes/RecetasPacientePage";
import PacientePagosPage from "./pages/pacientes/PacientePagosPage";
import PacienteTratamientoPage from "./pages/pacientes/PacienteTratamientoPage";
// 🔹 Páginas DOCTOR
import DoctorCitasPage from "./pages/doctores/DoctorCitasPage";
import DoctorPacientesPage from "./pages/doctores/DoctorPacientesPage";
import DoctorPagosPage from "./pages/doctores/DoctorPagosPage";
import DoctorConsentimientosPage from "./pages/doctores/DoctorConsentimientosPage";
import DoctorConsentimientoViewer from "./pages/doctores/DoctorConsentimientoViewer";

// 🔹 Nuevas páginas del flujo clínico (DOCTOR)
import DoctorPacienteDetallePage from "./pages/doctores/DoctorPacienteDetallePage";
import DoctorConsultaPage from "./pages/doctores/DoctorConsultaPage";
import DoctorReportePage from "./pages/doctores/DoctorReportesPage"; // 🔄 Cambiado a singular
import DoctorRecetasPage from "./pages/doctores/DoctorRecetasPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";

// 🔐 Ruta protegida
import ProtectedRoute from "./components/ProtectedRoute";

// 🔔 Toast global
import ToastProvider from "./components/ToastProvider";

function App() {
  // Roles que pueden acceder a las vistas de DOCTOR
  const DOCTOR_ROLES = ["DERMATOLOGO", "PODOLOGO", "TAMIZ", "ADMIN"];

  return (
    <Router>
      <ToastProvider>
        <Routes>
          {/* Público */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Dashboards (según rol) */}
          <Route
            path="/dashboard/:role"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* ===========================
              FLUJO PACIENTE
             =========================== */}
          <Route
            path="/citas"
            element={
              <ProtectedRoute allowedRoles={["PACIENTE"]}>
                <Citas />
              </ProtectedRoute>
            }
          />

          <Route
            path="/paciente/citas"
            element={<Navigate to="/dashboard/paciente" replace />}
          />

          <Route
            path="/pago/:citaId"
            element={
              <ProtectedRoute allowedRoles={["PACIENTE"]}>
                <PaymentPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/citas/:citaId/consentimiento"
            element={
              <ProtectedRoute allowedRoles={["PACIENTE"]}>
                <ConsentimientoPage />
              </ProtectedRoute>
            }
          />

          {/* Historial clínico del PACIENTE */}
          <Route
            path="/paciente/reportes"
            element={
              <ProtectedRoute allowedRoles={["PACIENTE"]}>
                <ReportesPacientePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/paciente/recetas"
            element={
              <ProtectedRoute allowedRoles={["PACIENTE"]}>
                <RecetasPacientePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/paciente/pagos"
            element={
              <ProtectedRoute allowedRoles={["PACIENTE"]}>
                <PacientePagosPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/paciente/tratamiento"
            element={
              <ProtectedRoute allowedRoles={["PACIENTE"]}>
                <PacienteTratamientoPage />
              </ProtectedRoute>
            }
          />

          {/* ===========================
              FLUJO DOCTOR
             =========================== */}
          <Route
            path="/doctor/citas"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorCitasPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/pacientes"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorPacientesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/pacientes/:pacienteId"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorPacienteDetallePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/pacientes/:pacienteId/consulta"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorConsultaPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/pagos"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorPagosPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/consentimientos"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorConsentimientosPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/consentimientos/:citaId"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorConsentimientoViewer />
              </ProtectedRoute>
            }
          />

          {/* 🔄 RUTAS ACTUALIZADAS PARA REPORTES UNIFICADOS */}
          <Route
            path="/doctor/reportes"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorReportePage /> {/* 🔄 Componente unificado */}
              </ProtectedRoute>
            }
          />

          {/* 🆕 NUEVA RUTA PARA EL DETALLE DEL PACIENTE EN REPORTES */}
          <Route
            path="/doctor/reportes/paciente/:pacienteId"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorReportePage /> {/* 🔄 Mismo componente para modo detalle */}
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/recetas"
            element={
              <ProtectedRoute allowedRoles={DOCTOR_ROLES}>
                <DoctorRecetasPage />
              </ProtectedRoute>
            }
          />

          {/* ===========================
              FLUJO ADMIN
             =========================== */}
          <Route
            path="/admin/usuarios"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />

          {/* 🆗 Ruta de respaldo para manejar errores 404 */}
          <Route path="*" element={
            <div className="container mt-5">
              <div className="alert alert-warning text-center">
                <h4>Página no encontrada</h4>
                <p>La ruta que buscas no existe.</p>
                <a href="/" className="btn btn-primary">Volver al inicio</a>
              </div>
            </div>
          } />
        </Routes>
      </ToastProvider>
    </Router>
  );
}

export default App;
