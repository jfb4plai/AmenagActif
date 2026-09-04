// Génère supabase/seed/catalogue.json + seed_catalogue.sql depuis le classeur source.
// Usage : node scripts/generate-catalogue.mjs
//
// ⚠️ Bootstrap unique. Une fois le catalogue en base, il se gère dans l'écran
// Administration (type AU/AR, libellé, chapitre, actif). Ne PAS réexécuter le seed
// ensuite : il écraserait les ajustements faits via l'app.
import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'fs';

const SRC = 'C:/Users/jfbeg/OneDrive/enseignement/pôle territorial/AR/uniformisation des tableaux AR/Classeur source AR.xlsx';

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);
const ws = wb.getWorksheet('Feuil1');

const chapitres = [];
let ordreChap = 0;
let ordreItem = 0;

const cellText = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '');
  if (typeof v === 'object' && 'text' in v) return String(v.text ?? '');
  return String(v);
};

ws.eachRow((row) => {
  const raw = cellText(row.getCell(1).value);
  if (!raw) return;
  const t = raw.replace(/\u00a0/g, ' ').trim();
  if (!t) return;
  if (/^\d+\.\s/.test(t)) {
    ordreChap += 1;
    ordreItem = 0;
    chapitres.push({ ordre: ordreChap, titre: t, items: [] });
    return;
  }
  if (t.includes('cliquer sur') || t === 'AR' || t === 'Classe' || /^El[eè]ve/i.test(t)) return;
  if (chapitres.length === 0) return;
  ordreItem += 1;
  const type = t.startsWith('AU ') ? 'AU' : 'AR';
  const libelle = type === 'AU' ? t.slice(3).trim() : t;
  chapitres.at(-1).items.push({ ordre: ordreItem, type, libelle });
});

// AR compté pour « nombre de cours à imprimer en recto » — absent du classeur source
// (il y figurait dans « Pour tous »), mais modélisé ici en AR par élève. Le libellé doit
// rester exactement celui-ci (cf. LIBELLE_RECTO_NORMALISE dans src/domain/normalise.js).
{
  const ch1 = chapitres.find((c) => c.ordre === 1);
  if (ch1 && !ch1.items.some((i) => /cours uniquement en recto/i.test(i.libelle))) {
    const ordre = Math.max(...ch1.items.map((i) => i.ordre)) + 1;
    ch1.items.push({ ordre, type: 'AR', libelle: 'Cours uniquement en recto' });
  }
}

mkdirSync('supabase/seed', { recursive: true });
writeFileSync('supabase/seed/catalogue.json', JSON.stringify(chapitres, null, 2), 'utf8');

const esc = (s) => s.replace(/'/g, "''");
const lines = ['-- Généré par scripts/generate-catalogue.mjs — ne pas éditer à la main', 'begin;'];
for (const c of chapitres) {
  lines.push(
    `insert into ar_chapitres (ordre, titre) values (${c.ordre}, '${esc(c.titre)}') on conflict (ordre) do update set titre = excluded.titre;`
  );
  for (const it of c.items) {
    lines.push(
      `insert into ar_amenagements (chapitre_id, ordre, libelle, type) ` +
        `select id, ${it.ordre}, '${esc(it.libelle)}', '${it.type}' from ar_chapitres where ordre = ${c.ordre} ` +
        `on conflict (chapitre_id, ordre) do update set libelle = excluded.libelle, type = excluded.type;`
    );
  }
}
lines.push('commit;');
writeFileSync('supabase/seed/seed_catalogue.sql', lines.join('\n'), 'utf8');

const total = chapitres.reduce((n, c) => n + c.items.length, 0);
console.log(`${chapitres.length} chapitres, ${total} aménagements → supabase/seed/`);
