import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FichePublique from '../../src/pages/FichePublique.jsx';
import { computeFicheClasse } from '../../src/domain/projections/ficheClasse.js';
import * as f from '../../src/test/fixtures/sample.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function rendre(fetchImpl, chemin) {
  vi.stubGlobal('fetch', fetchImpl);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/fiche/:token" element={<FichePublique />} />
          <Route path="/fiche/:token/classe/:classeId" element={<FichePublique />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rep = (body, ok = true, status = 200) => vi.fn().mockResolvedValue({ ok, status, json: async () => body });

const sommaire = (classes) => ({
  sommaire: {
    numero: 42,
    ecole: { nom: 'École X', implantation: '1234', implantation_nom: 'Implantation Sainte-Walburge' },
    classes,
  },
});

const vm = () => computeFicheClasse({
  classe: f.classe5LA, contexte: f.contexte, eleves: f.eleves, amenagements: f.amenagements, chapitres: f.chapitres,
  auClasse: f.auClasse, selectionsAR: f.selectionsAR, libres: f.libres, referents: f.referents,
});

describe('page publique du sommaire', () => {
  it('affiche titre, référence et un lien par classe dans l\'ordre reçu', async () => {
    rendre(rep(sommaire([
      { id: 'c-b', nom: '2B', niveau: 'S2' },
      { id: 'c-a', nom: '1A', niveau: 'S1' },
    ])), '/fiche/jeton');
    expect(await screen.findByRole('heading', { name: 'Vos classes — Implantation Sainte-Walburge' })).toBeTruthy();
    expect(screen.getByText(/Référence : SL-0042/)).toBeTruthy();
    const liens = screen.getAllByRole('link').filter((a) => a.getAttribute('href').includes('/classe/'));
    expect(liens.map((a) => a.getAttribute('href'))).toEqual(['/fiche/jeton/classe/c-b', '/fiche/jeton/classe/c-a']);
    expect(document.body.textContent).not.toMatch(/destinataire/i);
  });

  it('utilise le nom de l\'école sans nom d\'implantation', async () => {
    const s = sommaire([]);
    s.sommaire.ecole.implantation_nom = null;
    rendre(rep(s), '/fiche/jeton');
    expect(await screen.findByRole('heading', { name: 'Vos classes — École X' })).toBeTruthy();
  });

  it('affiche les liens vers le catalogue et le mode d\'emploi', async () => {
    rendre(rep(sommaire([{ id: 'c1', nom: '1A', niveau: 'S1' }])), '/fiche/jeton');
    const cat = await screen.findByRole('link', { name: /liste complète des aménagements/ });
    expect(cat.getAttribute('href')).toBe('/catalogue-amenagements');
    expect(cat.getAttribute('target')).toBe('_blank');
    expect(cat.getAttribute('rel')).toContain('noopener');
    const guide = screen.getByRole('link', { name: /Comment utiliser cette fiche/ });
    expect(guide.getAttribute('href')).toBe('/modes-emploi/enseignants.html');
    expect(guide.getAttribute('target')).toBe('_blank');
    expect(guide.getAttribute('rel')).toContain('noopener');
  });

  it('sommaire vide : message de renvoi, aucun lien de classe', async () => {
    rendre(rep(sommaire([])), '/fiche/jeton');
    expect(await screen.findByText("Aucune classe n'est rattachée pour le moment. Contactez votre référent.")).toBeTruthy();
    expect(screen.queryAllByRole('link').filter((a) => a.getAttribute('href').includes('/classe/'))).toHaveLength(0);
  });

  it('la fiche d\'une classe depuis le sommaire propose « Retour à mes classes »', async () => {
    const fetchMock = rep({ vm: vm(), depuisSommaire: true });
    rendre(fetchMock, '/fiche/jeton/classe/c1');
    const retour = await screen.findByRole('link', { name: 'Retour à mes classes' });
    expect(retour.getAttribute('href')).toBe('/fiche/jeton');
    expect(retour.className).toContain('no-print');
    expect(fetchMock.mock.calls[0][0]).toContain('classe=c1');
  });

  it('sans depuisSommaire, pas de lien de retour', async () => {
    rendre(rep({ vm: vm() }), '/fiche/jeton/classe/c1');
    await screen.findByRole('link', { name: /Comment utiliser cette fiche/ });
    expect(screen.queryByRole('link', { name: 'Retour à mes classes' })).toBeNull();
  });

  it('410 : « Ce lien n\'est plus actif »', async () => {
    rendre(rep({}, false, 410), '/fiche/jeton');
    expect(await screen.findByText(/Ce lien n'est plus actif/)).toBeTruthy();
  });
});
