import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// État partagé des hooks mockés. Les objets doivent rester stables entre rendus (useEffect sur [grid]).
const h = vi.hoisted(() => ({ role: 'referent_plai', cat: null, grid: null, mutate: null, mut: null }));

vi.mock('../../src/hooks/useCatalogue.js', () => ({ useCatalogue: () => ({ data: h.cat }) }));
vi.mock('../../src/hooks/useEcoleGrid.js', () => ({
  useEcoles: () => ({ data: [{ id: 's1', nom: 'Athénée X' }] }),
  useAnnees: () => ({ data: [{ id: 'y1', active: true }] }),
  useEcoleGrid: () => ({ data: h.grid, isLoading: false, error: null }),
}));
vi.mock('../../src/hooks/useGridMutations.js', () => ({ useGridMutations: () => h.mut }));
vi.mock('../../src/lib/auth.jsx', () => ({ useRole: () => ({ role: h.role, isAdmin: false }) }));

import SaisieEcole from '../../src/pages/SaisieEcole.jsx';

const chapitre = { id: 'd1', ordre: 13, titre: 'Dispositif de régulation', est_dispositif: true };
const amenagements = [
  { id: 'x1', chapitre_id: 'd1', ordre: 1, libelle: 'Coin calme', type: 'AR' },
  { id: 'x2', chapitre_id: 'd1', ordre: 2, libelle: 'Pause à la demande', type: 'AR' },
];

function installer({ modes = [], selectionsAR = [], libres = [], role = 'referent_plai' } = {}) {
  h.role = role;
  h.cat = { chapitres: [chapitre], amenagements };
  h.grid = {
    classes: [{ id: 'c1', nom: '5LA', niveau: '5e' }],
    eleves: [{ id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D' }],
    selectionsAR, auClasse: [], libres, modesDispositifs: modes,
  };
  h.mutate = vi.fn();
  const idle = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isError: false, isPending: false });
  h.mut = new Proxy({ basculerDispositif: { mutate: h.mutate, isError: false, isPending: false } }, {
    get: (t, k) => (k in t ? t[k] : (t[k] = idle())),
  });
}

function ouvrirClasse() {
  render(<MemoryRouter><SaisieEcole /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Classe'), { target: { value: 'c1' } });
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SaisieEcole : dispositifs', () => {
  it('(a) mode AR : en-tête du dispositif dans la grille et ligne récapitulative', () => {
    installer();
    ouvrirClasse();
    expect(screen.getByText('AR · par élève')).toBeTruthy();
    expect(screen.getByText('Dispositifs de cette classe')).toBeTruthy();
    expect(screen.getByText('AR (par élève)')).toBeTruthy();
    // le chapitre reste dans la grille (replié par défaut)
    expect(screen.getByRole('button', { name: /Dispositif de régulation/ })).toBeTruthy();
  });

  it('(b) mode AU : la carte apparaît et le chapitre quitte la grille', () => {
    installer({ modes: [{ classe_id: 'c1', chapitre_id: 'd1', pour_toute_la_classe: true }] });
    ouvrirClasse();
    expect(screen.getByText('AU · toute la classe')).toBeTruthy();
    expect(screen.queryByText('AR · par élève')).toBeNull();
    expect(screen.queryByRole('button', { name: /Dispositif de régulation/ })).toBeNull();
    // la carte porte l'ancre de la barre de saut
    expect(document.getElementById('chap-13').tagName).toBe('SECTION');
  });

  it('(c) bascule vers AU refusée si une case élève est cochée : alerte, pas de mutation', () => {
    installer({ selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }] });
    ouvrirClasse();
    fireEvent.click(screen.getByRole('radio', { name: /à toute la classe \(AU\)/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/1 élève a déjà/);
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it('(c bis) bascule vers AU refusée si un aménagement libre existe', () => {
    installer({ libres: [{ id: 'l1', eleve_id: 'e1', chapitre_id: 'd1', texte: 'Casque' }] });
    ouvrirClasse();
    fireEvent.click(screen.getByRole('radio', { name: /à toute la classe \(AU\)/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/libre/);
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it('(d) bascule vers AU sans case cochée : appelle la mutation', () => {
    installer();
    ouvrirClasse();
    fireEvent.click(screen.getByRole('radio', { name: /à toute la classe \(AU\)/ }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(h.mutate).toHaveBeenCalledWith({ classeId: 'c1', chapitreId: 'd1', pourToute: true });
  });

  it('(e) agent accompagnant : radios désactivées', () => {
    installer({ role: 'agent_plai' });
    ouvrirClasse();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    radios.forEach((r) => expect(r.disabled).toBe(true));
  });
});
