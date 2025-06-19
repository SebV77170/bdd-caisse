import React from 'react';

const ResetButton = () => {
  const handleReset = async () => {
    const confirmReset = window.confirm('⚠️ Cette action va supprimer tous les tickets, paiements et bilans. Continuer ?');
    if (!confirmReset) return;

    try {
      const res = await fetch('http://localhost:3001/api/reset', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        alert(result.message);
        window.location.reload();
      } else {
        alert('Erreur : ' + result.error);
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la réinitialisation.');
    }
  };

  return (
    <button className="btn btn-sm btn-outline-warning me-2" onClick={handleReset}>
      Reset
    </button>
  );
};

export default ResetButton;
