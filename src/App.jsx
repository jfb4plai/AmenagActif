import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import BandeauBascule from './components/BandeauBascule.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireRole from './components/RequireRole.jsx';
import { useRole } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import SaisieEcole from './pages/SaisieEcole.jsx';
import FicheClassePage from './pages/FicheClassePage.jsx';
import FicheElevePage from './pages/FicheElevePage.jsx';
import FichePublique from './pages/FichePublique.jsx';
import Administration from './pages/Administration.jsx';
import NotFound from './pages/NotFound.jsx';

function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <BandeauBascule />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** Redirige la racine selon le rôle : PLAI → saisie, direction → fiches. */
function Accueil() {
  const { role, loading } = useRole();
  if (loading) return <div className="plai-section">Chargement…</div>;
  return <Navigate to={role === 'direction' ? '/fiches' : '/saisie'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/fiche/:token" element={<FichePublique />} />
      <Route path="/" element={<RequireAuth><Shell><Accueil /></Shell></RequireAuth>} />
      <Route path="/saisie" element={<RequireAuth><Shell><RequireRole roles={['plai']}><SaisieEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/administration" element={<RequireAuth><Shell><RequireRole roles={['plai']}><Administration /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches" element={<RequireAuth><Shell><RequireRole roles={['plai','direction']}><FicheClassePage picker /></RequireRole></Shell></RequireAuth>} />
      <Route path="/classe/:classeId/fiche" element={<RequireAuth><Shell><RequireRole roles={['plai','direction']}><FicheClassePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/eleve/:eleveId/fiche" element={<RequireAuth><Shell><RequireRole roles={['plai','direction']}><FicheElevePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="*" element={<Shell><NotFound /></Shell>} />
    </Routes>
  );
}
