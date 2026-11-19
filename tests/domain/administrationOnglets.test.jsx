import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';

afterEach(cleanup);

// Les sept onglets sont remplacés par des stubs : seul le routage et la mise en page sont testés ici.
vi.mock('../../src/pages/administration/MembresTab.jsx', () => ({ default: () => <h2>Stub membres</h2> }));
vi.mock('../../src/pages/administration/EcolesTab.jsx', () => ({ default: () => <h2>Stub écoles</h2> }));
vi.mock('../../src/pages/administration/AnneesTab.jsx', () => ({ default: () => <h2>Stub années</h2> }));
vi.mock('../../src/pages/administration/DroitsTab.jsx', () => ({ default: () => <h2>Stub droits</h2> }));
vi.mock('../../src/pages/administration/CatalogueTab.jsx', () => ({ default: () => <h2>Stub catalogue</h2> }));
vi.mock('../../src/pages/TransmissionProfil.jsx', () => ({ default: () => <h2>Stub transmission</h2> }));
vi.mock('../../src/components/AnnoncesAdmin.jsx', () => ({ default: () => <h2>Stub messages</h2> }));

const { default: AdministrationRoutes } = await import('../../src/pages/administration/AdministrationRoutes.jsx');

function Sonde() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  return <p data-testid="sonde">{pathname}|{type}</p>;
}
const rendre = (chemin) => render(
  <MemoryRouter initialEntries={[chemin]}>
    <Routes><Route path="/administration/*" element={<AdministrationRoutes />} /></Routes>
    <Sonde />
  </MemoryRouter>,
);

describe('Administration : onglets par adresse', () => {
  it('/administration affiche Membres et remplace l\'adresse (sans entrée d\'historique)', () => {
    rendre('/administration');
    expect(screen.getByText('Stub membres')).toBeTruthy();
    expect(screen.getByTestId('sonde').textContent).toBe('/administration/membres|REPLACE');
  });

  it.each([
    ['membres', 'Stub membres'],
    ['droits', 'Stub droits'],
    ['ecoles', 'Stub écoles'],
    ['annees', 'Stub années'],
    ['catalogue', 'Stub catalogue'],
    ['transmission', 'Stub transmission'],
    ['messages', 'Stub messages'],
  ])('adresse directe /administration/%s', (chemin, texte) => {
    rendre(`/administration/${chemin}`);
    expect(screen.getByText(texte)).toBeTruthy();
  });

  it('la navigation expose sept liens et marque l\'actif seul', () => {
    rendre('/administration/annees');
    const nav = screen.getByRole('navigation', { name: "Sections de l'administration" });
    const liens = within(nav).getAllByRole('link');
    expect(liens.map((l) => l.textContent)).toEqual(['Membres & accès', 'Droits', 'Écoles', 'Années', 'Catalogue', 'Transmission', 'Messages']);
    const actifs = liens.filter((l) => l.getAttribute('aria-current') === 'page');
    expect(actifs.map((l) => l.textContent)).toEqual(['Années']);
  });

  it('une adresse inconnue affiche « introuvable »', () => {
    rendre('/administration/inexistant');
    expect(screen.getByText('Page introuvable.')).toBeTruthy();
  });

  it('un seul h1 « Administration »', () => {
    rendre('/administration/ecoles');
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe('Administration');
  });
});
