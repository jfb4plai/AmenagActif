import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ cat: null, ajouterChapitre: null, majAmenagement: null, ajouterAmenagement: null }));

vi.mock('../../src/hooks/useAdmin.js', () => ({
  useAnnees: () => ({ data: [] }),
  useEcoles: () => ({ data: [] }),
  useEcolesAdmin: () => ({ data: [] }),
  useAdminMutations: () => ({ ajouterAnnee: {}, activerAnnee: {}, ajouterEcole: {}, majEcole: {} }),
  useCatalogueAdmin: () => ({ data: h.cat }),
  useCatalogueMutations: () => ({
    majAmenagement: h.majAmenagement,
    ajouterAmenagement: h.ajouterAmenagement,
    ajouterChapitre: h.ajouterChapitre,
  }),
}));
vi.mock('../../src/hooks/useMembres.js', () => ({
  useMembres: () => ({ data: [], isLoading: false, error: null }),
  useMembresMutations: () => ({
    inviter: {}, changerRole: {}, retirer: {}, assignerEcole: {}, retirerEcole: {},
  }),
}));
vi.mock('../../src/lib/auth.jsx', () => ({ useAuth: () => ({ session: null }) }));

import Administration from '../../src/pages/Administration.jsx';
import CatalogueAmenagements from '../../src/pages/CatalogueAmenagements.jsx';

const chapitres = [
  { id: 'c1', ordre: 1, titre: 'Consignes', code: 'CONS', est_dispositif: false },
  { id: 'd1', ordre: 13, titre: 'Dispositif de régulation', code: 'REG', est_dispositif: true },
];
const amenagements = [
  { id: 'a1', chapitre_id: 'c1', ordre: 1, libelle: 'Consignes courtes', type: 'AU', actif: true, code: 'X1', partage_profil: true },
  { id: 'a2', chapitre_id: 'c1', ordre: 2, libelle: 'Temps supplémentaire', type: 'AR', actif: true, code: 'X2', partage_profil: true },
  { id: 'x1', chapitre_id: 'd1', ordre: 1, libelle: 'Coin calme', type: 'AR', actif: true, code: 'X3', partage_profil: true },
  { id: 'x2', chapitre_id: 'd1', ordre: 2, libelle: 'Pause à la demande', type: 'AR', actif: true, code: 'X4', partage_profil: true },
];

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Catalogue public : dispositifs', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ chapitres, amenagements }) })));
  });

  it('badge Dispositif et phrase pour un dispositif, AU/AR pour un chapitre ordinaire', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><CatalogueAmenagements /></MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Coin calme');
    const sections = screen.getAllByRole('heading', { level: 2 }).map((hd) => hd.closest('section'));
    const dispo = sections.find((s) => within(s).queryByText('Dispositif de régulation'));
    const ordinaire = sections.find((s) => within(s).queryByText('Consignes'));

    expect(within(dispo).getAllByText('Dispositif')).toHaveLength(2);
    expect(within(dispo).getByText(/AU ou AR selon la classe/)).toBeTruthy();
    expect(within(dispo).queryByText('AU')).toBeNull();
    expect(within(dispo).queryByText('AR')).toBeNull();

    expect(within(ordinaire).getByText('AU')).toBeTruthy();
    expect(within(ordinaire).getByText('AR')).toBeTruthy();
    expect(within(ordinaire).queryByText('Dispositif')).toBeNull();
    expect(within(ordinaire).queryByText(/AU ou AR selon la classe/)).toBeNull();
  });
});

describe('Administration : catalogue et dispositifs', () => {
  beforeEach(() => {
    h.cat = { chapitres, amenagements };
    h.ajouterChapitre = { mutate: vi.fn(), isError: false };
    h.majAmenagement = { mutate: vi.fn(), isError: false };
    h.ajouterAmenagement = { mutate: vi.fn(), isError: false };
  });

  const rendre = () => render(<MemoryRouter><Administration /></MemoryRouter>);

  it('entête de dispositif : compte et pas de sélecteur de type', () => {
    rendre();
    expect(screen.getByText(/dispositif : 2 aménagement\(s\)/)).toBeTruthy();
    expect(screen.getByText(/\(1 AU · 1 AR\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Dispositif de régulation/ }));
    expect(screen.queryAllByRole('combobox', { name: /Type/ })).toHaveLength(0);
    expect(screen.getAllByText('selon la classe (AR ou AU)')).toHaveLength(2);
  });

  it('chapitre ordinaire : sélecteur de type présent', () => {
    rendre();
    fireEvent.click(screen.getByRole('button', { name: /Consignes/ }));
    expect(screen.getAllByRole('combobox', { name: /Type/ }).length).toBeGreaterThanOrEqual(2);
  });

  it('déplacer un item vers un dispositif envoie type AR', () => {
    rendre();
    fireEvent.click(screen.getByRole('button', { name: /Consignes/ }));
    const selects = screen.getAllByRole('combobox', { name: /Chapitre/ });
    fireEvent.change(selects[0], { target: { value: 'd1' } });
    expect(h.majAmenagement.mutate).toHaveBeenCalledWith({ id: 'a1', chapitreId: 'd1', type: 'AR', verifierCochages: true });
  });

  it('déplacer un item entre deux chapitres ordinaires : pas de vérification des cochages', () => {
    h.cat = { chapitres: [...chapitres, { id: 'c2', ordre: 2, titre: 'Évaluations', code: 'EVAL', est_dispositif: false }], amenagements };
    rendre();
    fireEvent.click(screen.getByRole('button', { name: /Consignes/ }));
    const selects = screen.getAllByRole('combobox', { name: /Chapitre/ });
    fireEvent.change(selects[0], { target: { value: 'c2' } });
    expect(h.majAmenagement.mutate).toHaveBeenCalledWith({ id: 'a1', chapitreId: 'c2' });
  });

  it('sortir un item d’un dispositif : vérification des cochages', () => {
    rendre();
    fireEvent.click(screen.getByRole('button', { name: /Dispositif de régulation/ }));
    const selects = screen.getAllByRole('combobox', { name: /Chapitre/ });
    fireEvent.change(selects[0], { target: { value: 'c1' } });
    expect(h.majAmenagement.mutate).toHaveBeenCalledWith({ id: 'x1', chapitreId: 'c1', verifierCochages: true });
  });

  it('création de chapitre : case dispositif transmise à la mutation', () => {
    rendre();
    const box = screen.getByRole('checkbox', { name: /Ce chapitre est un dispositif/ });
    fireEvent.change(screen.getByLabelText(/Nouveau chapitre/), { target: { value: 'Dispositif test' } });
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le chapitre' }));
    expect(h.ajouterChapitre.mutate).toHaveBeenCalledWith({ titre: 'Dispositif test', estDispositif: true });
  });

  it('création de chapitre sans la case : estDispositif false', () => {
    rendre();
    fireEvent.change(screen.getByLabelText(/Nouveau chapitre/), { target: { value: 'Ordinaire' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le chapitre' }));
    expect(h.ajouterChapitre.mutate).toHaveBeenCalledWith({ titre: 'Ordinaire', estDispositif: false });
  });
});
