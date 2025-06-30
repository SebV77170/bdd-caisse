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
  const { modeTactile } = useContext(ModeTactileContext);
  const [show, setShow] = useState(false);

  const handleValider = (val) => {
    onChange({ target: { value: val } });
  };

  const isNumeric = type === 'number' || isDecimal;
  const displayValue = value === undefined || value === null ? '' : value;

  if (modeTactile) {
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

        {isNumeric ? (
          <ClavierNumeriqueModal
            show={show}
            onClose={() => setShow(false)}
            onValider={handleValider}
            initial=""
            isDecimal={true}
          />
        ) : (
          <ClavierTexteModal
            show={show}
            onClose={() => setShow(false)}
            onValider={handleValider}
            initial=""
          />
        )}
      </>
    );
  }

  return as === 'textarea' ? (
    <textarea {...props} value={value} onChange={onChange} />
  ) : (
    <input {...props} type={type} value={value} onChange={onChange} />
  );
}

export default TactileInput;
