import { io } from 'socket.io-client';
import { useEffect, useState, createContext } from 'react';
import MainRoutes from './components/MainRoutes';
import MainNavbar from './components/MainNavBar';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.scss';
import { useLocation } from 'react-router-dom';
import BilanJour from './components/BilanJour';
import { SyncModalProvider } from './contexts/SyncModalContext';
import ModalSyncSecondaire from './components/ModalSyncSecondaire';

// Ces deux lignes doivent venir **après** tous les imports
const socket = io('http://localhost:3001');

function App() {

  return (
   
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <MainNavbar />
        <BilanJour />
        <SyncModalProvider>
          <ModalSyncSecondaire />
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
