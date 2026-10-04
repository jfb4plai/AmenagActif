import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FichePublique from '../../src/pages/FichePublique.jsx';
import { computeFicheClasse } from '../../src/domain/projections/ficheClasse.js';
import * as f from '../../src/test/fixtures/sample.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function rendre(fetchImpl) {
  vi.stubGlobal('fetch', fetchImpl);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/f/jeton']}>
        <Routes><Route path="/f/:token" element={<FichePublique />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('fiche publique enseignant : guide', () => {
  it('propose le guide court dans un nouvel onglet quand la fiche s\'affiche', async () => {
    const vm = computeFicheClasse({
      classe: f.classe5LA, contexte: f.contexte, eleves: f.eleves, amenagements: f.amenagements, chapitres: f.chapitres,
      auClasse: f.auClasse, selectionsAR: f.selectionsAR, libres: f.libres, referents: f.referents,
    });
    rendre(vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ vm }) }));
    const lien = await screen.findByRole('link', { name: /Comment utiliser cette fiche/ });
    expect(lien.getAttribute('href')).toBe('/modes-emploi/enseignants.html');
    expect(lien.getAttribute('target')).toBe('_blank');
    expect(lien.getAttribute('rel')).toContain('noopener');
  });

  it('un lien inactif affiche le message de renvoi vers le référent', async () => {
    rendre(vi.fn().mockResolvedValue({ ok: false, status: 410, json: async () => ({}) }));
    expect(await screen.findByText(/Ce lien n'est plus actif/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Comment utiliser cette fiche/ })).toBeNull();
  });
});
