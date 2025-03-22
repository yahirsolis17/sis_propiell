import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Citas from './pages/Citas';
import PaymentPage from './pages/PaymentPage';

function App() {
  // Ejemplo: Leer la variable de entorno
  const baseUrl = import.meta.env.VITE_API_URL;

  console.log("Base URL del backend:", baseUrl);

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
