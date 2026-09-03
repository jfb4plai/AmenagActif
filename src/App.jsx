import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireRole from './components/RequireRole.jsx';
import Login from './pages/Login.jsx';
import SaisieEcole from './pages/SaisieEcole.jsx';
import FicheClassePage from './pages/FicheClassePage.jsx';
import FicheElevePage from './pages/FicheElevePage.jsx';
import FichePublique from './pages/FichePublique.jsx';
import NotFound from './pages/NotFound.jsx';

function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/fiche/:token" element={<FichePublique />} />
      <Route path="/" element={<RequireAuth><Shell><Navigate to="/saisie" replace /></Shell></RequireAuth>} />
      <Route path="/saisie" element={<RequireAuth><Shell><RequireRole roles={['plai']}><SaisieEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches" element={<RequireAuth><Shell><RequireRole roles={['plai','direction']}><FicheClassePage picker /></RequireRole></Shell></RequireAuth>} />
      <Route path="/classe/:classeId/fiche" element={<RequireAuth><Shell><RequireRole roles={['plai','direction']}><FicheClassePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/eleve/:eleveId/fiche" element={<RequireAuth><Shell><RequireRole roles={['plai','direction']}><FicheElevePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="*" element={<Shell><NotFound /></Shell>} />
    </Routes>
  );
}
