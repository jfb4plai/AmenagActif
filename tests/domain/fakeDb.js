// Faux client Supabase en mémoire (sous-ensemble du query builder utilisé par api/liens.js et api/_lib/liensData.js).
// Respecte la liste de colonnes du select : une colonne non demandée (ex. token_hash) n'est jamais renvoyée.
const EMBEDS = { ar_classes: 'classe_id', ar_annees: 'annee_id' };

export function fakeDb(tables, { users = {}, sessionUser = null, rpc = () => ({ data: true, error: null }) } = {}) {
  let seq = 0;
  const journal = { inserts: [], updates: [], rpc: [] };

  function projeter(row, cols, tablesRef) {
    if (!cols || cols.trim() === '*') return { ...row };
    const out = {};
    const parts = cols.match(/[a-z_]+\([^)]*\)|[a-z_]+/g) ?? [];
    for (const p of parts) {
      const m = /^([a-z_]+)\(([^)]*)\)$/.exec(p);
      if (m) {
        const fk = EMBEDS[m[1]];
        const cible = (tablesRef[m[1]] ?? []).find((r) => r.id === row[fk]);
        out[m[1]] = cible ? projeter(cible, m[2], tablesRef) : null;
      } else out[p] = row[p];
    }
    return out;
  }

  function builder(nom) {
    const b = { op: 'select', filtres: [], cols: '*', payload: null, lim: null, ordre: null, unique: false };
    const executer = () => {
      const rows = (tables[nom] = tables[nom] ?? []);
      if (b.op === 'insert') {
        const nouveaux = (Array.isArray(b.payload) ? b.payload : [b.payload]).map((r) => ({ id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, ...r }));
        rows.push(...nouveaux);
        journal.inserts.push({ table: nom, rows: nouveaux });
        const data = nouveaux.map((r) => projeter(r, b.cols, tables));
        return { data: b.unique ? data[0] : data, error: null };
      }
      const cibles = rows.filter((r) => b.filtres.every((f) => f(r)));
      if (b.op === 'update') {
        cibles.forEach((r) => Object.assign(r, b.payload));
        journal.updates.push({ table: nom, payload: b.payload, n: cibles.length });
        return { data: cibles.map((r) => projeter(r, b.cols, tables)), error: null };
      }
      if (b.op === 'delete') {
        tables[nom] = rows.filter((r) => !cibles.includes(r));
        return { data: null, error: null };
      }
      let res = cibles.map((r) => projeter(r, b.cols, tables));
      if (b.ordre) res = [...res].sort((x, y) => String(y[b.ordre]).localeCompare(String(x[b.ordre])));
      if (b.lim) res = res.slice(0, b.lim);
      return { data: res, error: null };
    };
    const api = {
      select(c) { b.cols = c ?? '*'; return api; },
      insert(p) { b.op = 'insert'; b.payload = p; return api; },
      update(p) { b.op = 'update'; b.payload = p; return api; },
      delete() { b.op = 'delete'; return api; },
      eq(c, v) { b.filtres.push((r) => r[c] === v); return api; },
      in(c, arr) { b.filtres.push((r) => arr.includes(r[c])); return api; },
      is(c, v) { b.filtres.push((r) => (v === null ? r[c] == null : r[c] === v)); return api; },
      order(c) { b.ordre = c; return api; },
      limit(n) { b.lim = n; return api; },
      maybeSingle() { const r = executer(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error }); },
      single() { b.unique = true; const r = executer(); return Promise.resolve(r); },
      then(ok, ko) { return Promise.resolve(executer()).then(ok, ko); },
    };
    return api;
  }

  return {
    journal,
    from: builder,
    rpc: (fn, args) => { journal.rpc.push({ fn, args }); return Promise.resolve(rpc(fn, args)); },
    auth: {
      getUser: async () => (sessionUser ? { data: { user: sessionUser }, error: null } : { data: { user: null }, error: { status: 401, name: 'AuthApiError' } }),
      admin: { getUserById: async (id) => ({ data: { user: users[id] ? { id, email: users[id] } : null }, error: null }) },
    },
  };
}
