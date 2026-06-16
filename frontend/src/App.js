import { useEffect } from 'react';
import MainRoutes from './components/MainRoutes';
import MainNavbar from './components/MainNavBar';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.scss';
import BilanJour from './components/BilanJour';
import RemoteMysqlWarning from './components/RemoteMysqlWarning';
import { SyncModalProvider } from './contexts/SyncModalContext';
import ModalSyncSecondaire from './components/ModalSyncSecondaire';
import ModalOuvertureSecondaire from './components/ModalOuvertureSecondaire';
import { useLocation } from 'react-router-dom';
//import FocusHud from './components/FocusHud';

function App() {
  const location = useLocation();
  const isTabletPreTicket = location.pathname.startsWith('/pre-tickets/tablette');

  // dans App.jsx
useEffect(() => {
  const h = (e) => {
    const t = e.target;
    if (!t?.matches?.('input, textarea, [contenteditable="true"], .form-control')) return;

    // only if la page a perdu le focus, on réveille "light"
    if (!document.hasFocus()) {
      window.electron?.ensureInteractiveLight?.();
      // on laisse le focus natif se faire ; fallback si besoin :
      requestAnimationFrame(() => {
        if (document.activeElement !== t) t.focus?.();
      });
    }
  };
  document.addEventListener('pointerdown', h, true);
  return () => document.removeEventListener('pointerdown', h, true);
}, []);

  return (
   
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* <FocusHud /> */}
        {!isTabletPreTicket && <MainNavbar />}
        {!isTabletPreTicket && <BilanJour />}
        {!isTabletPreTicket && <RemoteMysqlWarning />}
        <SyncModalProvider>
          {!isTabletPreTicket && <ModalSyncSecondaire />}
          {!isTabletPreTicket && <ModalOuvertureSecondaire />}
          <MainRoutes />
        </SyncModalProvider>
        
      

      <ToastContainer
        position="top-center"
        autoClose={3000}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        draggable={false}
        limit={3}
      />

      </div>
   
  );
}

export default App;
