// src/components/ToastProvider.jsx
import React from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * ToastProvider
 *
 * Envuelve a la aplicación y monta un único ToastContainer global.
 * Cualquier componente puede usar:
 *   import { toast } from "react-toastify";
 *   toast.success("Mensaje");
 *
 * Sin necesidad de volver a montar ToastContainer localmente.
 */
const ToastProvider = ({ children }) => {
  return (
    <>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={4500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnHover
        draggable={false}
        closeButton={false}
        limit={1}
        theme="light"
      />
    </>
  );
};

export default ToastProvider;
