// ConfirmContext.jsx
import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { Modal, Button } from "react-bootstrap";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "Confirmer",
    cancelText: "Annuler",
    variant: "danger",
  });
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState((s) => ({ ...s, open: true, ...opts }));
    });
  }, []);

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const resolveAndClose = useCallback(
    (val) => {
      const resolve = resolverRef.current;
      resolverRef.current = null;
      close();
      resolve?.(val);
    },
    [close]
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        show={state.open}
        onHide={() => resolveAndClose(false)}
        backdrop="static"
        keyboard
        centered
      >
        {state.title ? (
          <Modal.Header closeButton>
            <Modal.Title>{state.title}</Modal.Title>
          </Modal.Header>
        ) : null}
        <Modal.Body>{state.message}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => resolveAndClose(false)}>
            {state.cancelText}
          </Button>
          <Button autoFocus variant={state.variant} onClick={() => resolveAndClose(true)}>
            {state.confirmText}
          </Button>
        </Modal.Footer>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
