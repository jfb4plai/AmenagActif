import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);

const mutation = () => ({ mutate: vi.fn(), isPending: false, isError: false, isSuccess: false });
const MEMBRES = [
  { userId: 'u1', email: 'helene.dubois@ecole.be', nom: 'Hélène Dubois', role: 'referent_plai', ecoleId: 'e1', ecoleIds: ['e1'] },
  { userId: 'u2', email: 'paul.martin@ecole.be', nom: 'Paul Martin', role: 'direction', ecoleId: 'e1', ecoleIds: ['e1'] },
  { userId: 'u3', email: 'anne.leroy@ecole.be', nom: 'Anne Leroy', role: 'agent_plai', ecoleId: 'e2', ecoleIds: ['e2'] },
  { userId: 'u4', email: 'sans1@ecole.be', nom: 'Sans Un', role: 'direction', ecoleId: null, ecoleIds: [] },
  { userId: 'u5', email: 'sans2@ecole.be', nom: 'Sans Deux', role: 'referent_plai', ecoleId: null, ecoleIds: [] },
];
vi.mock('../../src/hooks/useMembres.js', () => ({
  useMembres: () => ({ data: MEMBRES, isLoading: false, error: null }),
  useMembresMutations: () => ({
    inviter: mutation(), changerRole: mutation(), retirer: mutation(), assignerEcole: mutation(), retirerEcole: mutation(),
  }),
}));
vi.mock('../../src/hooks/useAdmin.js', () => ({
  useEcoles: () => ({ data: [{ id: 'e1', nom: 'Athénée A' }, { id: 'e2', nom: 'Athénée B' }] }),
}));

const { default: MembresTab } = await import('../../src/pages/administration/MembresTab.jsx');

describe('MembresTab : recherche, filtre, alerte, aide', () => {
  it('affiche le compteur complet au chargement', () => {
    render(<MembresTab />);
    expect(screen.getByText('5 comptes affichés sur 5')).toBeTruthy();
  });

  it('la recherche réduit la liste, met à jour le compteur et masque les écoles sans résultat', () => {
    render(<MembresTab />);
    fireEvent.change(screen.getByLabelText('Rechercher un compte'), { target: { value: 'dubois' } });
    expect(screen.getByText('1 compte affiché sur 5')).toBeTruthy();
    expect(screen.getByText('helene.dubois@ecole.be')).toBeTruthy();
    expect(screen.queryByText('paul.martin@ecole.be')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Athénée A' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Athénée B' })).toBeNull();
  });

  it('le filtre de rôle Direction ne garde que les directions', () => {
    render(<MembresTab />);
    fireEvent.change(screen.getByLabelText('Filtrer par rôle'), { target: { value: 'direction' } });
    expect(screen.getByText('2 comptes affichés sur 5')).toBeTruthy();
    expect(screen.getByText('paul.martin@ecole.be')).toBeTruthy();
    expect(screen.getByText('sans1@ecole.be')).toBeTruthy();
    expect(screen.queryByText('helene.dubois@ecole.be')).toBeNull();
  });

  it('l alerte des comptes sans école reste affichée même si un filtre les masque', () => {
    render(<MembresTab />);
    const alerte = screen.getByRole('status');
    expect(alerte.textContent).toBe('2 comptes sans école assignée (à corriger)');
    fireEvent.change(screen.getByLabelText('Rechercher un compte'), { target: { value: 'dubois' } });
    expect(screen.queryByText('sans1@ecole.be')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('2 comptes sans école assignée (à corriger)');
  });

  it('aide courte visible et détail des rôles dans un details fermé par défaut', () => {
    render(<MembresTab />);
    expect(screen.getByText(/Chaque compte a un rôle/)).toBeTruthy();
    const details = screen.getByText('Comprendre les rôles').closest('details');
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
    expect(details.textContent).toMatch(/Agent accompagnant/);
  });

  it('les champs de recherche et de rôle ont label, placeholder et texte d aide', () => {
    render(<MembresTab />);
    const recherche = screen.getByLabelText('Rechercher un compte');
    expect(recherche.getAttribute('placeholder')).toBe('Adresse ou nom, ex. dubois');
    expect(screen.getByText('Tapez une partie de l\'adresse ou du nom. Les groupes sans résultat disparaissent.')).toBeTruthy();
    expect(screen.getByLabelText('Filtrer par rôle')).toBeTruthy();
  });
});
