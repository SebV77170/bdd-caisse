import React from 'react';
import Tactileinput from './TactileInput';

function InputMontantEuros({ value, onChange, placeholder = '0,00', ...props }) {
  const handleChange = (e) => {
    let val = e.target.value.replace(',', '.');

    // Autorise seulement chiffres + un point
    if (/^\d*\.?\d{0,2}$/.test(val) || val === '') {
      const floatVal = parseFloat(val);
      onChange(isNaN(floatVal) ? 0 : floatVal);
    }
  };

  return (
    <Tactileinput
      type="text"
      inputMode="decimal"
      value={value.toString().replace('.', ',')}
      onChange={handleChange}
      placeholder={placeholder}
      {...props}
    />
  );
}

export default InputMontantEuros;
