import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { validerTitreChapitre } from '../../src/domain/renommerChapitre.js';
import RenommerChapitre from '../../src/components/RenommerChapitre.jsx';

describe('validerTitreChapitre', () => {
  it('refuse vide et inchangé', () => {
    expect(validerTitreChapitre({ titre: '  ', ancien: 'A' }).ok).toBe(false);
    expect(validerTitreChapitre({ titre: 'A', ancien: 'A' }).ok).toBe(false);
  });
  it("refuse le titre d'un autre chapitre (casse, accents, espaces)", () => {
    expect(validerTitreChapitre({ titre: ' supports  ', ancien: 'B', autresTitres: ['Supports'] }).ok).toBe(false);
    expect(validerTitreChapitre({ titre: 'Évaluation', ancien: 'B', autresTitres: ['evaluation'] }).ok).toBe(false);
  });
  it('accepte et nettoie', () => {
    expect(validerTitreChapitre({ titre: '  Supports   écrits ', ancien: 'Supports', autresTitres: ['Oral'] })).toEqual({ ok: true, titre: 'Supports écrits' });
  });
});

describe('RenommerChapitre', () => {
  afterEach(cleanup);
  const chapitre = { id: 'ch1', titre: 'Supports' };
  const champ = () => screen.getByLabelText('Nouveau titre du chapitre');

  it('est pré-rempli, envoie le titre puis se ferme', async () => {
    const onRenommer = vi.fn().mockResolvedValue();
    const onFermer = vi.fn();
    render(<RenommerChapitre chapitre={chapitre} autresTitres={['Oral']} onRenommer={onRenommer} onFermer={onFermer} />);
    expect(champ().value).toBe('Supports');
    fireEvent.change(champ(), { target: { value: 'Supports écrits' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(onRenommer).toHaveBeenCalledWith('Supports écrits'));
    await waitFor(() => expect(onFermer).toHaveBeenCalled());
  });

  it("n'envoie rien pour un doublon", () => {
    const onRenommer = vi.fn();
    render(<RenommerChapitre chapitre={chapitre} autresTitres={['Oral']} onRenommer={onRenommer} onFermer={() => {}} />);
    fireEvent.change(champ(), { target: { value: 'oral' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(onRenommer).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/s'intitule déjà/);
  });

  it("affiche l'erreur renvoyée par la base et reste ouvert", async () => {
    const onFermer = vi.fn();
    const onRenommer = vi.fn().mockRejectedValue(new Error('Renommage impossible (droits insuffisants ou chapitre introuvable).'));
    render(<RenommerChapitre chapitre={chapitre} autresTitres={[]} onRenommer={onRenommer} onFermer={onFermer} />);
    fireEvent.change(champ(), { target: { value: 'Autre' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/droits insuffisants/));
    expect(onFermer).not.toHaveBeenCalled();
  });
});
