import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../src/lib/supabase.js', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock('../../src/lib/copierLien.js', () => ({ copierLien: vi.fn() }));

const { default: GenerateurLien } = await import('../../src/components/GenerateurLien.jsx');

afterEach(cleanup);

describe('GenerateurLien : avertissement avant envoi', () => {
  it("affiche l'avertissement fourni, sans bloquer la génération", () => {
    render(<GenerateurLien classeIds={['c1']} libelle="x" avertissement="3 aménagements « à confirmer » dans cette fiche (2 élèves)." />);
    expect(screen.getByRole('note').textContent).toContain('3 aménagements « à confirmer »');
    expect(screen.getByRole('button', { name: /Générer et copier le lien/ }).disabled).toBe(false);
  });

  it("n'affiche rien sans avertissement", () => {
    render(<GenerateurLien classeIds={['c1']} libelle="x" />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
