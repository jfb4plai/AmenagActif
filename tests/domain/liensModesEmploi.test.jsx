import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../../src/components/Footer.jsx';
import ChangerClasse from '../../src/components/saisie/ChangerClasse.jsx';

afterEach(cleanup);

function verifierLienExterne(lien, href) {
  expect(lien.getAttribute('href')).toBe(href);
  expect(lien.getAttribute('target')).toBe('_blank');
  expect(lien.getAttribute('rel')).toContain('noopener');
}

describe('liens vers les modes d\'emploi', () => {
  it('le pied de page renvoie vers l\'index des modes d\'emploi, dans un nouvel onglet', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    verifierLienExterne(screen.getByRole('link', { name: /Modes d'emploi/ }), '/modes-emploi/index.html');
  });

  it('le bloc « Changer de classe » renvoie vers son mode d\'emploi, sans gêner le bouton d\'action', () => {
    const eleve = { id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D' };
    const cibles = { classes: [{ id: 'c1', nom: '4A', niveau: '4e', ecole_id: 's1' }, { id: 'c2', nom: '4B', niveau: '4e', ecole_id: 's1' }], modes: [] };
    render(<ChangerClasse eleve={eleve} cibles={cibles} ecoles={[{ id: 's1', nom: 'Athénée A' }]} ecoleId="s1"
      donnees={{ chapitres: [], amenagements: [], selectionsAR: [], libres: [] }} onChanger={() => Promise.resolve()} />);
    verifierLienExterne(screen.getByRole('link', { name: /Mode d'emploi du changement de classe/ }), '/modes-emploi/transfert-en-cours-d-annee.html');
    expect(screen.getByRole('button', { name: 'Changer de classe' })).toBeTruthy();
  });
});
