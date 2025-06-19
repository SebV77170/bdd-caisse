import React from 'react';

const DevModeToggle = ({ devMode, setDevMode, setShowPassModal }) => {
  const toggleDevMode = () => {
    if (!devMode) {
      setShowPassModal(true);
    } else {
      setDevMode(false);
    }
  };

  return (
    <div className="form-check form-switch ms-2">
      <input
        className="form-check-input"
        type="checkbox"
        role="switch"
        id="devModeSwitch"
        checked={devMode}
        onChange={toggleDevMode}
      />
      <label className="form-check-label text-white" htmlFor="devModeSwitch">
        DEV
      </label>
    </div>
  );
};

export default DevModeToggle;
