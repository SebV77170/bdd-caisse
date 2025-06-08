import React, { useState, useContext } from 'react';
import ClavierNumeriqueModal from './clavierNumeriqueModal';
import ClavierTexteModal from './ClavierTexteModal';
import { ModeTactileContext } from '../App';

function TactileInput({ value, onChange, type = 'text', isDecimal = false, ...props }) {
  const { modeTactile } = useContext(ModeTactileContext);
  const [show, setShow] = useState(false);

  const handleValider = (val) => {
    onChange({ target: { value: val } });
  };

  const isNumeric = type === 'number' || isDecimal;

  if (modeTactile) {
    const displayValue = value === undefined || value === null ? '' : value;
    return (
      <>
        <input
          {...props}
          type={type === 'password' ? 'password' : 'text'}
          readOnly
          value={displayValue}
          onClick={() => setShow(true)}
          style={{ cursor: 'pointer', ...(props.style || {}) }}
        />
        {isNumeric ? (
          <ClavierNumeriqueModal
            show={show}
            onClose={() => setShow(false)}
            onValider={handleValider}
            initial={displayValue.toString()}
            isDecimal={true}
          />
        ) : (
          <ClavierTexteModal
            show={show}
            onClose={() => setShow(false)}
            onValider={handleValider}
            initial={displayValue.toString()}
          />
        )}
      </>
    );
  }

  return <input {...props} type={type} value={value} onChange={onChange} />;
}

export default TactileInput;
