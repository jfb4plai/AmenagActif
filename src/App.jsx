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
import MesElevesPage from './pages/MesElevesPage.jsx';
import NotFound from './pages/NotFound.jsx';

const EDITEURS = ['admin', 'referent_plai', 'direction'];
const LECTEURS = [...EDITEURS, 'agent_plai']; // + accès lecture seule (fiches)

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

/** Racine : les éditeurs (admin/référent/direction) vont vers la saisie, les
 * agents accompagnants vers leurs élèves assignés, les autres vers la fiche vue école. */
function Accueil() {
  const { loading, role, editeurEcole } = useRole();
  if (loading) return <div className="plai-section">Chargement…</div>;
  if (editeurEcole) return <Navigate to="/saisie" replace />;
  if (role === 'agent_plai') return <Navigate to="/mes-eleves" replace />;
  return <Navigate to="/fiches/ecole" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/nouveau-mot-de-passe" element={<NouveauMotDePasse />} />
      <Route path="/fiche/:token" element={<FichePublique />} />
      <Route path="/" element={<RequireAuth><Shell><Accueil /></Shell></RequireAuth>} />
      <Route path="/saisie" element={<RequireAuth><Shell><RequireRole roles={EDITEURS}><SaisieEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/mon-ecole" element={<RequireAuth><Shell><RequireRole roles={EDITEURS}><MonEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/mes-eleves" element={<RequireAuth><Shell><RequireRole roles={['agent_plai']}><MesElevesPage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/administration" element={<RequireAuth><Shell><RequireRole roles={['admin']}><Administration /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheClassePage picker /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches/ecole" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheEcolePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/classe/:classeId/fiche" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheClassePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/eleve/:eleveId/fiche" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheElevePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="*" element={<Shell><NotFound /></Shell>} />
    </Routes>
  );
}
