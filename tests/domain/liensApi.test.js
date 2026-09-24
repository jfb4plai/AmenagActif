// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from './fakeDb.js';

process.env.AMENAG_TOKEN_SECRET = 'secret-de-test-au-moins-32-caracteres-xx';

const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '11111111-1111-4111-8111-222222222222';
const C3 = '11111111-1111-4111-8111-333333333333'; // autre école
const C4 = '11111111-1111-4111-8111-444444444444'; // autre année
const U = { admin: 'u-admin', ref1: 'u-ref1', ref2: 'u-ref2', agent: 'u-agent' };

const mocks = vi.hoisted(() => ({ db: null, verifier: vi.fn(), loadClasseData: vi.fn(), loadClassesData: vi.fn() }));
vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ supabaseAdmin: () => mocks.db }));
vi.mock('../../api/_lib/ficheData.js', () => ({
  verifierAccesClasses: mocks.verifier,
  loadClasseData: mocks.loadClasseData,
  loadClassesData: mocks.loadClassesData,
}));

const { default: ficheHandler } = await import('../../api/fiche-token.js');
const { default: profilHandler } = await import('../../api/profil-classe.js');
const { default: liensHandler } = await import('../../api/liens.js');
const { signFicheToken, verifyProfilToken } = await import('../../api/_lib/jwt.js');
const { hasherSecret, MESSAGE_LIEN_INACTIF } = await import('../../api/_lib/liens.js');

function reponse() {
  const r = { headers: {}, statusCode: 0, body: undefined };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const donnees = () => ({
  classe: { niveau: '3e' },
  contexte: { classeNom: '3LA', ecoleNom: 'Athénée de test', anneeLibelle: '2098-2099' },
  eleves: [], amenagements: [], chapitres: [], auClasse: [], selectionsAR: [], libres: [], referents: [],
});

let tables;
let courant;
const connecte = (userKey) => { courant = U[userKey]; };
const auth = { authorization: 'Bearer x' };

/** Crée un lien via l'API réelle et renvoie son secret. */
async function creerVia(classeIds = [C1], extra = {}) {
  const r = reponse();
  await ficheHandler({ method: 'POST', headers: auth, body: { classeIds, destinataire: 'Mme Dupont, français, 3e TQ B', ...extra } }, r);
  expect(r.statusCode).toBe(200);
  return r.body;
}
const ligneLien = (secret) => tables.ar_liens.find((l) => l.token_hash === hasherSecret(secret));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  tables = {
    ar_annees: [{ id: 'an1', libelle: '2098-2099' }, { id: 'an2', libelle: '2097-2098' }],
    ar_ecoles: [{ id: 'ec1', nom: 'Athénée A', implantation: 'Site 1' }, { id: 'ec2', nom: 'Athénée B', implantation: null }],
    ar_classes: [
      { id: C1, nom: '3LA', ecole_id: 'ec1', annee_id: 'an1' },
      { id: C2, nom: '3LB', ecole_id: 'ec1', annee_id: 'an1' },
      { id: C3, nom: '4XA', ecole_id: 'ec2', annee_id: 'an1' },
      { id: C4, nom: '2ZA', ecole_id: 'ec1', annee_id: 'an2' },
    ],
    ar_profils_acces: [
      { user_id: U.admin, role: 'admin', ecole_id: null },
      { user_id: U.ref1, role: 'referent_plai', ecole_id: 'ec1' },
      { user_id: U.ref2, role: 'direction', ecole_id: 'ec2' },
      { user_id: U.agent, role: 'agent_plai', ecole_id: 'ec1' },
    ],
    ar_profils_acces_ecoles: [],
    ar_liens: [],
    ar_liens_classes: [],
  };
  mocks.db = fakeDb(tables, { users: { [U.ref1]: 'ref1@ecole.be', [U.ref2]: 'ref2@ecole.be', [U.admin]: 'admin@plai.be' } });
  mocks.db.auth.getUser = async () => ({ data: { user: { id: courant } }, error: null });
  courant = U.ref1;
  mocks.verifier.mockResolvedValue(true);
  mocks.loadClasseData.mockResolvedValue(donnees());
  mocks.loadClassesData.mockResolvedValue([donnees(), donnees()]);
});

describe('création : le secret n\'est ni stocké ni journalisé', () => {
  it('stocke uniquement le SHA-256 ; expire à la fin d\'année ; destinataire requis', async () => {
    const spies = ['log', 'info', 'warn', 'error'].map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    const { token, url, expire_le } = await creerVia([C1]);
    expect(expire_le).toBe('2099-08-31');
    expect(url).toContain(token);
    const ligne = ligneLien(token);
    expect(ligne.token_hash).toBe(hasherSecret(token));
    expect(ligne.expire_le).toBe('2099-08-31');
    expect(ligne.cree_par).toBe(U.ref1);
    expect(JSON.stringify(tables)).not.toContain(token);
    expect(JSON.stringify(spies.map((s) => s.mock.calls))).not.toContain(token);

    const r = reponse();
    await ficheHandler({ method: 'POST', headers: auth, body: { classeId: C1 } }, r);
    expect(r.statusCode).toBe(400);
    const r2 = reponse();
    await ficheHandler({ method: 'POST', headers: auth, body: { classeId: C1, destinataire: 'x'.repeat(81) } }, r2);
    expect(r2.statusCode).toBe(400);
  });

  it('refuse des classes de deux écoles ou de deux années (400)', async () => {
    for (const ids of [[C1, C3], [C1, C4]]) {
      const r = reponse();
      await ficheHandler({ method: 'POST', headers: auth, body: { classeIds: ids, destinataire: 'Mme X' } }, r);
      expect(r.statusCode).toBe(400);
      expect(r.body.error).toMatch(/même école et à la même année/);
    }
    expect(tables.ar_liens).toHaveLength(0);
  });

  it('accès refusé par verifierAccesClasses : 403, rien de créé', async () => {
    mocks.verifier.mockResolvedValue(false);
    const r = reponse();
    await ficheHandler({ method: 'POST', headers: auth, body: { classeId: C1, destinataire: 'Mme X' } }, r);
    expect(r.statusCode).toBe(403);
    expect(tables.ar_liens).toHaveLength(0);
  });
});

describe('lecture publique d\'un lien opaque', () => {
  const get = async (token) => {
    const r = reponse();
    await ficheHandler({ method: 'GET', headers: {}, query: { token } }, r);
    return r;
  };

  it('lien actif : 200, fiche vivante, ouverture comptée, pas de cache', async () => {
    const { token } = await creerVia([C1]);
    const r = await get(token);
    expect(r.statusCode).toBe(200);
    expect(r.body.vm).toBeTruthy();
    expect(r.headers['Cache-Control']).toBe('private, no-store');
    expect(mocks.loadClasseData).toHaveBeenCalledWith(C1);
    expect(mocks.db.journal.rpc).toEqual([{ fn: 'ar_lien_compter_ouverture', args: { p_id: ligneLien(token).id } }]);
  });

  it('lien groupé : charge toutes les classes du lien', async () => {
    const { token } = await creerVia([C1, C2], { nomGroupe: 'Atelier cuisine' });
    const r = await get(token);
    expect(r.statusCode).toBe(200);
    expect(mocks.loadClassesData).toHaveBeenCalledWith(expect.arrayContaining([C1, C2]));
  });

  it('révocation immédiate : 410 message générique, aucune donnée chargée', async () => {
    const { token } = await creerVia([C1]);
    ligneLien(token).revoque_le = '2026-09-24T10:00:00Z';
    mocks.loadClasseData.mockClear();
    const r = await get(token);
    expect(r.statusCode).toBe(410);
    expect(r.body.error).toBe(MESSAGE_LIEN_INACTIF);
    expect(mocks.loadClasseData).not.toHaveBeenCalled();
  });

  it('expiration à la date de fin d\'année : 410 le lendemain, actif le jour même', async () => {
    const { token } = await creerVia([C1]);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2099-08-31T12:00:00Z'));
      expect((await get(token)).statusCode).toBe(200);
      vi.setSystemTime(new Date('2099-09-01T12:00:00Z'));
      expect((await get(token)).statusCode).toBe(410);
    } finally { vi.useRealTimers(); }
  });

  it('forme inconnue, inexistant, révoqué : réponses IDENTIQUES (pas d\'oracle)', async () => {
    const { token } = await creerVia([C1]);
    ligneLien(token).revoque_le = '2026-09-24T10:00:00Z';
    const inexistant = 'A'.repeat(43);
    const r1 = await get('zzz');
    const r2 = await get(inexistant);
    const r3 = await get(token);
    for (const r of [r1, r2, r3]) expect(r.statusCode).toBe(410);
    expect(r1.body).toEqual(r3.body);
    expect(r2.body).toEqual(r3.body);
  });

  it('repli JWT inchangé : un ancien lien JWT reste valide, sans accès au compteur ni à ar_liens', async () => {
    const jwt = await signFicheToken({ classeId: C1 });
    const r = await get(jwt);
    expect(r.statusCode).toBe(200);
    expect(r.headers['Cache-Control']).toBe('private, max-age=60');
    expect(mocks.db.journal.rpc).toHaveLength(0);
    const r2 = await get(`${jwt.slice(0, -3)}abc`);
    expect(r2.statusCode).toBe(401);
  });

  it('une panne du compteur n\'empêche pas l\'affichage', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { token } = await creerVia([C1]);
    mocks.db.rpc = () => Promise.resolve({ data: null, error: { code: 'X' } });
    expect((await get(token)).statusCode).toBe(200);
  });
});

describe('profil-classe depuis un lien opaque', () => {
  const postLien = async (lien, classeId) => {
    const r = reponse();
    await profilHandler({ method: 'POST', headers: {}, body: { lien, classeId } }, r);
    return r;
  };
  const getProfil = async (token) => {
    const r = reponse();
    await profilHandler({ method: 'GET', headers: { authorization: `Bearer ${token}` } }, r);
    return r;
  };

  it('émet un jeton avec lid, plafonné à la fin de la période du lien', async () => {
    const { token } = await creerVia([C1]);
    const r = await postLien(token, C1);
    expect(r.statusCode).toBe(200);
    const v = await verifyProfilToken(r.body.token);
    expect(v.lid).toBe(ligneLien(token).id);
    expect(v.exp).toBeLessThanOrEqual(Math.floor(Date.parse('2099-08-31T23:59:59Z') / 1000));
    expect(v.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 30 * 86400);
  });

  it('plafond effectif : lien expirant dans 5 jours => jeton de 5 jours au plus', async () => {
    const { token } = await creerVia([C1]);
    const dans5 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    ligneLien(token).expire_le = dans5;
    const r = await postLien(token, C1);
    expect(r.statusCode).toBe(200);
    expect(r.body.expire_le).toBe(dans5);
    const v = await verifyProfilToken(r.body.token);
    expect(v.exp).toBeLessThanOrEqual(Math.floor(Date.parse(`${dans5}T23:59:59Z`) / 1000));
  });

  it('classe hors du lien : refusée, aucun jeton', async () => {
    const { token } = await creerVia([C1]);
    for (const hors of [C2, C3]) {
      const r = await postLien(token, hors);
      expect(r.statusCode).toBe(403);
      expect(r.body.token).toBeUndefined();
    }
  });

  it('lien inconnu, forme invalide ou révoqué : refusé', async () => {
    const { token } = await creerVia([C1]);
    ligneLien(token).revoque_le = '2026-09-24T10:00:00Z';
    expect((await postLien(token, C1)).statusCode).toBe(403);
    expect((await postLien('n-importe-quoi', C1)).statusCode).toBe(403);
    expect((await postLien('B'.repeat(43), C1)).statusCode).toBe(403);
  });

  it('la révocation du lien invalide un jeton de profil déjà émis (401 à la lecture suivante)', async () => {
    const { token } = await creerVia([C1]);
    const jetonProfil = (await postLien(token, C1)).body.token;
    expect((await getProfil(jetonProfil)).statusCode).toBe(200);
    ligneLien(token).revoque_le = '2026-09-24T10:00:00Z';
    mocks.loadClasseData.mockClear();
    expect((await getProfil(jetonProfil)).statusCode).toBe(401);
    expect(mocks.loadClasseData).not.toHaveBeenCalled();
  });

  it('un jeton de profil émis par un utilisateur connecté (sans lid) garde son comportement', async () => {
    const r = reponse();
    await profilHandler({ method: 'POST', headers: auth, body: { classeId: C1 } }, r);
    expect(r.statusCode).toBe(200);
    expect((await verifyProfilToken(r.body.token)).lid).toBeNull();
    expect((await getProfil(r.body.token)).statusCode).toBe(200);
  });
});

describe('api/liens : liste et révocation', () => {
  const liste = async (query = {}) => {
    const r = reponse();
    await liensHandler({ method: 'GET', headers: auth, query }, r);
    return r;
  };
  const revoquer = async (lien_id) => {
    const r = reponse();
    await liensHandler({ method: 'POST', headers: auth, body: { action: 'revoke', lien_id } }, r);
    return r;
  };
  let lienA; let lienB;
  beforeEach(async () => {
    connecte('ref1');
    lienA = await creerVia([C1]);
    tables.ar_liens.push({ id: 'lien-b', token_hash: 'HASH-SECRET-B', ecole_id: 'ec2', annee_id: 'an1', destinataire: 'M. Martin', nom_groupe: null, cree_par: U.ref2, cree_le: '2026-09-01T00:00:00Z', expire_le: '2099-08-31', revoque_le: null, derniere_ouverture: null, nb_ouvertures: 0 });
    lienB = 'lien-b';
  });

  it('agent_plai : refusé en lecture et en révocation', async () => {
    connecte('agent');
    expect((await liste()).statusCode).toBe(403);
    expect((await revoquer(ligneLien(lienA.token).id)).statusCode).toBe(403);
    expect(ligneLien(lienA.token).revoque_le).toBeFalsy();
    const idReel = '99999999-9999-4999-8999-999999999999';
    tables.ar_liens.push({ id: idReel, token_hash: 'h', ecole_id: 'ec1', annee_id: 'an1', destinataire: 'd', cree_par: U.ref1, cree_le: 'x', expire_le: '2099-08-31', revoque_le: null, nb_ouvertures: 0 });
    expect((await revoquer(idReel)).statusCode).toBe(403);
    expect(tables.ar_liens.find((l) => l.id === idReel).revoque_le).toBeNull();
  });

  it('liste : jamais de token_hash, destinataire + classes + statut + compteur', async () => {
    connecte('admin');
    const r = await liste();
    expect(r.statusCode).toBe(200);
    const brut = JSON.stringify(r.body);
    expect(brut).not.toContain('token_hash');
    expect(brut).not.toContain('HASH-SECRET-B');
    expect(brut).not.toContain(hasherSecret(lienA.token));
    const a = r.body.liens.find((l) => l.destinataire.startsWith('Mme Dupont'));
    expect(a).toMatchObject({ classes: ['3LA'], statut: 'actif', nb_ouvertures: 0, cree_par: 'ref1@ecole.be' });
    expect(r.body.ecoles.map((e) => e.id).sort()).toEqual(['ec1', 'ec2']);
  });

  it('référent : uniquement son école ; école étrangère demandée : 403', async () => {
    connecte('ref1');
    const r = await liste();
    expect(r.body.liens.map((l) => l.ecole_id)).toEqual(['ec1']);
    expect(r.body.ecoles.map((e) => e.id)).toEqual(['ec1']);
    expect((await liste({ ecole_id: '99999999-9999-4999-8999-000000000002' })).statusCode).toBe(403);
  });

  it('révocation : par le référent de l\'école, idempotente, sans suppression', async () => {
    connecte('ref1');
    const id = ligneLien(lienA.token).id;
    const r1 = await revoquer(id);
    expect(r1.statusCode).toBe(200);
    expect(r1.body.deja_revoque).toBe(false);
    const quand = ligneLien(lienA.token).revoque_le;
    expect(quand).toBeTruthy();
    expect(ligneLien(lienA.token).revoque_par).toBe(U.ref1);
    const r2 = await revoquer(id);
    expect(r2.statusCode).toBe(200);
    expect(r2.body.deja_revoque).toBe(true);
    expect(ligneLien(lienA.token).revoque_le).toBe(quand);
    expect(tables.ar_liens).toHaveLength(2);
    const r3 = await liste();
    expect(r3.body.liens.find((l) => l.id === id).statut).toBe('revoque');
  });

  it('un rôle scopé ne révoque pas un lien d\'une autre école (403) ; l\'admin le peut', async () => {
    connecte('ref1');
    const idB = '99999999-9999-4999-8999-999999999998';
    tables.ar_liens.find((l) => l.id === lienB).id = idB;
    expect((await revoquer(idB)).statusCode).toBe(403);
    expect(tables.ar_liens.find((l) => l.id === idB).revoque_le).toBeNull();
    connecte('admin');
    expect((await revoquer(idB)).statusCode).toBe(200);
    expect(tables.ar_liens.find((l) => l.id === idB).revoque_le).toBeTruthy();
  });

  it('lien introuvable : 404 ; action inconnue : 400 ; sans session : 401', async () => {
    connecte('ref1');
    expect((await revoquer('99999999-9999-4999-8999-999999999997')).statusCode).toBe(404);
    const r = reponse();
    await liensHandler({ method: 'POST', headers: auth, body: { action: 'delete', lien_id: 'x' } }, r);
    expect(r.statusCode).toBe(400);
    mocks.db.auth.getUser = async () => ({ data: { user: null }, error: { status: 401, name: 'AuthApiError' } });
    expect((await liste()).statusCode).toBe(401);
  });
});
