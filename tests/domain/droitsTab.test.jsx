import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import DroitsTab from '../../src/pages/administration/DroitsTab.jsx';
import { CAPACITES, ROLES, LIBELLE_ROLE } from '../../src/domain/droits.js';

afterEach(cleanup);

describe('Onglet Droits (lecture seule)', () => {
  it('affiche le h2 et le bandeau, avec le document de référence en texte simple', () => {
    const { container } = render(<DroitsTab />);
    expect(screen.getByRole('heading', { level: 2, name: 'Droits' })).toBeTruthy();
    expect(screen.getByText("Ce tableau décrit les droits actuels. Il n'est pas encore modifiable ici.")).toBeTruthy();
    expect(container.textContent).toContain('docs/permissions-roles.md');
    expect(container.querySelector('a')).toBeNull();
  });

  it('table avec légende sr-only, cinq en-têtes de colonne et une ligne par capacité', () => {
    render(<DroitsTab />);
    const table = screen.getByRole('table');
    const caption = table.querySelector('caption');
    expect(caption.className).toContain('sr-only');
    const cols = within(table).getAllByRole('columnheader');
    expect(cols).toHaveLength(5);
    cols.forEach((c) => expect(c.getAttribute('scope')).toBe('col'));
    ROLES.forEach((r) => expect(cols.map((c) => c.textContent)).toContain(LIBELLE_ROLE[r]));
    const rows = within(table).getAllByRole('rowheader');
    expect(rows).toHaveLength(CAPACITES.length);
    rows.forEach((h) => expect(h.getAttribute('scope')).toBe('row'));
    CAPACITES.forEach((c, i) => {
      expect(rows[i].textContent).toContain(c.libelle);
      expect(rows[i].textContent).toContain(c.effet);
    });
  });

  it('chaque cellule dit Oui, Non ou À confirmer en toutes lettres', () => {
    render(<DroitsTab />);
    const cellules = within(screen.getByRole('table')).getAllByRole('cell');
    expect(cellules).toHaveLength(CAPACITES.length * ROLES.length);
    cellules.forEach((c) => expect(['Oui', 'Non', 'À confirmer']).toContain(c.textContent));
    const attendu = CAPACITES.flatMap((c) => ROLES.map((r) => (c.roles[r] === true ? 'Oui' : c.roles[r] === false ? 'Non' : 'À confirmer')));
    expect(cellules.map((c) => c.textContent)).toEqual(attendu);
  });

  it('cadre du tableau : région focalisable nommée, défilable', () => {
    render(<DroitsTab />);
    const region = screen.getByRole('region', { name: 'Tableau des droits, défilable horizontalement' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.contains(screen.getByRole('table'))).toBe(true);
    expect(region.className).toContain('overflow-x-auto');
  });

  it('lecture seule : aucun champ ni bouton, et la preuve (développeurs) n\'est pas affichée', () => {
    const { container } = render(<DroitsTab />);
    expect(container.querySelector('input,select,textarea,button')).toBeNull();
    CAPACITES.forEach((c) => {
      expect(c.preuve.length).toBeGreaterThan(0);
      expect(container.textContent).not.toContain(c.preuve);
    });
  });
});
