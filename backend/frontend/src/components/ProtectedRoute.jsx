// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser, verifyAuth } from "../services/authService";

/**
 * ProtectedRoute
 *
 * Uso:
 *  <ProtectedRoute>
 *    <Dashboard />
 *  </ProtectedRoute>
 *
 *  <ProtectedRoute allowedRoles={["PACIENTE"]}>
 *    <Citas />
 *  </ProtectedRoute>
 *
 * Props:
 *  - allowedRoles?: string[]
 *    Si se omite → solo valida que haya sesión.
 *    Si se especifica → además valida que user.role ∈ allowedRoles.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const location = useLocation();

  // Congelamos el usuario actual desde localStorage
  const [user] = useState(() => getCurrentUser());

  const [checking, setChecking] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const runCheck = async () => {
      // Si no hay user en localStorage, ni siquiera intentamos verifyAuth
      if (!user) {
        if (isMounted) {
          setIsValid(false);
          setChecking(false);
        }
        return;
      }

      try {
        const valid = await verifyAuth(controller.signal);

        if (!isMounted) return;

        if (!valid) {
          // Tokens inválidos / expirados → limpiar sesión
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setIsValid(false);
          setIsUnauthorized(false);
        } else {
          // Sesión válida a nivel token
          if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
            const hasRole = allowedRoles.includes(user.role);
            setIsValid(hasRole);
            setIsUnauthorized(!hasRole);
          } else {
            // No se restringió por rol → cualquier usuario autenticado pasa
            setIsValid(true);
            setIsUnauthorized(false);
          }
        }
      } catch (err) {
        if (!isMounted) return;

        console.error("Error verificando autenticación en ProtectedRoute:", err);

        // En error asumimos sesión inválida / caída de backend
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setIsValid(false);
        setIsUnauthorized(false);
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };

    runCheck();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [user, allowedRoles]);

  // Mientras verifica, mostramos un loader sencillo
  if (checking) {
    return (
      <div className="container py-5 text-center">
        <p className="text-muted mb-0">Verificando sesión...</p>
      </div>
    );
  }

  // Si no hay sesión válida
  if (!isValid) {
    // Sin user → directo a login
    if (!user) {
      return (
        <Navigate
          to="/login"
          replace
          state={{ from: location.pathname || "/", reason: "no-session" }}
        />
      );
    }

    // Hay user pero es un rol no autorizado para esta ruta
    if (isUnauthorized) {
      const targetRole = (user.role || "PACIENTE").toLowerCase();
      return (
        <Navigate
          to={`/dashboard/${targetRole}`}
          replace
          state={{
            from: location.pathname || "/",
            reason: "forbidden",
          }}
        />
      );
    }

    // Fallback genérico: tratamos como sesión caída → login
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname || "/", reason: "invalid-session" }}
      />
    );
  }

  // Autenticado y con rol permitido → renderizamos contenido protegido
  return children;
};

export default ProtectedRoute;
