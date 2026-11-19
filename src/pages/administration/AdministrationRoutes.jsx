import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout.jsx';
import MembresTab from './MembresTab.jsx';
import DroitsTab from './DroitsTab.jsx';
import EcolesTab from './EcolesTab.jsx';
import AnneesTab from './AnneesTab.jsx';
import CatalogueTab from './CatalogueTab.jsx';
import TransmissionProfil from '../TransmissionProfil.jsx';
import NotFound from '../NotFound.jsx';

// Monté sous <Route path="/administration/*"> : les chemins ci-dessous sont relatifs à /administration.
export default function AdministrationRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="membres" replace />} />
        <Route path="membres" element={<MembresTab />} />
        <Route path="droits" element={<DroitsTab />} />
        <Route path="ecoles" element={<EcolesTab />} />
        <Route path="annees" element={<AnneesTab />} />
        <Route path="catalogue" element={<CatalogueTab />} />
        <Route path="transmission" element={<TransmissionProfil />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
