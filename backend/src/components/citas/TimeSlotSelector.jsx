// src/components/citas/TimeSlotSelector.jsx
import React, { useState, useRef, useEffect } from 'react';
import "./TimeSlotSelector.css";

const TimeSlotSelector = ({ horarios, selectedTime, onTimeChange, disabled }) => {
  const [showOptions, setShowOptions] = useState(false);
  const containerRef = useRef(null);

  // Cerrar el menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    };
    
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  // Scroll al elemento seleccionado cuando se abre el dropdown
  useEffect(() => {
    if (showOptions && selectedTime) {
      const selectedElement = document.querySelector('.option-item.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ 
          block: 'nearest',
          behavior: 'smooth' 
        });
      }
    }
  }, [showOptions, selectedTime]);

  const handleSelect = (hora) => {
    onTimeChange(hora);
    setShowOptions(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setShowOptions(!showOptions);
    } else if (e.key === 'Escape') {
      setShowOptions(false);
    } else if (showOptions && horarios.length > 0) {
      // Navegación con teclado en el dropdown
      const currentIndex = horarios.indexOf(selectedTime);
      let newIndex;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, horarios.length - 1);
        onTimeChange(horarios[newIndex]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = currentIndex === -1 ? horarios.length - 1 : Math.max(currentIndex - 1, 0);
        onTimeChange(horarios[newIndex]);
      }
    }
  };

  return (
    <div className="time-slot-selector" ref={containerRef}>
      <div className="slot-row">
        <label className="slot-label">Seleccione horario:</label>
        
        <div className="slot-wrapper">
          <div 
            className={`slot-input ${disabled ? 'disabled' : ''} ${showOptions ? 'open' : ''}`}
            onClick={() => !disabled && setShowOptions(!showOptions)}
            onKeyDown={handleKeyDown}
            tabIndex={disabled ? -1 : 0}
            role="combobox"
            aria-expanded={showOptions}
            aria-haspopup="listbox"
            aria-label="Seleccionar horario"
            aria-disabled={disabled}
          >
            {selectedTime || "Seleccione un horario"}
          </div>

          {showOptions && !disabled && (
            <div 
              className="options-dropdown" 
              role="listbox"
              aria-label="Opciones de horario"
            >
              {horarios.length > 0 ? (
                horarios.map((hora) => (
                  <div 
                    key={hora} 
                    className={`option-item ${selectedTime === hora ? 'selected' : ''}`}
                    onClick={() => handleSelect(hora)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect(hora);
                      }
                    }}
                    role="option"
                    aria-selected={selectedTime === hora}
                    tabIndex={0}
                  >
                    {hora}
                  </div>
                ))
              ) : (
                <div className="no-options">
                  No hay horarios disponibles
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeSlotSelector;