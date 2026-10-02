import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EleveEditor from '../../src/components/saisie/EleveEditor.jsx';

afterEach(cleanup);
const eleve = { id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D', commentaire: '', statut: 'PAR' };

describe('EleveEditor : avertissements et emplacement extra', () => {
  it("affiche chaque ligne d'avertissement dans un encadré identifié", () => {
    render(<EleveEditor eleve={eleve} onSave={vi.fn()} onClose={vi.fn()} avertissements={['Changement de classe le 3 octobre 2026.', '2 aménagements « à confirmer »']} />);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('Changement de classe');
    expect(note.textContent).toContain('2 aménagements « à confirmer »');
  });

  it("n'affiche aucun encadré sans avertissement", () => {
    render(<EleveEditor eleve={eleve} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('rend le contenu extra', () => {
    render(<EleveEditor eleve={eleve} onSave={vi.fn()} onClose={vi.fn()} extra={<p>bloc extra</p>} />);
    expect(screen.getByText('bloc extra')).toBeTruthy();
  });
});
