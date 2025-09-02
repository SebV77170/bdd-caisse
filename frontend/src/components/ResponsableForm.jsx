import React from "react";

function ResponsableForm({ responsablePseudo, setResponsablePseudo, motDePasse, setMotDePasse }) {
  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label>Pseudo du responsable :</label>
        <br />
        <input
          type="text"
          value={responsablePseudo}
          onChange={(e) => setResponsablePseudo(e.target.value)}
          required
        />
      </div>

      <div>
        <label>Mot de passe du responsable :</label>
        <br />
        <input
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          required
        />
      </div>
    </div>
  );
}

export default ResponsableForm;
