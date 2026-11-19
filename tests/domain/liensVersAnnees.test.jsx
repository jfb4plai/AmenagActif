import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/lib/auth.jsx', () => ({ useRole: () => ({ isAdmin: true }) }));
vi.mock('../../src/hooks/useAdmin.js', () => ({
  useAnneeActive: () => ({ libelle: '2025-2026' }),
  besoinBasculeAnnee: () => true,
  useEcolesAdmin: () => ({ data: [] }),
  useAdminMutations: () => ({ ajouterEcole: { mutate: vi.fn() }, majEcole: { mutate: vi.fn() } }),
}));
vi.mock('../../src/hooks/useEcoleGrid.js', () => ({
  useAnnees: () => ({ data: [] }),
  useEcoles: () => ({ data: [] }),
}));
vi.mock('../../src/hooks/useReprise.js', () => ({
  useReprise: () => ({ data: null, isLoading: false, error: null }),
  useRepriseMutations: () => ({}),
  useTransferts: () => ({ data: [] }),
}));

import BandeauBascule from '../../src/components/BandeauBascule.jsx';
import Reprise from '../../src/pages/Reprise.jsx';
import EcolesTab from '../../src/pages/administration/EcolesTab.jsx';

afterEach(() => cleanup());

describe('liens vers l\'onglet Années et textes', () => {
  it('BandeauBascule : le lien Administration mène à /administration/annees', () => {
    render(<MemoryRouter><BandeauBascule /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Administration' }).getAttribute('href')).toBe('/administration/annees');
  });

  it('Reprise : le renvoi vers l\'administration est un lien vers /administration/annees', () => {
    render(<MemoryRouter><Reprise /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Administration' }).getAttribute('href')).toBe('/administration/annees');
  });

  it('EcolesTab : le texte d\'aide ne cite plus « 11 »', () => {
    const { container } = render(<EcolesTab />);
    expect(container.textContent).toContain('Les implantations accompagnées.');
    expect(container.textContent).not.toMatch(/\b11\b/);
  });
});
