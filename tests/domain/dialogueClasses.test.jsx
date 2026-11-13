import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import DialogueClasses from '../../src/components/DialogueClasses.jsx';

afterEach(cleanup);
// jsdom n'implémente pas showModal : simulation minimale de l'ouverture.
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };

const classes = [
  { id: 'c1', nom: '5A', niveau: '5e' },
  { id: 'c2', nom: '5B', niveau: '5e' },
  { id: 'c3', nom: '6A', niveau: '6e' },
];
const lien = { id: 'l1', classe_ids: ['c1', 'c3'] };
const jsx = (props = {}) => (
  <DialogueClasses lien={lien} classes={classes} enCours={false} erreur={null} onEnregistrer={vi.fn()} onAnnuler={vi.fn()} {...props} />
);
const rendre = (props) => render(jsx(props));

describe('DialogueClasses', () => {
  it('cases cochées = lien.classe_ids, regroupées par niveau', () => {
    rendre();
    expect(screen.getByRole('checkbox', { name: '5A' }).checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: '5B' }).checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: '6A' }).checked).toBe(true);
    expect(within(screen.getByRole('group', { name: '5e' })).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(screen.getByRole('group', { name: '6e' })).getAllByRole('checkbox')).toHaveLength(1);
  });

  it('22 classes : 22 cases, « Tout cocher 5e » coche toutes les classes de ce niveau et seulement elles', () => {
    const beaucoup = Array.from({ length: 22 }, (_, i) => ({ id: `x${i}`, nom: `C${i}`, niveau: i < 11 ? '5e' : '6e' }));
    rendre({ classes: beaucoup, lien: { id: 'l1', classe_ids: ['x15'] } });
    expect(screen.getAllByRole('checkbox')).toHaveLength(22);
    fireEvent.click(screen.getByRole('button', { name: 'Tout cocher 5e' }));
    expect(screen.getAllByRole('checkbox').filter((c) => c.checked)).toHaveLength(12); // 11 du 5e + x15 (6e) déjà cochée
    expect(screen.getByRole('checkbox', { name: 'C0' }).checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'C10' }).checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'C11' }).checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Tout décocher 5e' }));
    expect(screen.getByRole('checkbox', { name: 'C0' }).checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'C15' }).checked).toBe(true);
  });

  it('impossible de tout décocher : Enregistrer désactivé et message explicite', () => {
    rendre({ lien: { id: 'l1', classe_ids: ['c1'] } });
    const bouton = screen.getByRole('button', { name: 'Enregistrer' });
    expect(bouton.disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: '5A' }));
    expect(bouton.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe('Un sommaire doit garder au moins une classe. Pour le supprimer, révoquez-le.');
  });

  it('Enregistrer appelle onEnregistrer avec les ids cochés ; l\'erreur du serveur est affichée dans le dialogue', () => {
    const onEnregistrer = vi.fn();
    const { rerender } = rendre({ onEnregistrer });
    fireEvent.click(screen.getByRole('checkbox', { name: '5B' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '6A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onEnregistrer).toHaveBeenCalledWith(['c1', 'c2']);
    rerender(jsx({ onEnregistrer, erreur: 'Lien révoqué.' }));
    expect(screen.getByRole('alert').textContent).toBe('Lien révoqué.');
  });

  it('Annuler et Échap appellent onAnnuler', () => {
    const onAnnuler = vi.fn();
    rendre({ onAnnuler });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    fireEvent(document.querySelector('dialog'), new Event('cancel', { cancelable: true }));
    expect(onAnnuler).toHaveBeenCalledTimes(2);
  });
});
