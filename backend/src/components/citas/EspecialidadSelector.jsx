// src/components/citas/EspecialidadSelector.jsx
import React, { useEffect, useRef } from 'react';
import "./EspecialidadSelector.css";

const EspecialidadSelector = ({ 
  especialidades, 
  selectedEspecialidad, 
  onChange,
  error = null,
  required = false,
  disabled = false,
  label = "Seleccione una especialidad:",
  placeholder = "Seleccione una especialidad"
}) => {
  const selectRef = useRef(null);
  
  // Efecto para manejar el enfoque visual
  useEffect(() => {
    const handleFocus = () => {
      if (selectRef.current) {
        selectRef.current.classList.add('focus-visible');
      }
    };
    
    const handleBlur = () => {
      if (selectRef.current) {
        selectRef.current.classList.remove('focus-visible');
      }
    };
    
    const selectElement = selectRef.current;
    if (selectElement) {
      selectElement.addEventListener('focus', handleFocus);
      selectElement.addEventListener('blur', handleBlur);
      
      return () => {
        selectElement.removeEventListener('focus', handleFocus);
        selectElement.removeEventListener('blur', handleBlur);
      };
    }
  }, []);
  
  const handleChange = (e) => {
    onChange(e.target.value);
  };
  
  const getSelectClassName = () => {
    let className = 'form-select';
    if (error) className += ' is-invalid';
    if (disabled) className += ' disabled';
    return className;
  };
  
  return (
    <div className="especialidad-selector">
      <label className="form-label">
        {label}
        {required && <span className="required-indicator">*</span>}
      </label>
      
      <div className="position-relative">
        <select
          ref={selectRef}
          value={selectedEspecialidad}
          onChange={handleChange}
          className={getSelectClassName()}
          disabled={disabled}
          required={required}
          aria-label={label}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "error-message" : undefined}
        >
          <option value="">{placeholder}</option>
          {especialidades.map(especialidad => (
            <option 
              key={especialidad.id} 
              value={especialidad.id}
              disabled={especialidad.disabled || false}
            >
              {especialidad.nombre}
              {especialidad.disponibilidad !== undefined && !especialidad.disponibilidad && (
                <span> (No disponible)</span>
              )}
            </option>
          ))}
        </select>
        
        {/* Contador de opciones (opcional) */}
        {especialidades.length > 0 && (
          <div className="options-counter">
            {especialidades.length}
          </div>
        )}
      </div>
      
      {error && (
        <div id="error-message" className="invalid-feedback">
          {error}
        </div>
      )}
    </div>
  );
};

export default EspecialidadSelector;