import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

afterEach(cleanup);

let classes = { data: [] };
let annee = { id: 'a1', libelle: '2026-2027', active: true };
const appels = [];
vi.mock('../../src/hooks/useNiveauxEcoles.js', () => ({
  useNiveauxEcoles: (ecoleIds, anneeId) => { appels.push([ecoleIds, anneeId]); return classes; },
}));
vi.mock('../../src/hooks/useAdmin.js', () => ({ useAnneeActive: () => annee }));

const { default: NiveauxDirection } = await import('../../src/pages/administration/NiveauxDirection.jsx');

const membre = (extra = {}) => ({ userId: 'u2', email: 'p@ecole.be', nom: 'Paul', role: 'direction', ecoleId: 'e1', ecoleIds: ['e1'], niveaux: [], ...extra });
const rendre = (m, enregistrement = 'idle') => {
  const onChange = vi.fn();
  render(<NiveauxDirection membre={m} onChange={onChange} enregistrement={enregistrement} />);
  return onChange;
};

describe('NiveauxDirection', () => {
  it('liste une case par niveau dans un fieldset nommé, cochée selon membre.niveaux', () => {
    classes = { data: ['3e', '4e', '4e', '5e'] };
    rendre(membre({ niveaux: ['4e'] }));
    const groupe = screen.getByRole('group', { name: 'Apparaît sur les fiches des classes de niveau' });
    const cases = within(groupe).getAllByRole('checkbox');
    expect(cases.map((c) => c.checked)).toEqual([false, true, false]);
    expect(screen.getByLabelText('4e').checked).toBe(true);
  });

  it('cocher appelle onChange avec les niveaux enregistrés plus celui-ci', () => {
    classes = { data: ['3e', '4e'] };
    const onChange = rendre(membre({ niveaux: ['4e'] }));
    fireEvent.click(screen.getByLabelText('3e'));
    expect(onChange).toHaveBeenCalledWith(['3e', '4e']);
  });

  it('décocher la dernière appelle onChange([])', () => {
    classes = { data: ['3e', '4e'] };
    const onChange = rendre(membre({ niveaux: ['4e'] }));
    fireEvent.click(screen.getByLabelText('4e'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('une valeur enregistrée absente des classes reste cochée et signalée', () => {
    classes = { data: ['3e'] };
    rendre(membre({ niveaux: ['6e'] }));
    expect(screen.getByLabelText(/6e/).checked).toBe(true);
    expect(screen.getByText('(absent des classes actuelles)')).toBeTruthy();
  });

  it('5e et 5E donnent deux cases', () => {
    classes = { data: ['5e', '5E'] };
    rendre(membre());
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('aucune case cochée : message toutes classes', () => {
    classes = { data: ['3e'] };
    rendre(membre());
    expect(screen.getByText('Aucun niveau coché : apparaît sur toutes les classes.')).toBeTruthy();
  });

  it('case cochée et 2 classes sans niveau : avertissement', () => {
    classes = { data: ['3e', null, ''] };
    rendre(membre({ niveaux: ['3e'] }));
    expect(screen.getByText("2 classes sans niveau : cette direction n'y apparaît pas.")).toBeTruthy();
  });

  it('état ok : Enregistré dans un status', () => {
    classes = { data: ['3e'] };
    rendre(membre(), 'ok');
    expect(screen.getByRole('status').textContent).toBe('Enregistré');
  });

  it('état erreur : message dans un alert', () => {
    classes = { data: ['3e'] };
    rendre(membre(), 'erreur');
    expect(screen.getByRole('alert').textContent).toBe('Enregistrement impossible, réessayez.');
  });

  it('sans école de rattachement : aucune classe à proposer, pas de case', () => {
    classes = { data: [] };
    rendre(membre({ ecoleId: null, ecoleIds: [] }));
    expect(screen.getByText('Aucune classe à proposer pour le moment.')).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('sans année active : aucune classe à proposer, pas de case', () => {
    classes = { data: [] };
    const avant = annee;
    annee = null;
    rendre(membre());
    annee = avant;
    expect(screen.getByText('Aucune classe à proposer pour le moment.')).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('écoles = union dédoublonnée de ecoleId et ecoleIds, année active transmise', () => {
    classes = { data: ['3e'] };
    appels.length = 0;
    rendre(membre({ ecoleId: 'e1', ecoleIds: ['e1', 'e2'] }));
    expect(appels[0]).toEqual([['e1', 'e2'], 'a1']);
  });
});
