import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
// jsdom n'implémente pas showModal : simulation minimale de l'ouverture.
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };

const revoquerMutate = vi.fn().mockResolvedValue({});
const donnees = {
  ecoles: [{ id: 'e1', nom: 'Athénée A', implantation: '4012', implantation_nom: 'Site Centre' }, { id: 'e2', nom: 'Athénée B', implantation: null, implantation_nom: null }],
  liens: [
    { id: 'l1', ecole_id: 'e1', destinataire: 'Mme Dupont, français, 3e TQ B', classes: ['3TQB'], cree_le: '2026-09-01T00:00:00Z', cree_par: 'ref@ecole.be', expire_le: '2027-08-31', revoque_le: null, derniere_ouverture: '2026-09-10T00:00:00Z', nb_ouvertures: 3, statut: 'actif' },
    { id: 'l2', ecole_id: 'e1', destinataire: 'M. Martin, maths', classes: ['2A'], cree_le: '2026-09-01T00:00:00Z', cree_par: null, expire_le: '2027-08-31', revoque_le: '2026-09-20T00:00:00Z', derniere_ouverture: null, nb_ouvertures: 0, statut: 'revoque' },
  ],
};
vi.mock('../../src/hooks/useLiens.js', () => ({
  useLiens: () => ({ data: donnees, isLoading: false, error: null }),
  useRevoquerLien: () => ({ mutateAsync: revoquerMutate, reset: vi.fn(), isPending: false, error: null }),
}));

const { default: LiensEnseignants } = await import('../../src/pages/LiensEnseignants.jsx');

describe('page Liens enseignants', () => {
  it('sections par implantation, tableau avec en-têtes de colonnes, statut en toutes lettres', () => {
    render(<LiensEnseignants />);
    expect(screen.getAllByText(/Site Centre \(FASE 4012\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Athénée B/).length).toBeGreaterThan(0);
    const tableau = screen.getByRole('table');
    expect(within(tableau).getAllByRole('columnheader').length).toBe(8);
    expect(within(tableau).getByText('Actif')).toBeTruthy();
    expect(within(tableau).getByText('Révoqué')).toBeTruthy();
    expect(within(tableau).getByText('Jamais ouvert')).toBeTruthy();
  });

  it('un lien révoqué n\'offre plus de bouton Révoquer ; le lien actif oui', () => {
    render(<LiensEnseignants />);
    expect(screen.getAllByRole('button', { name: /Révoquer/ })).toHaveLength(1);
  });

  it('confirmation explicite avant révocation (boîte de dialogue, pas de confirm natif)', async () => {
    const confirmNatif = vi.spyOn(window, 'confirm');
    render(<LiensEnseignants />);
    fireEvent.click(screen.getByRole('button', { name: /Révoquer/ }));
    expect(screen.getByText('Révoquer ce lien ?')).toBeTruthy();
    expect(revoquerMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Révoquer le lien' }));
    expect(revoquerMutate).toHaveBeenCalledWith('l1');
    expect(confirmNatif).not.toHaveBeenCalled();
  });

  it('filtre par statut', () => {
    render(<LiensEnseignants />);
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'revoque' } });
    expect(screen.queryByText(/Mme Dupont/)).toBeNull();
    expect(screen.getByText(/M\. Martin/)).toBeTruthy();
  });
});
