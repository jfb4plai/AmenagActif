// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { texteVersHtml, validerAnnonce, envoyerAnnonce, destinataires, ErreurAnnonce } from '../../api/_lib/annonces.js';

const NOW = new Date('2026-11-19T10:00:00Z');

// Faux client minimal : ar_profils_acces (in role), ar_annonces (select eq/gte, insert), auth.admin.getUserById.
function faux({ profils, emails, annonces = [] }) {
  const journal = [];
  const table = (nom) => {
    let rows = nom === 'ar_profils_acces' ? profils : annonces;
    const filtres = [];
    const q = {
      select() { return q; },
      in(c, v) { filtres.push((r) => v.includes(r[c])); return q; },
      eq(c, v) { filtres.push((r) => r[c] === v); return q; },
      gte(c, v) { filtres.push((r) => String(r[c]) >= String(v)); return q; },
      insert: async (r) => { journal.push(r); annonces.push(r); return { error: null }; },
      then(ok) { return ok({ data: rows.filter((r) => filtres.every((f) => f(r))), error: null }); },
    };
    return q;
  };
  return { journal, from: table, auth: { admin: { getUserById: async (id) => ({ data: { user: emails[id] ? { email: emails[id] } : null } }) } } };
}
const monde = () => faux({
  profils: [
    { user_id: 'a1', role: 'admin' }, { user_id: 'a2', role: 'admin' },
    { user_id: 'r1', role: 'referent_plai' }, { user_id: 'd1', role: 'direction' },
    { user_id: 'g1', role: 'agent_plai' }, { user_id: 'g2', role: 'agent_plai' },
  ],
  emails: { a1: 'a1@x.be', a2: 'A2@x.be', r1: 'r1@x.be', d1: 'd1@x.be', g1: 'g1@x.be', g2: 'a1@x.be' }, // g2 partage l'adresse de a1
});
const base = { sujet: 'AménagActif : nouveautés', corps: 'Bonjour,\n\nTexte.', roles: ['admin', 'referent_plai', 'direction', 'agent_plai'], userId: 'a1' };

describe('texteVersHtml', () => {
  it('paragraphes, intertitre, liste, gras, lien https', () => {
    const h = texteVersHtml('Bonjour,\nligne 2\n\n## Titre\n\n- un **gras**\n- deux\n\nVoir https://exemple.be/a?b=1');
    expect(h).toContain('<p>Bonjour,<br>ligne 2</p>');
    expect(h).toContain('<h3>Titre</h3>');
    expect(h).toContain('<ul><li>un <strong>gras</strong></li><li>deux</li></ul>');
    expect(h).toContain('<a href="https://exemple.be/a?b=1">https://exemple.be/a?b=1</a>');
  });
  it('jamais de HTML saisi : tout est échappé', () => {
    const h = texteVersHtml('<script>alert(1)</script> & "x"\n\n- <img src=x onerror=1>');
    expect(h).not.toContain('<script>');
    expect(h).not.toContain('<img');
    expect(h).toContain('&lt;script&gt;');
  });
});

describe('validerAnnonce', () => {
  it('refuse sujet/message vides ou trop longs, rôles vides ou inconnus', () => {
    const ko = (p) => { try { validerAnnonce({ ...base, ...p }); return null; } catch (e) { return e; } };
    expect(ko({ sujet: '  ' })).toBeInstanceOf(ErreurAnnonce);
    expect(ko({ sujet: 'x'.repeat(121) }).statut).toBe(400);
    expect(ko({ corps: '' }).statut).toBe(400);
    expect(ko({ corps: 'x'.repeat(5001) }).statut).toBe(400);
    expect(ko({ roles: [] }).statut).toBe(400);
    expect(ko({ roles: ['enseignant'] }).statut).toBe(400);
    expect(ko({})).toBeNull();
  });
});

describe('destinataires', () => {
  it('adresses distinctes en minuscules ; une adresse partagée compte une fois', async () => {
    const r = await destinataires(monde(), ['admin', 'referent_plai', 'direction', 'agent_plai']);
    expect(r.adresses.sort()).toEqual(['a1@x.be', 'a2@x.be', 'd1@x.be', 'g1@x.be', 'r1@x.be']);
    expect(r.adresses).toHaveLength(5);
  });
});

describe('envoyerAnnonce', () => {
  it('test : tous les administrateurs seulement, objet [TEST], bandeau avec le nombre réel, rien de journalisé', async () => {
    const db = monde();
    const envoyer = vi.fn().mockResolvedValue();
    const r = await envoyerAnnonce(db, { ...base, mode: 'test' }, envoyer, NOW);
    expect(r.envoyes).toBe(2);
    expect(envoyer.mock.calls.map((c) => c[0].to).sort()).toEqual(['a1@x.be', 'a2@x.be']);
    expect(envoyer.mock.calls[0][0].subject).toBe('[TEST] AménagActif : nouveautés');
    expect(envoyer.mock.calls[0][0].html).toContain('partira à 5 personnes');
    expect(db.journal).toHaveLength(0);
  });

  it('envoi réel : un e-mail par adresse, journalisé, sans bandeau de test', async () => {
    const db = monde();
    const envoyer = vi.fn().mockResolvedValue();
    const r = await envoyerAnnonce(db, { ...base, mode: 'envoyer' }, envoyer, NOW);
    expect(r).toMatchObject({ envoyes: 5, echecs: 0 });
    expect(envoyer).toHaveBeenCalledTimes(5);
    expect(envoyer.mock.calls[0][0].subject).toBe('AménagActif : nouveautés');
    expect(envoyer.mock.calls[0][0].html).not.toContain('Exemplaire de test');
    expect(envoyer.mock.calls[0][0].html).toContain('vous avez un compte AménagActif');
    expect(db.journal[0]).toMatchObject({ sujet: 'AménagActif : nouveautés', nb_destinataires: 5, nb_echecs: 0, envoye_par: 'a1' });
    expect(JSON.stringify(db.journal)).not.toContain('@x.be'); // aucune adresse dans le journal
  });

  it('envoi réel limité aux rôles choisis', async () => {
    const envoyer = vi.fn().mockResolvedValue();
    const r = await envoyerAnnonce(monde(), { ...base, roles: ['agent_plai'], mode: 'envoyer' }, envoyer, NOW);
    expect(envoyer.mock.calls.map((c) => c[0].to).sort()).toEqual(['a1@x.be', 'g1@x.be']);
    expect(r.envoyes).toBe(2);
  });

  it('échecs comptés ; les autres envois partent quand même', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = monde();
    const envoyer = vi.fn().mockImplementation(async ({ to }) => { if (to === 'r1@x.be') throw Object.assign(new Error('x'), { status: 500 }); });
    const r = await envoyerAnnonce(db, { ...base, mode: 'envoyer' }, envoyer, NOW);
    expect(r).toMatchObject({ envoyes: 4, echecs: 1 });
    expect(db.journal[0]).toMatchObject({ nb_destinataires: 4, nb_echecs: 1 });
  });

  it('même message en moins de 10 minutes : 409, rien envoyé ; après 10 minutes : accepté', async () => {
    const db = monde();
    const envoyer = vi.fn().mockResolvedValue();
    await envoyerAnnonce(db, { ...base, mode: 'envoyer' }, envoyer, NOW);
    envoyer.mockClear();
    const err = await envoyerAnnonce(db, { ...base, mode: 'envoyer' }, envoyer, new Date(NOW.getTime() + 5 * 60 * 1000)).catch((e) => e);
    expect(err).toBeInstanceOf(ErreurAnnonce);
    expect(err.statut).toBe(409);
    expect(envoyer).not.toHaveBeenCalled();
    const r = await envoyerAnnonce(db, { ...base, mode: 'envoyer' }, envoyer, new Date(NOW.getTime() + 11 * 60 * 1000));
    expect(r.envoyes).toBe(5);
  });

  it('mode inconnu : 400 ; aucun destinataire : 400', async () => {
    const e1 = await envoyerAnnonce(monde(), { ...base, mode: 'autre' }, vi.fn(), NOW).catch((e) => e);
    expect(e1.statut).toBe(400);
    const vide = faux({ profils: [], emails: {} });
    const e2 = await envoyerAnnonce(vide, { ...base, mode: 'envoyer' }, vi.fn(), NOW).catch((e) => e);
    expect(e2.statut).toBe(400);
  });
});

describe('test : détail par administrateur', () => {
  it('renvoie une ligne par admin (adresse, accepté ou non) et compte les admins sans adresse ; l\'envoi réel ne renvoie aucune adresse', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = faux({
      profils: [{ user_id: 'a1', role: 'admin' }, { user_id: 'a2', role: 'admin' }, { user_id: 'a3', role: 'admin' }, { user_id: 'r1', role: 'referent_plai' }],
      emails: { a1: 'jf@x.be', a2: 'helene@x.be', r1: 'r1@x.be' }, // a3 : aucune adresse lisible
    });
    const envoyer = vi.fn().mockImplementation(async ({ to }) => { if (to === 'helene@x.be') throw Object.assign(new Error('x'), { status: 400 }); });
    const t = await envoyerAnnonce(db, { ...base, mode: 'test' }, envoyer, NOW);
    expect(t.envoyes).toBe(1);
    expect(t.echecs).toBe(1);
    expect(t.sansAdresse).toBe(1);
    expect([...t.detail].sort((x, y) => x.adresse.localeCompare(y.adresse))).toEqual([{ adresse: 'helene@x.be', ok: false }, { adresse: 'jf@x.be', ok: true }]);
    const r = await envoyerAnnonce(db, { ...base, mode: 'envoyer' }, vi.fn().mockResolvedValue(), NOW);
    expect(r.detail).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain('@');
  });
});
