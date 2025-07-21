import { io } from 'socket.io-client';
import { useEffect, useState, createContext, useContext } from 'react';
import MainRoutes from './components/MainRoutes';
import MainNavbar from './components/MainNavBar';
import './styles/App.scss';
import 'react-toastify/dist/ReactToastify.css';
import BilanJour from './components/BilanJour';
import { SyncModalProvider } from './contexts/SyncModalContext';
import ModalSyncSecondaire from './components/ModalSyncSecondaire';
import RequireUserAndCaisseSession from './components/RequireUserAndCaisseSession';
// Ces deux lignes doivent venir **après** tous les imports
const socket = io('http://localhost:3001');
export const ModeTactileContext = createContext();

function App() {
  const [modeTactile, setModeTactile] = useState(() => {
    const saved = localStorage.getItem('modeTactile');
    return saved ? JSON.parse(saved) : false;
  });

  return (
    <ModeTactileContext.Provider value={{ modeTactile, setModeTactile }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        <MainNavbar />

        <BilanJour />

        <SyncModalProvider>
          <ModalSyncSecondaire />
          <MainRoutes />
        </SyncModalProvider>
        
      </div>
    </ModeTactileContext.Provider>
  );
}

export default App;
