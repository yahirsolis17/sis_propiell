// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/login";
import Register from "./pages/Register"; // 🔹 Importa la página de registro
import Dashboard from "./pages/Dashboard";
import Citas from './pages/Citas';
import PaymentPage from './pages/PaymentPage';
import { API_URL } from './config'; // Importas la configuración

function App() {
  console.log("Base URL del backend:", API_URL);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard/:role" element={<Dashboard />} />
        <Route path="/citas" element={<Citas />} />
        <Route path="/pago/:citaId" element={<PaymentPage />} />
      </Routes>
    </Router>
  );
}

export default App;
