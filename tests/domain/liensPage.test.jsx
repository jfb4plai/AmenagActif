import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
// jsdom n'implémente pas showModal : simulation minimale de l'ouverture.
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };

const revoquerMutate = vi.fn().mockResolvedValue({});
const LIENS_BASE = [];
const SOMMAIRES = [
    { id: 'l3', ecole_id: 'e1', mode: 'sommaire', numero: 42, annee_id: 'a1', classe_ids: ['c1', 'c2'], destinataire: 'M. Leroy, sciences', classes: ['1A', '1B'], cree_le: '2026-09-01T00:00:00Z', cree_par: null, expire_le: '2027-08-31', revoque_le: null, derniere_ouverture: null, nb_ouvertures: 0, statut: 'actif' },
    { id: 'l4', ecole_id: 'e1', mode: 'sommaire', numero: 43, annee_id: 'a1', classe_ids: ['c1'], destinataire: 'Mme Revoquee, histoire', classes: ['1A'], cree_le: '2026-09-01T00:00:00Z', cree_par: null, expire_le: '2027-08-31', revoque_le: '2026-09-20T00:00:00Z', derniere_ouverture: null, nb_ouvertures: 0, statut: 'revoque' },
];
const donnees = {
  ecoles: [{ id: 'e1', nom: 'Athénée A', implantation: '4012', implantation_nom: 'Site Centre' }, { id: 'e2', nom: 'Athénée B', implantation: null, implantation_nom: null }],
  liens: [
    { id: 'l1', ecole_id: 'e1', mode: 'fusion', destinataire: 'Mme Dupont, français, 3e TQ B', classes: ['3TQB'], cree_le: '2026-09-01T00:00:00Z', cree_par: 'ref@ecole.be', expire_le: '2027-08-31', revoque_le: null, derniere_ouverture: '2026-09-10T00:00:00Z', nb_ouvertures: 3, statut: 'actif' },
    { id: 'l2', ecole_id: 'e1', mode: 'fusion', destinataire: 'M. Martin, maths', classes: ['2A'], cree_le: '2026-09-01T00:00:00Z', cree_par: null, expire_le: '2027-08-31', revoque_le: '2026-09-20T00:00:00Z', derniere_ouverture: null, nb_ouvertures: 0, statut: 'revoque' },
  ],
};
LIENS_BASE.push(...donnees.liens);
vi.mock('../../src/hooks/useLiens.js', () => ({
  useLiens: () => ({ data: donnees, isLoading: false, error: null }),
  useRevoquerLien: () => ({ mutateAsync: revoquerMutate, reset: vi.fn(), isPending: false, error: null }),
  useDefinirClasses: () => ({ mutateAsync: vi.fn().mockResolvedValue({ ok: true }), reset: vi.fn(), isPending: false, error: null }),
}));
const grille = { classes: [{ id: 'c1', nom: '1A', niveau: '1re' }, { id: 'c2', nom: '1B', niveau: '1re' }] };
vi.mock('../../src/hooks/useEcoleGrid.js', () => ({
  useEcoleGrid: () => ({ data: { classes: grille.classes }, isLoading: false }),
}));

const { default: LiensEnseignants } = await import('../../src/pages/LiensEnseignants.jsx');

describe('page Liens enseignants', () => {
  beforeEach(() => { donnees.liens = [...LIENS_BASE]; });
  const avecSommaires = () => { donnees.liens = [...SOMMAIRES, ...LIENS_BASE]; };

  it('sections par implantation, tableau avec en-têtes de colonnes, statut en toutes lettres', () => {
    render(<LiensEnseignants />);
    expect(screen.getAllByText(/Site Centre \(FASE 4012\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Athénée B/).length).toBeGreaterThan(0);
    const tableau = screen.getByRole('table');
    expect(within(tableau).getAllByRole('columnheader').length).toBe(6);
    expect(within(tableau).getByText('Actif')).toBeTruthy();
  });

  it('liens révoqués et expirés masqués par défaut ; visibles via le filtre Statut', () => {
    render(<LiensEnseignants />);
    expect(screen.queryByText(/M\. Martin/)).toBeNull();
    expect(screen.queryByText('Révoqué')).toBeNull();
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'tous' } });
    expect(screen.getAllByText(/M\. Martin/).length).toBeGreaterThan(0);
    expect(screen.getByText('Révoqué')).toBeTruthy();
  });

  it('les ouvertures ne sont pas affichées par défaut, seulement via « Détails » ligne par ligne', () => {
    render(<LiensEnseignants />);
    expect(screen.queryByText(/Ouvertures/)).toBeNull();
    expect(screen.queryByText(/Dernière ouverture/)).toBeNull();
    expect(screen.queryByText('Jamais ouvert')).toBeNull();
    const bouton = screen.getByRole('button', { name: /Détails du lien de Mme Dupont/ });
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(bouton);
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/Dernière ouverture/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(bouton);
    expect(screen.queryByText(/Dernière ouverture/)).toBeNull();
  });

  it('un lien révoqué n\'offre plus de bouton Révoquer ; le lien actif oui', () => {
    render(<LiensEnseignants />);
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'tous' } });
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
    expect(screen.getAllByText(/M\. Martin/).length).toBeGreaterThan(0);
  });

  it('le repérage des liens non ouverts est masqué par défaut, filtre désactivé à la fermeture', () => {
    render(<LiensEnseignants />);
    expect(screen.queryByLabelText(/Inactifs depuis plus de/)).toBeNull();
    const bouton = screen.getByRole('button', { name: /Relancer : repérer les liens non ouverts/ });
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(bouton);
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    // avec un seuil démesuré, plus aucun lien n'est « inactif » : le filtre est bien appliqué
    fireEvent.click(screen.getByLabelText(/Inactifs depuis plus de/));
    fireEvent.change(screen.getByLabelText(/Nombre de jours d'inactivité/), { target: { value: '100000' } });
    expect(screen.queryByText(/Mme Dupont/)).toBeNull();
    fireEvent.click(bouton);
    expect(screen.getAllByText(/Mme Dupont/).length).toBeGreaterThan(0);
  });

  it('une ligne sommaire affiche le nom composé et « Modifier les classes » ; fusion et révoqué non', () => {
    avecSommaires();
    render(<LiensEnseignants />);
    expect(screen.getAllByText(/Super lien SL-0042 \(créé le .*\) · Site Centre \(FASE 4012\) · M\. Leroy, sciences · 2 classes/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Modifier les classes/ })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'tous' } });
    expect(screen.getAllByRole('button', { name: /Modifier les classes/ })).toHaveLength(1);
    expect(screen.getAllByText(/Super lien SL-0043/).length).toBeGreaterThan(0);
  });

  it('« Modifier les classes » ouvre le dialogue avec les classes du lien cochées', () => {
    avecSommaires();
    render(<LiensEnseignants />);
    fireEvent.click(screen.getByRole('button', { name: /Modifier les classes/ }));
    expect(screen.getByRole('checkbox', { name: '1A' }).checked).toBe(true);
  });

  it("grille vide : pas de dialogue, message d'erreur", () => {
    avecSommaires();
    const avant = grille.classes;
    grille.classes = [];
    try {
      render(<LiensEnseignants />);
      fireEvent.click(screen.getByRole('button', { name: /Modifier les classes/ }));
      expect(document.querySelector('dialog[aria-labelledby="dlgc-titre"]')).toBeNull();
      expect(screen.getByRole('alert').textContent).toBe('Impossible de charger les classes de cette implantation.');
    } finally { grille.classes = avant; }
  });

  it('le paragraphe « Un lien, un seul enseignant » mentionne le sommaire', () => {
    render(<LiensEnseignants />);
    expect(screen.getByText(/un sommaire qui regroupe, pour un même enseignant, l'accès à la fiche de chacune de ses classes/)).toBeTruthy();
  });
});
