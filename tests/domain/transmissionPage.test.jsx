import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

afterEach(cleanup);
// jsdom n'implémente pas showModal : simulation minimale de l'ouverture.
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };

const mutate = vi.fn().mockResolvedValue(1);
const donnees = {
  chapitres: [
    { id: 'c1', ordre: 1, titre: '1. SUPPORTS', code: 'supports' },
    { id: 'c2', ordre: 2, titre: '2. COMMUNICATION ORALE', code: 'communication_orale' },
  ],
  amenagements: [
    { id: 'a1', chapitre_id: 'c1', ordre: 1, libelle: 'Mise en page', type: 'AU', actif: true, code: 'ar_supports_mise_en_page', partage_profil: true },
    { id: 'a2', chapitre_id: 'c1', ordre: 2, libelle: 'Rédiger le cours en braille', type: 'AR', actif: true, code: 'ar_supports_cours_braille', partage_profil: false },
    { id: 'a3', chapitre_id: 'c2', ordre: 1, libelle: 'Laisser un temps de réflexion', type: 'AR', actif: true, code: 'ar_communication_orale_temps', partage_profil: false },
  ],
};
vi.mock('../../src/hooks/useAdmin.js', () => ({
  useCatalogueAdmin: () => ({ data: donnees, isLoading: false, error: null }),
  useCatalogueMutations: () => ({ majPartageProfil: { mutateAsync: mutate } }),
}));

const { default: TransmissionProfil } = await import('../../src/pages/TransmissionProfil.jsx');
const rendu = () => render(<MemoryRouter><TransmissionProfil /></MemoryRouter>);

describe('écran Transmission aux autres apps', () => {
  it('compteur en toutes lettres et explication en tête', () => {
    rendu();
    expect(screen.getByTestId('compteur').textContent).toBe('1 transmis, 2 non transmis');
    expect(screen.getByText(/généré automatiquement/)).toBeTruthy();
    expect(screen.getByText(/non appliqué automatiquement/)).toBeTruthy();
  });

  it('sections repliables ; tableau avec en-têtes de colonnes et de lignes ; état énoncé en texte', () => {
    rendu();
    const bouton = screen.getByRole('button', { name: /1\. SUPPORTS/ });
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(bouton);
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    const tableau = screen.getByRole('table');
    expect(within(tableau).getAllByRole('columnheader').length).toBe(3);
    expect(within(tableau).getAllByRole('rowheader').length).toBe(2);
    expect(within(tableau).getByText('Transmis')).toBeTruthy();
    expect(within(tableau).getByText('Non transmis')).toBeTruthy();
  });

  it('un clic enregistre immédiatement et affiche le retour', async () => {
    mutate.mockClear();
    rendu();
    fireEvent.click(screen.getByRole('button', { name: /1\. SUPPORTS/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Non transmis : Rédiger le cours en braille/ }));
    await waitFor(() => expect(mutate).toHaveBeenCalledWith({ id: 'a2', valeur: true }));
    await screen.findByText('Enregistré');
  });

  it('une erreur est affichée, jamais silencieuse', async () => {
    mutate.mockRejectedValueOnce(new Error('droits insuffisants'));
    rendu();
    fireEvent.click(screen.getByRole('button', { name: /1\. SUPPORTS/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Transmis : Mise en page/ }));
    const alerte = await screen.findByText(/Échec de l'enregistrement : droits insuffisants/, { selector: 'span' });
    expect(alerte.getAttribute('role')).toBe('alert');
  });

  it('filtre « Non transmis seulement » : masque les éléments transmis et les chapitres sans reste', () => {
    rendu();
    fireEvent.click(screen.getByLabelText('Non transmis seulement'));
    fireEvent.click(screen.getByRole('button', { name: /1\. SUPPORTS/ }));
    expect(screen.queryByText('Mise en page')).toBeNull();
    expect(screen.getByText('Rédiger le cours en braille')).toBeTruthy();
  });

  it('« Tout transmettre » passe par une boîte de dialogue de confirmation', async () => {
    mutate.mockClear();
    rendu();
    fireEvent.click(screen.getByRole('button', { name: /1\. SUPPORTS/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tout transmettre' }));
    expect(mutate).not.toHaveBeenCalled();
    const dlg = document.querySelector('dialog');
    expect(dlg.getAttribute('aria-labelledby')).toBe('lot-titre');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(mutate).toHaveBeenCalledWith({ chapitreId: 'c1', valeur: true }));
  });
});
