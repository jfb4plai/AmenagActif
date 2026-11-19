import { describe, it, expect, vi } from 'vitest';
import { notifierActivation } from '../../api/_lib/activation.js';

// Faux client minimal : tables en mémoire, insert avec clé unique sur ar_activations.
function faux({ profils, liaisons = [], ecoles = [], emails = {} }) {
  const activations = [];
  const table = (nom) => {
    const rows = { ar_profils_acces: profils, ar_profils_acces_ecoles: liaisons, ar_ecoles: ecoles, ar_activations: activations }[nom];
    let filtre = () => true;
    let mode = 'select';
    const q = {
      select() { return q; },
      eq(c, v) { const f = filtre; filtre = (r) => f(r) && r[c] === v; return q; },
      in(c, v) { const f = filtre; filtre = (r) => f(r) && v.includes(r.id); return q; },
      maybeSingle: async () => ({ data: rows.filter(filtre)[0] ?? null, error: null }),
      insert: async (r) => {
        if (rows.some((x) => x.user_id === r.user_id)) return { error: { code: '23505' } };
        rows.push({ derniere_notif: '2026-11-19T10:00:00Z', ...r }); // défaut SQL now(), ici l'instant du premier appel des tests
        return { error: null };
      },
      delete() { mode = 'delete'; return q; },
      update(patch) { mode = 'update'; q.patch = patch; return q; },
      then(ok) {
        if (mode === 'update') { rows.filter(filtre).forEach((r) => Object.assign(r, q.patch)); return ok({ error: null }); }
        if (mode === 'delete') {
          for (let i = rows.length - 1; i >= 0; i--) if (filtre(rows[i])) rows.splice(i, 1);
          return ok({ error: null });
        }
        return ok({ data: rows.filter(filtre), error: null });
      },
    };
    return q;
  };
  return { activations, from: table, auth: { admin: { getUserById: async (id) => ({ data: { user: emails[id] ? { email: emails[id] } : null } }) } } };
}

const base = () => ({
  profils: [
    { user_id: 'u1', role: 'direction', nom: 'Dupont', ecole_id: 'e1' },
    { user_id: 'a1', role: 'admin' },
    { user_id: 'a2', role: 'admin' },
  ],
  ecoles: [{ id: 'e1', nom: 'Athénée', implantation_nom: null }],
  emails: { a1: 'a1@x.be', a2: 'a2@x.be' },
});

describe('notifierActivation', () => {
  const U = { id: 'u1', email: 'dir@x.be' };
  const T0 = new Date('2026-11-19T10:00:00Z');

  it('première activation : un mail par admin, libellé « activé »', async () => {
    const db = faux(base());
    const envoyer = vi.fn().mockResolvedValue();
    expect(await notifierActivation(db, U, envoyer, T0)).toBe('active');
    expect(envoyer.mock.calls.map((c) => c[0].to).sort()).toEqual(['a1@x.be', 'a2@x.be']);
    expect(envoyer.mock.calls[0][0].subject).toContain('activé');
    expect(envoyer.mock.calls[0][0].html).toContain('dir@x.be');
  });

  it('changement ultérieur : notifié aussi, libellé « modifié »', async () => {
    const db = faux(base());
    const envoyer = vi.fn().mockResolvedValue();
    await notifierActivation(db, U, envoyer, T0);
    envoyer.mockClear();
    const plusTard = new Date(T0.getTime() + 11 * 60 * 1000);
    expect(await notifierActivation(db, U, envoyer, plusTard)).toBe('modifie');
    expect(envoyer).toHaveBeenCalledTimes(2);
    expect(envoyer.mock.calls[0][0].subject).toContain('modifié');
    expect(envoyer.mock.calls[0][0].html).toContain('compromis');
  });

  it('au plus un courriel par compte et par 10 minutes', async () => {
    const db = faux(base());
    const envoyer = vi.fn().mockResolvedValue();
    await notifierActivation(db, U, envoyer, T0);
    envoyer.mockClear();
    expect(await notifierActivation(db, U, envoyer, new Date(T0.getTime() + 60 * 1000))).toBe('trop_tot');
    expect(envoyer).not.toHaveBeenCalled();
  });

  it('ne notifie pas un compte sans profil', async () => {
    const envoyer = vi.fn();
    expect(await notifierActivation(faux(base()), { id: 'inconnu', email: 'z@x.be' }, envoyer, T0)).toBe('sans_profil');
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("première activation sans envoi réussi : ligne retirée (réessai possible)", async () => {
    const db = faux(base());
    const envoyer = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 500 }));
    expect(await notifierActivation(db, U, envoyer, T0)).toBe('echec_envoi');
    expect(db.activations).toHaveLength(0);
  });

  it('échappe le HTML des données saisies', async () => {
    const b = base();
    b.profils[0].nom = '<b>x</b>';
    const envoyer = vi.fn().mockResolvedValue();
    await notifierActivation(faux(b), U, envoyer, T0);
    expect(envoyer.mock.calls[0][0].html).not.toContain('<b>x</b>');
  });
});
