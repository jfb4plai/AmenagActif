import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DialogueClasses from '../../src/components/DialogueClasses.jsx';
import SommairePublic from '../../src/components/SommairePublic.jsx';
import { nomSommaire } from '../../src/domain/liens.js';

afterEach(cleanup);
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };

const classes = [{ id: 'c1', nom: '3LA', niveau: '3e' }, { id: 'c2', nom: '3LB', niveau: '3e' }, { id: 'c3', nom: '5PA', niveau: '5e' }];
const fiches = [{ id: 'f1', nom: 'Atelier cuisine', classeIds: ['c1', 'c2'] }, { id: 'f2', nom: 'Salle', classeIds: ['c1', 'c3'] }];
const lien = { id: 'l1', destinataire: 'A., cuisine', classe_ids: ['c3'] };

describe('DialogueClasses avec fiches groupées', () => {
  it('liste les fiches groupées avec leurs classes, cochées comme dans le sommaire ; envoie classes ET fiches groupées', () => {
    const onEnregistrer = vi.fn();
    render(<DialogueClasses lien={lien} classes={classes} classeIdsInitiales={['c3']} fichesGroupees={fiches} fgIdsInitiales={['f1']}
      enCours={false} erreur={null} onEnregistrer={onEnregistrer} onAnnuler={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Modifier le contenu du sommaire' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Atelier cuisine/ }).checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: /Salle/ }).checked).toBe(false);
    expect(screen.getByText('(3LA + 3LB)')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Salle/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onEnregistrer).toHaveBeenCalledWith(['c3'], ['f1', 'f2']);
  });

  it('un sommaire peut ne garder que des fiches groupées ; vide = refusé avec le message adapté', () => {
    const onEnregistrer = vi.fn();
    render(<DialogueClasses lien={lien} classes={classes} classeIdsInitiales={['c3']} fichesGroupees={fiches} fgIdsInitiales={['f1']}
      enCours={false} erreur={null} onEnregistrer={onEnregistrer} onAnnuler={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: '5PA' }));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onEnregistrer).toHaveBeenCalledWith([], ['f1']);
    fireEvent.click(screen.getByRole('checkbox', { name: /Atelier cuisine/ }));
    expect(screen.getByRole('alert').textContent).toBe('Un sommaire doit garder au moins une classe ou une fiche groupée. Pour le supprimer, révoquez-le.');
    expect(screen.getByRole('button', { name: 'Enregistrer' }).disabled).toBe(true);
  });

  it('sans fiche groupée dans l\'école : comportement inchangé (onEnregistrer(ids) seul)', () => {
    const onEnregistrer = vi.fn();
    render(<DialogueClasses lien={lien} classes={classes} classeIdsInitiales={['c3']} enCours={false} erreur={null} onEnregistrer={onEnregistrer} onAnnuler={vi.fn()} />);
    expect(screen.queryByText('Fiches groupées')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onEnregistrer).toHaveBeenCalledWith(['c3']);
  });
});

describe('SommairePublic avec fiches groupées', () => {
  const sommaire = {
    numero: 12, ecole: { nom: 'Athénée', implantation_nom: 'Site Centre' },
    classes: [{ id: 'c1', nom: '3LA', niveau: '3e' }],
    fichesGroupees: [{ id: 'f1', nom: 'Atelier cuisine', classes: ['3LA', '3LB'] }],
  };
  const rendre = (s) => render(<MemoryRouter><SommairePublic sommaire={s} token="tok" /></MemoryRouter>);

  it('une entrée par fiche groupée (vers /groupe/) puis une par classe (vers /classe/)', () => {
    rendre(sommaire);
    const fg = screen.getByRole('link', { name: 'Fiche groupée : Atelier cuisine (3LA + 3LB)' });
    expect(fg.getAttribute('href')).toBe('/fiche/tok/groupe/f1');
    expect(screen.getByRole('link', { name: '3LA — 3e' }).getAttribute('href')).toBe('/fiche/tok/classe/c1');
    const liens = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(liens.indexOf('/fiche/tok/groupe/f1')).toBeLessThan(liens.indexOf('/fiche/tok/classe/c1'));
  });

  it('sommaire sans classe mais avec une fiche groupée : pas de message « aucune classe »', () => {
    rendre({ ...sommaire, classes: [] });
    expect(screen.queryByText(/Aucune classe n'est rattachée/)).toBeNull();
    expect(screen.getByRole('link', { name: /Atelier cuisine/ })).toBeTruthy();
  });

  it('sommaire sans fiche groupée (ancien format de réponse) : inchangé', () => {
    const { fichesGroupees, ...ancien } = sommaire;
    rendre(ancien);
    expect(screen.getByRole('link', { name: '3LA — 3e' })).toBeTruthy();
  });
});

describe('nomSommaire', () => {
  const base = { numero: 12, cree_le: '2026-11-20', ecole: { nom: 'Athénée' }, destinataire: 'A., cuisine' };
  it('compte les fiches groupées à côté des classes', () => {
    expect(nomSommaire({ ...base, nbClasses: 2, nbFichesGroupees: 1 })).toContain('2 classes + 1 fiche groupée');
    expect(nomSommaire({ ...base, nbClasses: 2 })).toMatch(/· 2 classes$/);
  });
});
