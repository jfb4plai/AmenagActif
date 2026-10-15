import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { validerNomClasse, messageErreurRenommage } from '../../src/domain/renommerClasse.js';
import RenommerClasse from '../../src/components/saisie/RenommerClasse.jsx';

describe('validerNomClasse', () => {
  it('refuse un nom vide', () => {
    expect(validerNomClasse({ nom: '   ', ancien: '5LA', autresNoms: [] }).ok).toBe(false);
  });
  it('refuse un nom inchangé', () => {
    expect(validerNomClasse({ nom: '5LA', ancien: '5LA' }).ok).toBe(false);
  });
  it('refuse un doublon exact ou proche (espaces, casse)', () => {
    expect(validerNomClasse({ nom: '5LA', ancien: '5LB', autresNoms: ['5LA'] }).ok).toBe(false);
    expect(validerNomClasse({ nom: '5 la', ancien: '5LB', autresNoms: ['5LA'] }).ok).toBe(false);
  });
  it('accepte et nettoie un nom valide', () => {
    expect(validerNomClasse({ nom: '  5  LB ', ancien: '5LA', autresNoms: ['6LA'] })).toEqual({ ok: true, nom: '5 LB' });
  });
});

describe('messageErreurRenommage', () => {
  it('distingue doublon, droits et autre', () => {
    expect(messageErreurRenommage({ code: '23505' })).toMatch(/déjà ce nom/);
    expect(messageErreurRenommage({ code: '42501' })).toMatch(/Droits insuffisants/);
    expect(messageErreurRenommage(new Error('x'))).toMatch(/Renommage impossible/);
  });
});

describe('RenommerClasse', () => {
  afterEach(cleanup);
  const classe = { id: 'c1', nom: '5LA' };
  const ouvrir = () => fireEvent.click(screen.getByText('Renommer la classe'));

  it('envoie le nouveau nom puis referme le formulaire', async () => {
    const onRenommer = vi.fn().mockResolvedValue();
    render(<RenommerClasse classe={classe} autresNoms={['6LA']} onRenommer={onRenommer} />);
    ouvrir();
    fireEvent.change(screen.getByLabelText('Nouveau nom de la classe'), { target: { value: '5LB' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(onRenommer).toHaveBeenCalledWith('5LB'));
    await waitFor(() => expect(screen.getByText('Renommer la classe')).toBeTruthy());
  });

  it("n'appelle pas la base pour un doublon et affiche le message", () => {
    const onRenommer = vi.fn();
    render(<RenommerClasse classe={classe} autresNoms={['6LA']} onRenommer={onRenommer} />);
    ouvrir();
    fireEvent.change(screen.getByLabelText('Nouveau nom de la classe'), { target: { value: '6la' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    expect(onRenommer).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/existe déjà/);
  });

  it("affiche l'erreur de droits renvoyée par la base", async () => {
    const onRenommer = vi.fn().mockRejectedValue({ code: '42501' });
    render(<RenommerClasse classe={classe} autresNoms={[]} onRenommer={onRenommer} />);
    ouvrir();
    fireEvent.change(screen.getByLabelText('Nouveau nom de la classe'), { target: { value: '5LB' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Droits insuffisants/));
  });
});
