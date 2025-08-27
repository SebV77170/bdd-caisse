import React, { useEffect, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

function ClavierTexteModal({ show, onClose, onValider, initial = '' }) {
  const [value, setValue] = useState(initial);
  const [isShift, setIsShift] = useState(false);

  // Réinitialise l’affichage à l’ouverture (et quand initial change)
  useEffect(() => {
    if (show) {
      setValue(initial || '');
      setIsShift(false);
    }
  }, [show, initial]);

  const handleInput = (char) => {
    if (char === '←') {
      setValue((prev) => prev.slice(0, -1));
    } else if (char === 'SPACE') {
      setValue((prev) => prev + ' ');
    } else if (char === 'CLEAR') {
      setValue('');
    } else {
      setValue((prev) => prev + char);
    }
  };

  const valider = () => {
    onValider(value);
    onClose();
    setValue('');
    setIsShift(false);
  };

  const toggleShift = () => setIsShift((prev) => !prev);

  const isEmail = (char) =>
    ['gmail.com', 'orange.fr', 'free.fr', 'yahoo.fr', 'hotmail.fr'].includes(char);

  const rows = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['a','z','e','r','t','y','u','i','o','p'],
    ['q','s','d','f','g','h','j','k','l','m'],
    ['⇧','w','x','c','v','b','n','←'],
    ['@','.',';',':','!','?'],
    ['gmail.com','orange.fr','free.fr','yahoo.fr','hotmail.fr'],
  ];

  const transformChar = (char) => {
    if (char === '⇧' || char === '←') return char;
    return /^[a-zA-Z]$/.test(char)
      ? (isShift ? char.toUpperCase() : char.toLowerCase())
      : char;
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      size="lg"
      enforceFocus={false}
      restoreFocus={true}
      animation={true}
      backdrop={true}
    >
      <Modal.Header closeButton>
        <Modal.Title>Clavier tactile</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="display-6 text-center mb-3 border p-2 rounded bg-light">
          {value || ' '}
        </div>

        {rows.map((row, idx) => (
          <div key={idx} className="d-flex justify-content-center mb-2 flex-wrap">
            {row.map((char) => (
              <Button
                key={char}
                className="m-1"
                variant="outline-primary"
                style={{
                  width: isEmail(char) ? 110 : 45,
                  textTransform: 'none',
                }}
                onClick={() => {
                  if (char === '⇧') toggleShift();
                  else handleInput(transformChar(char));
                }}
              >
                {transformChar(char)}
              </Button>
            ))}
          </div>
        ))}

        <div className="d-flex justify-content-center flex-wrap">
          <Button
            className="m-1"
            variant="outline-secondary"
            style={{ width: 90 }}
            onClick={() => handleInput('SPACE')}
          >
            Espace
          </Button>
          <Button
            className="m-1"
            variant="outline-danger"
            style={{ width: 90 }}
            onClick={() => handleInput('CLEAR')}
          >
            Effacer
          </Button>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="success" onClick={valider}>
          Valider
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            onClose();
            // Le reset sera fait au prochain show via useEffect
          }}
        >
          Annuler
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ClavierTexteModal;
