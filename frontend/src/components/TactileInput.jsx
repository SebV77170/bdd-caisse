import React, { useState, useContext } from 'react';
import ClavierNumeriqueModal from './clavierNumeriqueModal';
import ClavierTexteModal from './ClavierTexteModal';
import { ModeTactileContext } from '../App';

function TactileInput({
  value,
  onChange,
  type = 'text',
  isDecimal = false,
  as = 'input', // 'input' ou 'textarea'
  ...props
}) {
  const { modeTactile } = useContext(ModeTactileContext) || { modeTactile: false };
  const [show, setShow] = useState(false);

  const handleValider = (val) => {
    // on reproduit un event "synthetique" compatible avec les inputs contrôlés
    onChange({ target: { value: val } });
  };

  const isNumeric = type === 'number' || isDecimal;
  const displayValue = value === undefined || value === null ? '' : value;

  // ❄️ Mode non-tactile : strict input/textarea, aucun overlay/listener
  if (!modeTactile) {
    return as === 'textarea' ? (
      <textarea {...props} value={value} onChange={onChange} />
    ) : (
      <input {...props} type={type} value={value} onChange={onChange} />
    );
  }

  // 📱 Mode tactile : input en lecture seule + clavier modal monté uniquement quand show === true
  const commonProps = {
    readOnly: true,
    value: displayValue,
    onClick: () => setShow(true),
    style: { cursor: 'pointer', ...(props.style || {}) },
    ...props,
  };

  return (
    <>
      {as === 'textarea' ? (
        <textarea {...commonProps} />
      ) : (
        <input {...commonProps} type={type === 'password' ? 'password' : 'text'} />
      )}

      {show && (
        isNumeric ? (
          <ClavierNumeriqueModal
            show
            onClose={() => setShow(false)}
            onValider={handleValider}
            initial={String(displayValue ?? '')}
            isDecimal={!!isDecimal}
          />
        ) : (
          <ClavierTexteModal
            show
            onClose={() => setShow(false)}
            onValider={handleValider}
            initial={String(displayValue ?? '')}
          />
        )
      )}
    </>
  );
}

export default TactileInput;
