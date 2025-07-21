import React from 'react';
import { useNavigate } from 'react-router-dom';
import './BienvenuePage.css'; // Pour styliser un peu


function BienvenuePage() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/login');
  };

  return (
    <div className="bienvenue-container">
      <h1>Bienvenue sur l'application de gestion caisse</h1>
      <h2>de <span className="nom-asso">Ressource'Brie</span> 🌿</h2>
      <p>Cette application vous permet de gérer les ventes, les sessions de caisse, et bien plus encore.</p>
      <button onClick={handleStart} className="start-button">
        Commencer
      </button>
    </div>
  );
}

export default BienvenuePage;
