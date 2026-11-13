import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

afterEach(() => { cleanup(); roleCourant.role = 'admin'; });

const ECOLES = [{ id: 'e1', nom: 'Athénée A' }, { id: 'e2', nom: 'Athénée B' }];
const ANNEES = [{ id: 'a1', libelle: '2026-2027', active: true }, { id: 'a2', libelle: '2025-2026', active: false }];
const CLASSES = {
  'e1:a1': [{ id: 'c1', nom: '3LA' }, { id: 'c2', nom: '3LB' }, { id: 'c3', nom: '3LC' }],
  'e1:a2': [{ id: 'v1', nom: '2LA' }, { id: 'v2', nom: '2LB' }],
  'e2:a1': [{ id: 'd1', nom: '4XA' }, { id: 'd2', nom: '4XB' }],
};

vi.mock('../../src/hooks/useEcoleGrid.js', () => ({
  useEcoles: () => ({ data: ECOLES }),
  useAnnees: () => ({ data: ANNEES }),
  useEcoleGrid: (ecoleId, anneeId) => ({ data: { classes: CLASSES[`${ecoleId}:${anneeId}`] ?? [] } }),
}));
vi.mock('../../src/hooks/useFicheClasse.js', () => ({ useFicheClasse: () => ({}), useFicheGroupe: () => ({}) }));
vi.mock('../../src/hooks/useAConfirmer.js', () => ({ useAConfirmerClasses: () => ({}) }));
const roleCourant = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../../src/lib/auth.jsx', () => ({ useRole: () => ({ isAdmin: roleCourant.role === 'admin', role: roleCourant.role }) }));
vi.mock('../../src/components/GenerateurLien.jsx', () => ({
  default: ({ classeIds }) => <p data-testid="generateur">{classeIds.length} classes dans le lien</p>,
}));

const { default: FicheClassePage } = await import('../../src/pages/FicheClassePage.jsx');

const rendre = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FicheClassePage picker /></MemoryRouter>);
const cocher = (nom) => fireEvent.click(screen.getByRole('checkbox', { name: `Sélectionner ${nom} pour un regroupement` }));
const choisirSommaire = () => fireEvent.click(screen.getByRole('radio', { name: /Un sommaire : une fiche par classe/ }));

describe('Picker des fiches par classe', () => {
  it('mode fusion : la carte parle d\'une fiche groupée, AU et AR fusionnés, en 16 px', () => {
    rendre();
    fireEvent.change(screen.getByLabelText('École'), { target: { value: 'e1' } });
    cocher('3LA'); cocher('3LB');
    const titre = screen.getByText('Fiche groupée — 2 classes sélectionnées');
    expect(titre.style.fontSize).toBe('16px');
    const aide = screen.getByText(/une seule fiche, AU et AR fusionnés/);
    expect(aide.style.fontSize).toBe('16px');
  });

  it('mode sommaire : la carte dit que chaque classe garde sa fiche derrière un seul lien', () => {
    rendre();
    fireEvent.change(screen.getByLabelText('École'), { target: { value: 'e1' } });
    cocher('3LA'); cocher('3LB');
    choisirSommaire();
    expect(screen.queryByText(/Fiche groupée/)).toBeNull();
    expect(screen.queryByText(/une seule fiche, AU et AR fusionnés/)).toBeNull();
    expect(screen.getByText('Sommaire — 2 classes sélectionnées').style.fontSize).toBe('16px');
    const aide = screen.getByText(/chaque classe garde sa propre fiche/);
    expect(aide.textContent).toMatch(/Un seul lien/);
    expect(aide.style.fontSize).toBe('16px');
    expect(screen.getByText('Classes du sommaire (2)')).toBeTruthy();
  });

  it('changer d\'école vide la sélection : « Classes du sommaire » ne compte jamais de classes invisibles', () => {
    rendre();
    fireEvent.change(screen.getByLabelText('École'), { target: { value: 'e1' } });
    cocher('3LA'); cocher('3LB'); cocher('3LC');
    choisirSommaire();
    expect(screen.getByText('Classes du sommaire (3)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('École'), { target: { value: 'e2' } });
    expect(screen.queryByText(/Classes du sommaire/)).toBeNull();
    expect(screen.queryByTestId('generateur')).toBeNull();
    cocher('4XA'); cocher('4XB');
    expect(screen.getByText('Classes du sommaire (2)')).toBeTruthy();
    expect(screen.getByTestId('generateur').textContent).toBe('2 classes dans le lien');
  });

  it('changer d\'année vide la sélection et l\'aperçu validé', () => {
    rendre();
    fireEvent.change(screen.getByLabelText('École'), { target: { value: 'e1' } });
    cocher('3LA'); cocher('3LB');
    fireEvent.click(screen.getByRole('button', { name: /Valider la sélection/ }));
    fireEvent.change(screen.getByLabelText('Année scolaire'), { target: { value: 'a2' } });
    expect(screen.queryByText(/Fiche groupée/)).toBeNull();
    cocher('2LA');
    expect(screen.queryByText(/Fiche groupée/)).toBeNull(); // 1 seule classe : la carte n'apparaît qu'à partir de 2
    cocher('2LB');
    expect(screen.getByText('Fiche groupée — 2 classes sélectionnées')).toBeTruthy();
  });
});

describe('Mention du sommaire sur la page Fiches', () => {
  it("administrateur : la nouveauté est visible dès l'arrivée, sans rien cocher, avec le mode d'emploi", () => {
    rendre();
    const note = screen.getByRole('note', { name: /sommaire/i });
    expect(note.textContent).toMatch(/Nouveau/);
    expect(note.textContent).toMatch(/plusieurs classes/);
    expect(note.textContent).toMatch(/cochez au moins deux classes/);
    expect(note.textContent).toMatch(/Un sommaire : une fiche par classe/);
    const lien = within(note).getByRole('link', { name: /Mode d'emploi du sommaire/ });
    expect(lien.getAttribute('href')).toBe('/modes-emploi/referents-plai.html#sommaire');
    expect(lien.getAttribute('target')).toBe('_blank');
    expect(lien.getAttribute('rel')).toContain('noopener');
    expect(within(note).getByText(/cochez au moins deux classes/).style.fontSize).toBe('16px');
  });

  it("référent PLAI : mode d'emploi des référents", () => {
    roleCourant.role = 'referent_plai';
    rendre();
    const lien = within(screen.getByRole('note', { name: /sommaire/i })).getByRole('link', { name: /Mode d'emploi du sommaire/ });
    expect(lien.getAttribute('href')).toBe('/modes-emploi/referents-plai.html#sommaire');
  });

  it("direction : mode d'emploi des directions", () => {
    roleCourant.role = 'direction';
    rendre();
    const lien = within(screen.getByRole('note', { name: /sommaire/i })).getByRole('link', { name: /Mode d'emploi du sommaire/ });
    expect(lien.getAttribute('href')).toBe('/modes-emploi/directions.html#sommaire');
  });

  it("agent accompagnant : il ne peut pas créer de sommaire, la note le renvoie vers les référents, directions et administrateurs", () => {
    roleCourant.role = 'agent_plai';
    rendre();
    const note = screen.getByRole('note', { name: /sommaire/i });
    expect(note.textContent).toMatch(/Nouveau/);
    expect(note.textContent).toMatch(/référents PLAI, les directions et les administrateurs peuvent créer un sommaire/);
    expect(note.textContent).toMatch(/adressez-vous à eux/);
    expect(within(note).queryByRole('link')).toBeNull();
    expect(note.textContent).not.toMatch(/cochez au moins deux classes/);
  });

  it("la note ne s'imprime pas", () => {
    rendre();
    expect(screen.getByRole('note', { name: /sommaire/i }).className).toContain('no-print');
  });
});
