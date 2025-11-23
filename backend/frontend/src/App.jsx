import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/login";
import Register from "./pages/Register"; // 🔹 Importa la página de registro
import Dashboard from "./pages/Dashboard";
import Citas from './pages/Citas';
import PaymentPage from './pages/PaymentPage';
import ConsentimientoPage from "./pages/ConsentimientoPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} /> {/* 🔹 Nueva ruta */}
        <Route path="/dashboard/:role" element={<Dashboard />} />
        <Route path="/citas" element={<Citas />} />
        <Route path="/pago/:citaId" element={<PaymentPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/citas/:citaId/consentimiento" element={<ConsentimientoPage />} />
      </Routes>
    </Router>
  );
}

export default App;
