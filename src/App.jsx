import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import BandeauBascule from './components/BandeauBascule.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireRole from './components/RequireRole.jsx';
import { useRole } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import NouveauMotDePasse from './pages/NouveauMotDePasse.jsx';
import SaisieEcole from './pages/SaisieEcole.jsx';
import FicheClassePage from './pages/FicheClassePage.jsx';
import FicheEcolePage from './pages/FicheEcolePage.jsx';
import FicheElevePage from './pages/FicheElevePage.jsx';
import FichePublique from './pages/FichePublique.jsx';
import Administration from './pages/Administration.jsx';
import MonEcole from './pages/MonEcole.jsx';
import NotFound from './pages/NotFound.jsx';

const EDITEURS = ['admin', 'referent_plai', 'direction', 'agent_plai']; // accès à la saisie (agent : élèves/AR, pas de création de classe ni retrait d'AU — géré en RLS)
const LECTEURS = EDITEURS; // fiches accessibles aux mêmes rôles

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

/** Racine : tout éditeur (admin/référent/direction/agent) va vers la saisie. */
function Accueil() {
  const { loading, editeurEcole } = useRole();
  if (loading) return <div className="plai-section">Chargement…</div>;
  return <Navigate to={editeurEcole ? '/saisie' : '/fiches/ecole'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/nouveau-mot-de-passe" element={<NouveauMotDePasse />} />
      <Route path="/fiche/:token" element={<FichePublique />} />
      <Route path="/" element={<RequireAuth><Shell><Accueil /></Shell></RequireAuth>} />
      <Route path="/saisie" element={<RequireAuth><Shell><RequireRole roles={EDITEURS}><SaisieEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/mon-ecole" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><MonEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/administration" element={<RequireAuth><Shell><RequireRole roles={['admin']}><Administration /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheClassePage picker /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches/ecole" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheEcolePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/classe/:classeId/fiche" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheClassePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/eleve/:eleveId/fiche" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheElevePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="*" element={<Shell><NotFound /></Shell>} />
    </Routes>
  );
}
