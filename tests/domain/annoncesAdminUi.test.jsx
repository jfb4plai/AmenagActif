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

describe('AnnoncesAdmin : détail du test', () => {
  it('liste les administrateurs visés, accepté ou refusé, et signale les comptes sans adresse', async () => {
    etat.data = donnees();
    etat.mutateAsync.mockResolvedValue({
      envoyes: 1, echecs: 1, sansAdresse: 1,
      detail: [{ adresse: 'jf@x.be', ok: true }, { adresse: 'helene@x.be', ok: false }],
    });
    render(<AnnoncesAdmin />);
    remplir();
    fireEvent.click(screen.getByRole('button', { name: /exemplaire de test/ }));
    expect(await screen.findByText(/jf@x\.be : accepté par Brevo/)).toBeTruthy();
    expect(screen.getByText('helene@x.be : refusé, non envoyé')).toBeTruthy();
    expect(screen.getByText(/1 compte administrateur sans adresse lisible : non joint\./)).toBeTruthy();
  });

  it('envoi réel : aucune liste d\'adresses affichée', async () => {
    etat.data = donnees();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    etat.mutateAsync.mockResolvedValue({ envoyes: 14, echecs: 0 });
    render(<AnnoncesAdmin />);
    remplir();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer à 14 comptes' }));
    await screen.findByText('Message envoyé à 14 personnes.');
    expect(screen.queryByText(/Administrateurs visés/)).toBeNull();
  });
});

describe('AnnoncesAdmin : boutons de mise en forme et aperçu', () => {
  const champ = () => screen.getByLabelText('Message');
  const choisir = (debut, fin) => { champ().focus(); champ().setSelectionRange(debut, fin); };

  it('aperçu vide au départ, puis le rendu final du texte saisi (gras, titre, puce, lien)', () => {
    etat.data = donnees();
    render(<AnnoncesAdmin />);
    expect(screen.getByText(/L'aperçu apparaît ici/)).toBeTruthy();
    fireEvent.change(champ(), { target: { value: 'Bonjour **tous**\n\n## Titre\n\n- un\n- deux\n\nVoir https://exemple.be' } });
    const apercu = screen.getByTestId('apercu-annonce');
    expect(apercu.querySelector('strong').textContent).toBe('tous');
    expect(apercu.querySelector('h3').textContent).toBe('Titre');
    expect(apercu.querySelectorAll('li')).toHaveLength(2);
    expect(apercu.querySelector('a').getAttribute('href')).toBe('https://exemple.be');
  });

  it('l\'aperçu n\'exécute jamais de HTML saisi', () => {
    etat.data = donnees();
    render(<AnnoncesAdmin />);
    fireEvent.change(champ(), { target: { value: '<img src=x onerror=alert(1)> <script>alert(2)</script>' } });
    const apercu = screen.getByTestId('apercu-annonce');
    expect(apercu.querySelector('img')).toBeNull();
    expect(apercu.querySelector('script')).toBeNull();
    expect(apercu.textContent).toContain('<script>');
  });

  it('Gras sur la sélection ; Puce sur la ligne ; Titre ; Lien : le champ et l\'aperçu suivent', () => {
    etat.data = donnees();
    render(<AnnoncesAdmin />);
    fireEvent.change(champ(), { target: { value: 'Bonjour tout le monde' } });
    choisir(8, 12);
    fireEvent.click(screen.getByRole('button', { name: 'Mettre la sélection en gras' }));
    expect(champ().value).toBe('Bonjour **tout** le monde');
    expect(screen.getByTestId('apercu-annonce').querySelector('strong').textContent).toBe('tout');

    fireEvent.change(champ(), { target: { value: 'un\ndeux' } });
    choisir(0, 7);
    fireEvent.click(screen.getByRole('button', { name: 'Transformer les lignes en puces' }));
    expect(champ().value).toBe('- un\n- deux');
    expect(screen.getByTestId('apercu-annonce').querySelectorAll('li')).toHaveLength(2);

    fireEvent.change(champ(), { target: { value: 'Ce qui change' } });
    choisir(0, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Faire de la ligne un intertitre' }));
    expect(champ().value).toBe('## Ce qui change');
    expect(screen.getByTestId('apercu-annonce').querySelector('h3').textContent).toBe('Ce qui change');

    fireEvent.change(champ(), { target: { value: 'Voir ' } });
    choisir(5, 5);
    fireEvent.click(screen.getByRole('button', { name: 'Insérer une adresse https://' }));
    expect(champ().value).toBe('Voir https://');
  });

  it('la barre d\'outils est nommée ; un bouton qui dépasserait 5000 caractères n\'ajoute rien', () => {
    etat.data = donnees();
    render(<AnnoncesAdmin />);
    expect(screen.getByRole('toolbar', { name: 'Mise en forme du message' })).toBeTruthy();
    fireEvent.change(champ(), { target: { value: 'x'.repeat(5000) } });
    choisir(5000, 5000);
    fireEvent.click(screen.getByRole('button', { name: 'Mettre la sélection en gras' }));
    expect(champ().value).toHaveLength(5000);
  });
});
