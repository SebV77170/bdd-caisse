// src/MainRoutes.jsx
import { Routes, Route } from 'react-router-dom';
import Caisse from '../pages/Caisse';
import BilanTickets from '../pages/BilanTickets';
import LoginPage from '../pages/LoginPage';
import BienvenuePage from '../pages/BienvenuePage';
import OuvertureCaisse from '../pages/ouvertureCaisse';
import FermetureCaisse from '../pages/FermetureCaisse';
import JournalCaisse from '../pages/JournalCaisse';
import CompareSchemas from '../pages/CompareSchemas';
import DbConfig from '../pages/DbConfig';
import Parametres from '../pages/Parametres';
import RequireUserSession from './RequireUserSession';
import RequireUserAndCaisseSession from './RequireUserAndCaisseSession';
import CaisseNonOuverte from '../pages/CaisseNonOuverte';
import { useActiveSession } from '../contexts/SessionCaisseContext';
import SessionCaisseAutoProvider from '../contexts/SessionCaisseAutoProvider';
import { SessionCaisseProvider, SessionCaisseSecondaireProvider } from '../contexts/SessionCaisseContext';
import { useContext } from 'react';
import { DevModeContext } from '../contexts/DevModeContext';

export default function MainRoutes() {
  const { devMode } = useContext(DevModeContext);
  const activeSession = useActiveSession();

  return (
    <Routes>
      
      <Route
        path="/"
        element={<BienvenuePage />}
      />

      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/ouverture-caisse"
        element={
          <RequireUserSession>
            <OuvertureCaisse />
          </RequireUserSession>
        }
      />

      <Route
        path="/caisse-non-ouverte"
        element={
          <RequireUserSession>
            <CaisseNonOuverte />
          </RequireUserSession>
        }
      />

      <Route path="/caisse" element={
        <RequireUserAndCaisseSession>
          
            <Caisse />
          
        </RequireUserAndCaisseSession>
            
      } />

      <Route
        path="/fermeture-caisse"
        element={
          <RequireUserAndCaisseSession>
              <FermetureCaisse />
          </RequireUserAndCaisseSession>
        }
      />

      <Route
        path="/journal-caisse"
        element={
          <RequireUserSession>
            <JournalCaisse />
          </RequireUserSession>
        }
      />

      <Route path="/bilan" element={<RequireUserSession><BilanTickets /></RequireUserSession>} />

      <Route path="/parametres" element={<Parametres />} />
      <Route path="/compare-schemas" element={<CompareSchemas />} />

      {devMode && <Route path="/db-config" element={<DbConfig />} />}
    </Routes>
  );
}
