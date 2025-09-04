// src/components/FocusHud.jsx
import React, { useEffect, useState } from 'react';

export default function FocusHud() {
  const [s, setS] = useState({ hasFocus: false, vis: '', active: '' });

  useEffect(() => {
    const update = () => {
      const ae = document.activeElement;
      setS({
        hasFocus: document.hasFocus(),
        vis: document.visibilityState,
        active: ae
          ? `${ae.tagName.toLowerCase()}${ae.readOnly ? ':ro' : ''}${ae.disabled ? ':dis' : ''}${ae.getAttribute('contenteditable') === 'true' ? ':ce' : ''}#${ae.id || ''}.${ae.className || ''}`
          : '(none)',
      });
    };
    const evs = ['focus', 'blur', 'visibilitychange', 'pointerdown', 'focusin'];
    evs.forEach(e => window.addEventListener(e, update, true));
    const id = setInterval(update, 500);
    update();
    return () => {
      evs.forEach(e => window.removeEventListener(e, update, true));
      clearInterval(id);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 6, right: 6, padding: '6px 8px',
      background: 'rgba(0,0,0,.65)', color: '#fff', fontSize: 12,
      borderRadius: 6, zIndex: 999999, pointerEvents: 'none',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div>focus: {String(s.hasFocus)}</div>
      <div>visibility: {s.vis}</div>
      <div style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        active: {s.active}
      </div>
    </div>
  );
}
