import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ cat: null, ajouterChapitre: null, majAmenagement: null, ajouterAmenagement: null, supprimerAmenagement: null, supprimerChapitre: null, usage: undefined }));

vi.mock('../../src/hooks/useAdmin.js', () => ({
  useAnnees: () => ({ data: [] }),
  useEcoles: () => ({ data: [] }),
  useEcolesAdmin: () => ({ data: [] }),
  useAdminMutations: () => ({ ajouterAnnee: {}, activerAnnee: {}, ajouterEcole: {}, majEcole: {} }),
  useCatalogueAdmin: () => ({ data: h.cat }),
  useUsageCatalogue: () => ({ data: h.usage, isLoading: false, error: null }),
  chargerUsageCatalogue: async () => h.usage ?? { vide: true, ecoles: [], nbEleves: 0, nbClassesAU: 0, nbEcoles: 0 },
  useCatalogueMutations: () => ({
    majAmenagement: h.majAmenagement,
    ajouterAmenagement: h.ajouterAmenagement,
    ajouterChapitre: h.ajouterChapitre,
    supprimerAmenagement: h.supprimerAmenagement,
    supprimerChapitre: h.supprimerChapitre,
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
    h.supprimerAmenagement = { mutate: vi.fn(), isError: false, isPending: false };
    h.supprimerChapitre = { mutate: vi.fn(), isError: false, isPending: false };
    h.usage = undefined;
  });

  const rendre = () => render(<MemoryRouter><Administration /></MemoryRouter>);

  const usageUtilise = { vide: false, nbEleves: 1, nbClassesAU: 0, nbEcoles: 1, ecoles: [{ ecoleId: 'e1', ecole: 'Pitteurs', referents: [], classes: [{ annee: '2026-2027', classe: '5LA', au: [], eleves: [{ nom: 'Emilie D.', libelles: ['x'] }] }] }] };

  it('jamais coché : confirmation rassurante puis suppression ; annulation = rien', async () => {
    rendre();
    fireEvent.click(screen.getByRole('button', { name: /Consignes/ }));
    const bouton = () => screen.getAllByRole('button', { name: 'Supprimer' })[0];
    const confirmer = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmer);
    fireEvent.click(bouton());
    await waitFor(() => expect(confirmer).toHaveBeenCalled());
    expect(confirmer.mock.calls[0][0]).toContain("jamais été coché");
    expect(h.supprimerAmenagement.mutate).not.toHaveBeenCalled();
    vi.stubGlobal('confirm', vi.fn(() => true));
    fireEvent.click(bouton());
    await waitFor(() => expect(h.supprimerAmenagement.mutate).toHaveBeenCalledWith({ id: 'a1' }));
  });

  it('déjà coché : pas de confirmation, la fenêtre explique le refus et montre qui contacter', async () => {
    h.usage = usageUtilise;
    const confirmer = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmer);
    rendre();
    fireEvent.click(screen.getByRole('button', { name: /Consignes/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    const fenetre = await screen.findByRole('dialog');
    expect(within(fenetre).getByText(/Suppression impossible pour l'instant/)).toBeTruthy();
    expect(within(fenetre).getByText(/Emilie D\./)).toBeTruthy();
    expect(confirmer).not.toHaveBeenCalled();
    expect(h.supprimerAmenagement.mutate).not.toHaveBeenCalled();
  });

  it('supprimer un chapitre jamais coché : confirmation puis mutation', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    rendre();
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer ce chapitre' })[0]);
    await waitFor(() => expect(h.supprimerChapitre.mutate).toHaveBeenCalledWith({ id: 'c1' }));
  });

  it('refus de la base : le message (avec décompte) est affiché tel quel', () => {
    h.supprimerAmenagement = { mutate: vi.fn(), isError: true, isPending: false, error: new Error('Suppression refusée : cet aménagement est coché pour 3 élève(s) et 1 classe(s). Désactivez-le plutôt.') };
    rendre();
    expect(screen.getByRole('alert').textContent).toContain('coché pour 3 élève(s) et 1 classe(s)');
  });

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

describe('Catalogue public : sélecteurs AU / AR', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ chapitres, amenagements }) })));
  });
  const rendre = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><CatalogueAmenagements /></MemoryRouter>
    </QueryClientProvider>,
  );

  it('AU seuls, AR seuls, ou les deux ; dispositifs visibles tant qu\'un type est coché', async () => {
    rendre();
    await screen.findByText('Coin calme');
    const au = screen.getByRole('checkbox', { name: /AU/ });
    const ar = screen.getByRole('checkbox', { name: /AR/ });

    fireEvent.click(ar); // AU seuls
    expect(screen.getByText('Consignes courtes')).toBeTruthy();
    expect(screen.queryByText('Temps supplémentaire')).toBeNull();
    expect(screen.getByText('Coin calme')).toBeTruthy();

    fireEvent.click(ar); fireEvent.click(au); // AR seuls
    expect(screen.queryByText('Consignes courtes')).toBeNull();
    expect(screen.getByText('Temps supplémentaire')).toBeTruthy();

    fireEvent.click(ar); // aucun
    expect(screen.queryByText('Coin calme')).toBeNull();
    expect(screen.getByText(/Cochez AU, AR ou les deux/)).toBeTruthy();

    fireEvent.click(au); fireEvent.click(ar); // les deux
    expect(screen.getByText('Consignes courtes')).toBeTruthy();
    expect(screen.getByText('Temps supplémentaire')).toBeTruthy();
  });
});

describe('Administration : où un aménagement est utilisé', () => {
  beforeEach(() => {
    h.cat = { chapitres, amenagements };
    h.ajouterChapitre = { mutate: vi.fn(), isError: false };
    h.majAmenagement = { mutate: vi.fn(), isError: false };
    h.ajouterAmenagement = { mutate: vi.fn(), isError: false };
    h.supprimerAmenagement = { mutate: vi.fn(), isError: false, isPending: false };
    h.supprimerChapitre = { mutate: vi.fn(), isError: false, isPending: false };
    h.usage = { vide: false, nbEleves: 2, nbClassesAU: 0, nbEcoles: 1, ecoles: [{
      ecoleId: 'e1', ecole: 'Pitteurs', referents: ['Hélène (référent PLAI)'],
      classes: [{ annee: '2026-2027', classe: '5LA', au: [], eleves: [{ nom: 'Emilie Dupont', libelles: ['Consignes courtes'] }, { nom: 'Karim B.', libelles: ['Consignes courtes'] }] }],
    }] };
  });
  afterEach(() => { h.usage = undefined; });

  it('ouvre une fenêtre avec implantation, référents, classe et élèves ; Fermer la ferme', () => {
    render(<MemoryRouter><Administration /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Consignes/ }));
    fireEvent.click(screen.getAllByRole('button', { name: "Voir où c'est utilisé" })[0]);
    const fenetre = screen.getByRole('dialog');
    expect(within(fenetre).getByText('Pitteurs')).toBeTruthy();
    expect(within(fenetre).getByText(/Hélène \(référent PLAI\)/)).toBeTruthy();
    expect(within(fenetre).getByText(/Classe 5LA/)).toBeTruthy();
    expect(within(fenetre).getByText(/Emilie Dupont/)).toBeTruthy();
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('jamais utilisé : message explicite', () => {
    h.usage = { vide: true, ecoles: [], nbEleves: 0, nbClassesAU: 0, nbEcoles: 0 };
    render(<MemoryRouter><Administration /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('button', { name: "Voir où c'est utilisé" })[0]);
    expect(screen.getByText(/Jamais coché/)).toBeTruthy();
  });
});

