import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BandeauAConfirmer from '../../src/components/saisie/BandeauAConfirmer.jsx';
import BandeauAU from '../../src/components/saisie/BandeauAU.jsx';
import CarteDispositif from '../../src/components/saisie/CarteDispositif.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const eleves = [
  { id: 'e1', prenom: 'Léa', initiale_nom: 'M.' },
  { id: 'e2', prenom: 'Noah', initiale_nom: 'D.' },
];
const grilleVide = { selectionsAR: [], libres: [], auClasse: [] };
const grille = {
  selectionsAR: [
    { eleve_id: 'e1', amenagement_id: 'a1', a_confirmer: true },
    { eleve_id: 'e1', amenagement_id: 'a2', a_confirmer: true },
    { eleve_id: 'e2', amenagement_id: 'a1', a_confirmer: false },
  ],
  libres: [{ id: 'l1', eleve_id: 'e2', chapitre_id: 'ch1', texte: 'x', a_confirmer: true }],
  auClasse: [{ classe_id: 'c1', amenagement_id: 'au1', a_confirmer: true }],
};

describe('BandeauAConfirmer', () => {
  it('ne rend rien si aucun aménagement à confirmer', () => {
    const { container } = render(<BandeauAConfirmer eleves={eleves} grid={grilleVide} classeId="c1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le total, un bouton par élève concerné et « Tout confirmer »', () => {
    render(<BandeauAConfirmer eleves={eleves} grid={grille} classeId="c1" />);
    expect(screen.getByText(/4 aménagement\(s\) repris/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Confirmer Léa M\. \(2\)/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Confirmer Noah D\. \(1\)/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tout confirmer' })).toBeTruthy();
    expect(screen.getByText(/1 AU de la classe à confirmer/)).toBeTruthy();
  });

  it('n’affiche pas d’élève sans ligne à confirmer', () => {
    const g = { ...grille, libres: [] };
    render(<BandeauAConfirmer eleves={eleves} grid={g} classeId="c1" />);
    expect(screen.queryByRole('button', { name: /Confirmer Noah/ })).toBeNull();
  });

  it('les boutons appellent les callbacks', () => {
    const onConfirmerEleve = vi.fn();
    const onConfirmerClasse = vi.fn();
    render(<BandeauAConfirmer eleves={eleves} grid={grille} classeId="c1"
      onConfirmerEleve={onConfirmerEleve} onConfirmerClasse={onConfirmerClasse} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmer Léa/ }));
    expect(onConfirmerEleve).toHaveBeenCalledWith('e1');
    fireEvent.click(screen.getByRole('button', { name: 'Tout confirmer' }));
    expect(onConfirmerClasse).toHaveBeenCalledTimes(1);
  });

  it('désactive les boutons pendant une confirmation', () => {
    render(<BandeauAConfirmer eleves={eleves} grid={grille} classeId="c1" enCours />);
    expect(screen.getByRole('button', { name: 'Tout confirmer' }).disabled).toBe(true);
  });
});

describe('badge « à confirmer » des AU', () => {
  const classe = { id: 'c1', nom: '3A' };
  const chapitre = { id: 'ch1', ordre: 7, titre: '7. Dispositif test' };
  const entete = { mode: 'AU', peutBasculer: true, blocage: null, onBascule: () => {} };

  it('CarteDispositif : badge textuel sur l’item a_confirmer seulement', () => {
    const items = [
      { id: 'a1', ordre: 1, libelle: 'Temps majoré' },
      { id: 'a2', ordre: 2, libelle: 'Lecteur' },
    ];
    render(<CarteDispositif classe={classe} chapitre={chapitre} items={items}
      auClasse={[{ amenagement_id: 'a1', a_confirmer: true }, { amenagement_id: 'a2', a_confirmer: false }]}
      onToggle={() => {}} entete={entete} />);
    expect(screen.getAllByText(/à confirmer/)).toHaveLength(1);
    expect(screen.getByText('Temps majoré').parentElement.textContent).toContain('à confirmer');
  });

  it('BandeauAU : badge textuel sur l’AU a_confirmer', () => {
    const au = { id: 'au1', chapitre_id: 'ch1', ordre: 1, libelle: 'Police lisible' };
    render(<BandeauAU classe={classe} auCatalogue={[au]} chapitres={[chapitre]}
      auClasse={[{ amenagement_id: 'au1', a_confirmer: true }]} onToggle={() => {}} />);
    expect(screen.getByText(/à confirmer/)).toBeTruthy();
  });
});
