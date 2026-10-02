import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ChangerClasse from '../../src/components/saisie/ChangerClasse.jsx';

const TITRE = 'Dispositif de régulation des comportements';
const eleve = { id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D' };
const cibles = {
  classes: [
    { id: 'c1', nom: '4A', niveau: '4e', ecole_id: 's1' },
    { id: 'c2', nom: '4B', niveau: '4e', ecole_id: 's1' },
    { id: 'c3', nom: '5C', niveau: '5e', ecole_id: 's2' },
  ],
  modes: [{ classe_id: 'c2', chapitre_id: 'd1', pour_toute_la_classe: true }],
};
const ecoles = [{ id: 's1', nom: 'Athénée A' }, { id: 's2', nom: 'Athénée B' }];
const donnees = {
  chapitres: [{ id: 'd1', titre: TITRE, est_dispositif: true }],
  amenagements: [{ id: 'x1', chapitre_id: 'd1', type: 'AR' }],
  selectionsAR: [], libres: [],
};

function rendre(props = {}) {
  const onChanger = props.onChanger ?? vi.fn().mockResolvedValue(undefined);
  render(<ChangerClasse eleve={eleve} cibles={cibles} ecoles={ecoles} ecoleId="s1" donnees={{ ...donnees, ...props.donnees }} onChanger={onChanger} onFait={props.onFait} />);
  return onChanger;
}
const choisir = (v) => fireEvent.change(screen.getByLabelText('Nouvelle classe'), { target: { value: v } });

beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ChangerClasse', () => {
  it("propose les autres classes, celles de l'implantation d'abord, sans la classe actuelle", () => {
    rendre();
    const select = screen.getByLabelText('Nouvelle classe');
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(options.join('|')).toContain('4B (4e)');
    expect(options.join('|')).toContain('5C (5e)');
    expect(options.join('|')).not.toContain('4A');
    expect(select.querySelectorAll('optgroup')).toHaveLength(2);
  });

  it("refuse (message + bouton désactivé) si l'élève a des cases dans un dispositif appliqué à toute la classe d'arrivée", () => {
    const onChanger = rendre({ donnees: { selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }] } });
    choisir('c2');
    expect(screen.getByRole('alert').textContent).toContain(TITRE);
    const bouton = screen.getByRole('button', { name: 'Changer de classe' });
    expect(bouton.disabled).toBe(true);
    fireEvent.click(bouton);
    expect(onChanger).not.toHaveBeenCalled();
  });

  it('affiche une note (non bloquante) quand un dispositif de classe devient individuel', () => {
    const cibles2 = { ...cibles, modes: [{ classe_id: 'c1', chapitre_id: 'd1', pour_toute_la_classe: true }] };
    render(<ChangerClasse eleve={eleve} cibles={cibles2} ecoles={ecoles} ecoleId="s1" donnees={donnees} onChanger={vi.fn()} />);
    choisir('c2');
    // seul c1 (classe de départ) est en AU : le dispositif devient individuel à l'arrivée
    expect(screen.getByRole('note').textContent).toContain('élève par élève');
    expect(screen.getByRole('button', { name: 'Changer de classe' }).disabled).toBe(false);
  });

  it('confirme puis appelle onChanger avec la classe choisie', async () => {
    const onFait = vi.fn();
    const onChanger = rendre({ onFait });
    choisir('c3');
    fireEvent.click(screen.getByRole('button', { name: 'Changer de classe' }));
    await waitFor(() => expect(onChanger).toHaveBeenCalledWith('c3'));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(onFait).toHaveBeenCalled());
  });

  it("n'appelle rien si la confirmation est refusée", () => {
    window.confirm.mockReturnValue(false);
    const onChanger = rendre();
    choisir('c3');
    fireEvent.click(screen.getByRole('button', { name: 'Changer de classe' }));
    expect(onChanger).not.toHaveBeenCalled();
  });

  it("affiche l'erreur traduite quand la base refuse", async () => {
    const onChanger = vi.fn().mockRejectedValue({ code: '42501', message: 'droit_insuffisant' });
    rendre({ onChanger });
    choisir('c3');
    fireEvent.click(screen.getByRole('button', { name: 'Changer de classe' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('administrateur'));
  });
});
