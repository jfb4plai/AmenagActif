import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const etat = vi.hoisted(() => ({ data: null, mutateAsync: vi.fn() }));
vi.mock('../../src/hooks/useAnnonces.js', () => ({
  useAnnonces: () => ({ data: etat.data, isLoading: false, error: null }),
  useEnvoyerAnnonce: () => ({ mutateAsync: etat.mutateAsync, isPending: false }),
}));
const { default: AnnoncesAdmin } = await import('../../src/components/AnnoncesAdmin.jsx');

const donnees = () => ({
  effectifs: { admin: 2, referent_plai: 5, direction: 3, agent_plai: 4 },
  annonces: [{ id: 'n1', sujet: 'AménagActif : trois nouveautés', roles: ['admin'], nb_destinataires: 14, nb_echecs: 0, envoye_le: '2026-11-19T10:00:00Z' }],
});
const remplir = () => {
  fireEvent.change(screen.getByLabelText("Objet de l'e-mail"), { target: { value: 'Point d\'attention' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Bonjour,\n\nTexte.' } });
};

describe('AnnoncesAdmin', () => {
  it('boutons désactivés tant que l\'objet et le message sont vides ; effectifs affichés par rôle ; historique', () => {
    etat.data = donnees();
    render(<AnnoncesAdmin />);
    expect(screen.getByRole('button', { name: /exemplaire de test/ }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Envoyer à 14 comptes' }).disabled).toBe(true);
    expect(screen.getByLabelText('Agents accompagnants (4)')).toBeTruthy();
    expect(screen.getByText('AménagActif : trois nouveautés')).toBeTruthy();
    expect(screen.getByText(/14 destinataires/)).toBeTruthy();
  });

  it('le modèle remplit objet et message ; décocher un type met à jour le total', () => {
    etat.data = donnees();
    render(<AnnoncesAdmin />);
    fireEvent.change(screen.getByLabelText("Partir d'un modèle"), { target: { value: 'nouveautes-2026-11-19' } });
    expect(screen.getByLabelText("Objet de l'e-mail").value).toBe('AménagActif : trois nouveautés');
    expect(screen.getByLabelText('Message').value).toContain('Fiche groupée dans un sommaire');
    fireEvent.click(screen.getByLabelText('Directions (3)'));
    expect(screen.getByRole('button', { name: 'Envoyer à 11 comptes' })).toBeTruthy();
  });

  it('test : envoi sans confirmation, avec les rôles cochés ; message de retour', async () => {
    etat.data = donnees();
    etat.mutateAsync.mockResolvedValue({ envoyes: 2, echecs: 0 });
    render(<AnnoncesAdmin />);
    remplir();
    fireEvent.click(screen.getByRole('button', { name: /exemplaire de test/ }));
    await waitFor(() => expect(etat.mutateAsync).toHaveBeenCalledWith({ action: 'test', sujet: "Point d'attention", corps: 'Bonjour,\n\nTexte.', roles: ['admin', 'referent_plai', 'direction', 'agent_plai'] }));
    expect(await screen.findByText(/Exemplaire de test envoyé à 2 administrateurs/)).toBeTruthy();
  });

  it('envoi réel : confirmation demandée avec le nombre ; refusée = rien envoyé ; acceptée = envoi', async () => {
    etat.data = donnees();
    etat.mutateAsync.mockResolvedValue({ envoyes: 14, echecs: 0 });
    const confirmer = vi.spyOn(window, 'confirm');
    render(<AnnoncesAdmin />);
    remplir();
    confirmer.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer à 14 comptes' }));
    expect(etat.mutateAsync).not.toHaveBeenCalled();
    expect(confirmer.mock.calls[0][0]).toMatch(/14 comptes/);
    confirmer.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer à 14 comptes' }));
    await waitFor(() => expect(etat.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ action: 'envoyer' })));
    expect(await screen.findByText('Message envoyé à 14 personnes.')).toBeTruthy();
    confirmer.mockRestore();
  });

  it('échecs d\'envoi signalés ; erreur serveur affichée', async () => {
    etat.data = donnees();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    etat.mutateAsync.mockResolvedValueOnce({ envoyes: 12, echecs: 2 });
    render(<AnnoncesAdmin />);
    remplir();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer à 14 comptes' }));
    expect(await screen.findByText(/2 échecs : ces personnes n'ont pas reçu le message/)).toBeTruthy();
    etat.mutateAsync.mockRejectedValueOnce(new Error('Ce message vient déjà de partir.'));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer à 14 comptes' }));
    expect(await screen.findByText('Ce message vient déjà de partir.')).toBeTruthy();
  });
});
