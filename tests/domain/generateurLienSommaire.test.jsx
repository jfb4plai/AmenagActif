import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/lib/supabase.js', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock('../../src/lib/copierLien.js', () => ({ copierLien: vi.fn() }));

const { supabase } = await import('../../src/lib/supabase.js');
const { copierLien } = await import('../../src/lib/copierLien.js');
const { default: GenerateurLien } = await import('../../src/components/GenerateurLien.jsx');
const { default: ChoixModeLien } = await import('../../src/components/ChoixModeLien.jsx');

const AVERTISSEMENT = "Ce lien ouvre toutes les classes listées. Ne le transmettez qu'à l'enseignant concerné.";

beforeEach(() => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'jeton' } } });
  copierLien.mockResolvedValue('ok');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function simulerFetch(corps) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => corps });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function soumettre() {
  fireEvent.change(screen.getByLabelText(/Destinataire du lien/), { target: { value: 'A., français 5PA' } });
  fireEvent.click(screen.getByRole('button', { name: /Générer et copier le lien/ }));
}

describe('ChoixModeLien', () => {
  it('deux options, la valeur courante cochée, onChange appelé avec sommaire', () => {
    const onChange = vi.fn();
    render(<ChoixModeLien mode="fusion" onChange={onChange} nbClasses={3} />);
    const fusion = screen.getByRole('radio', { name: /Une seule fiche fusionnée/ });
    const sommaire = screen.getByRole('radio', { name: /Un sommaire : une fiche par classe/ });
    expect(fusion.checked).toBe(true);
    expect(sommaire.checked).toBe(false);
    fireEvent.click(sommaire);
    expect(onChange).toHaveBeenCalledWith('sommaire');
  });
});

describe('GenerateurLien en mode sommaire', () => {
  it('le corps du POST contient mode sommaire et 22 classeIds, sans nomGroupe ; SL-0042 est affiché', async () => {
    const ids = Array.from({ length: 22 }, (_, i) => `c${i}`);
    const fetchMock = simulerFetch({ url: 'https://x.test/f/abc', expire_le: '2027-06-30', numero: 42 });
    render(<GenerateurLien classeIds={ids} mode="sommaire" libelle="x" />);
    await soumettre();
    await waitFor(() => expect(screen.getByText(/SL-0042/)).toBeTruthy());
    const corps = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corps.mode).toBe('sommaire');
    expect(corps.classeIds).toHaveLength(22);
    expect('nomGroupe' in corps).toBe(false);
  });

  it("l'avertissement exact est affiché en mode sommaire", () => {
    render(<GenerateurLien classeIds={['c1', 'c2']} mode="sommaire" libelle="x" avertissement={AVERTISSEMENT} />);
    expect(screen.getByRole('note').textContent).toBe(AVERTISSEMENT);
  });
});

describe('GenerateurLien sans mode', () => {
  it('le corps pour une fusion porte mode fusion et pas de numéro affiché', async () => {
    const fetchMock = simulerFetch({ url: 'https://x.test/f/abc', expire_le: '2027-06-30' });
    render(<GenerateurLien classeIds={['c1', 'c2']} nomGroupe="Atelier" libelle="x" />);
    await soumettre();
    await waitFor(() => expect(screen.getByText(/Lien copié/)).toBeTruthy());
    const corps = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corps.mode).toBe('fusion');
    expect(corps.nomGroupe).toBe('Atelier');
    expect(screen.queryByText(/SL-/)).toBeNull();
  });
});

describe('GenerateurLien remonté sous une nouvelle clé (changement de sélection)', () => {
  it('oublie le lien généré et le destinataire', async () => {
    simulerFetch({ url: 'https://x.test/f/abc', expire_le: '2027-06-30', numero: 42 });
    const rendu = (ids) => (
      <GenerateurLien key={`sommaire:${[...ids].sort().join(",")}`} classeIds={ids} mode="sommaire" libelle="x" />
    );
    const { rerender } = render(rendu(['c1', 'c2']));
    await soumettre();
    await waitFor(() => expect(screen.getByText(/SL-0042/)).toBeTruthy());
    rerender(rendu(['c1', 'c2', 'c3']));
    expect(screen.queryByText(/SL-0042/)).toBeNull();
    expect(screen.getByLabelText(/Destinataire du lien/).value).toBe('');
  });
});
