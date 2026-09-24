// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.AMENAG_TOKEN_SECRET = 'secret-de-test-au-moins-32-caracteres-xx';

const CLASSE = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  verifierAccesClasses: vi.fn(),
  loadClasseData: vi.fn(),
}));

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ supabaseAdmin: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('../../api/_lib/ficheData.js', () => ({
  verifierAccesClasses: mocks.verifierAccesClasses,
  loadClasseData: mocks.loadClasseData,
  loadClassesData: vi.fn(),
}));

const { default: profilHandler } = await import('../../api/profil-classe.js');
const { default: ficheHandler } = await import('../../api/fiche-token.js');
const { signFicheToken, signProfilToken, verifyProfilToken } = await import('../../api/_lib/jwt.js');

function reponse() {
  const r = { headers: {}, statusCode: 0, body: undefined };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const donnees = () => ({
  classe: { niveau: '3e' },
  contexte: { classeNom: '3LA', ecoleNom: 'Athénée de test', anneeLibelle: '2026-2027' },
  eleves: [{ id: 'e1', prenom: 'Emilie', initiale_nom: 'D', commentaire: 'secret', statut: 'IPT' }],
  amenagements: [{ id: 'a1', chapitre_id: 'c1', ordre: 1, libelle: 'Mise en page', type: 'AU', code: 'ar_supports_mise_en_page' }],
  chapitres: [{ id: 'c1', ordre: 1, titre: '1. SUPPORTS', code: 'supports' }],
  auClasse: [{ amenagement_id: 'a1', cree_le: '2026-09-01T08:00:00Z' }],
  selectionsAR: [],
  libres: [],
  referents: [{ nom: 'Carole Mona', fonction: 'referent_plai' }],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  mocks.verifierAccesClasses.mockResolvedValue(true);
  mocks.loadClasseData.mockResolvedValue(donnees());
});

describe('api/profil-classe : émission (POST)', () => {
  it('refuse sans authentification (401)', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, name: 'AuthApiError' } });
    const r = reponse();
    await profilHandler({ method: 'POST', headers: {}, body: { classeId: CLASSE } }, r);
    expect(r.statusCode).toBe(401);
  });

  it("panne du service d'authentification : 500, pas 401", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthRetryableFetchError' } });
    const r = reponse();
    await profilHandler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { classeId: CLASSE } }, r);
    expect(r.statusCode).toBe(500);
  });

  it("refuse (403) si le contrôle d'accès à la classe échoue, et l'appelle bien", async () => {
    mocks.verifierAccesClasses.mockResolvedValue(false);
    const r = reponse();
    await profilHandler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { classeId: CLASSE } }, r);
    expect(r.statusCode).toBe(403);
    expect(mocks.verifierAccesClasses).toHaveBeenCalledWith(expect.anything(), USER, [CLASSE]);
  });

  it("refuse un classeId qui n'est pas un UUID (400)", async () => {
    const r = reponse();
    await profilHandler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { classeId: 'pas-un-uuid' } }, r);
    expect(r.statusCode).toBe(400);
  });

  it("émet un jeton d'audience profil, avec jti, no-store", async () => {
    const r = reponse();
    await profilHandler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { classeId: CLASSE } }, r);
    expect(r.statusCode).toBe(200);
    expect(r.headers['Cache-Control']).toBe('private, no-store');
    const v = await verifyProfilToken(r.body.token);
    expect(v.classeId).toBe(CLASSE);
    expect(v.jti).toBeTruthy();
    expect(v.exp).toBeGreaterThan(Date.now() / 1000);
  });
});

describe('api/profil-classe : lecture (GET)', () => {
  it("renvoie le profil recalculé côté serveur, sans donnée d'élève", async () => {
    const token = await signProfilToken({ classeId: CLASSE });
    const r = reponse();
    await profilHandler({ method: 'GET', headers: { authorization: `Bearer ${token}` } }, r);
    expect(r.statusCode).toBe(200);
    expect(r.headers['Cache-Control']).toBe('private, no-store');
    expect(r.body.schema).toBe('plai.profil-classe');
    expect(r.body.au[0].code).toBe('ar_supports_mise_en_page');
    const brut = JSON.stringify(r.body);
    for (const interdit of ['Emilie', 'secret', 'Carole', 'IPT']) expect(brut).not.toContain(interdit);
    expect(mocks.loadClasseData).toHaveBeenCalledWith(CLASSE);
  });

  it('un jeton de FICHE ne sert pas ici (mauvais aud : 401)', async () => {
    const jetonFiche = await signFicheToken({ classeId: CLASSE });
    const r = reponse();
    await profilHandler({ method: 'GET', headers: { authorization: `Bearer ${jetonFiche}` } }, r);
    expect(r.statusCode).toBe(401);
    expect(mocks.loadClasseData).not.toHaveBeenCalled();
  });

  it('sans jeton, jeton falsifié ou expiré : 401', async () => {
    const r0 = reponse();
    await profilHandler({ method: 'GET', headers: {} }, r0);
    expect(r0.statusCode).toBe(401);
    const bon = await signProfilToken({ classeId: CLASSE });
    const r1 = reponse();
    await profilHandler({ method: 'GET', headers: { authorization: `Bearer ${bon.slice(0, -3)}abc` } }, r1);
    expect(r1.statusCode).toBe(401);
    const expire = await signProfilToken({ classeId: CLASSE, joursValide: -1 });
    const r2 = reponse();
    await profilHandler({ method: 'GET', headers: { authorization: `Bearer ${expire}` } }, r2);
    expect(r2.statusCode).toBe(401);
  });

  it('panne base : 500 distinct du 401', async () => {
    mocks.loadClasseData.mockRejectedValue(Object.assign(new Error('x'), { code: 'PGRST301' }));
    const token = await signProfilToken({ classeId: CLASSE });
    const r = reponse();
    await profilHandler({ method: 'GET', headers: { authorization: `Bearer ${token}` } }, r);
    expect(r.statusCode).toBe(500);
  });
});

describe('api/fiche-token : un jeton de profil ne sert pas de jeton de fiche (inverse)', () => {
  it('401 si on présente un jeton de profil', async () => {
    const jetonProfil = await signProfilToken({ classeId: CLASSE });
    const r = reponse();
    await ficheHandler({ method: 'GET', headers: {}, query: { token: jetonProfil } }, r);
    expect(r.statusCode).toBe(401);
    expect(mocks.loadClasseData).not.toHaveBeenCalled();
  });

  it('un jeton de fiche historique (sans aud) reste accepté', async () => {
    const jetonFiche = await signFicheToken({ classeId: CLASSE });
    const r = reponse();
    await ficheHandler({ method: 'GET', headers: {}, query: { token: jetonFiche } }, r);
    expect(r.statusCode).toBe(200);
    expect(r.body.vm).toBeTruthy();
  });
});

describe('api/fiche-token : validation des entrées (POST)', () => {
  const post = async (body) => {
    const r = reponse();
    await ficheHandler({ method: 'POST', headers: { authorization: 'Bearer x' }, body }, r);
    return r;
  };
  it('plus de 10 classes : 400', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`);
    expect((await post({ classeIds: ids })).statusCode).toBe(400);
  });
  it('identifiant non UUID : 400', async () => {
    expect((await post({ classeId: 'abc' })).statusCode).toBe(400);
  });
  it('nomGroupe > 60 caractères : 400', async () => {
    expect((await post({ classeIds: [CLASSE, '33333333-3333-4333-8333-333333333333'], nomGroupe: 'x'.repeat(61) })).statusCode).toBe(400);
  });
  it('cas valide : 200 avec un jeton de fiche', async () => {
    const r = await post({ classeId: CLASSE });
    expect(r.statusCode).toBe(200);
    expect(r.body.url).toContain('/fiche/');
  });
  it("panne de l'auth : 500, pas 401", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthRetryableFetchError' } });
    expect((await post({ classeId: CLASSE })).statusCode).toBe(500);
  });
});
