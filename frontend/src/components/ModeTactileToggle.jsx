import React, { useContext } from 'react';
import { ModeTactileContext } from '../contexts/ModeTactileContext'; // ou vers le bon fichier si déplacé

const ModeTactileToggle = () => {
  const { modeTactile, setModeTactile } = useContext(ModeTactileContext);

  return (
    <div className="form-check form-switch text-white me-2">
      <input
        className="form-check-input"
        type="checkbox"
        role="switch"
        id="modeTactileSwitch"
        checked={modeTactile}
        onChange={() => setModeTactile(prev => !prev)}
      />
      <label className="form-check-label" htmlFor="modeTactileSwitch">
        🖐️
      </label>
    </div>
  );
};

export default ModeTactileToggle;
