// PDF des fiches — sans JSX (Vercel @vercel/node ne transpile pas .jsx dans api/).
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { readFileSync } from 'fs';
import { join } from 'path';

const h = React.createElement;

/** Logo PLAI en data URI, chargé paresseusement et sans casser le PDF s'il est absent. */
let logoCache;
function logo() {
  if (logoCache !== undefined) return logoCache;
  try {
    const bytes = readFileSync(join(process.cwd(), 'api/_assets/plai-logo.jpg'));
    logoCache = 'data:image/jpeg;base64,' + bytes.toString('base64');
  } catch {
    logoCache = null;
  }
  return logoCache;
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  logo: { height: 32 },
  titre: { textAlign: 'center', backgroundColor: '#e5e5e5', padding: 6, fontFamily: 'Helvetica-Bold', fontSize: 13, marginBottom: 12 },
  h2: { fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginTop: 8, marginBottom: 4 },
  cellL: { width: 90, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderTop: '1 solid #000', padding: 4 },
  li: { marginLeft: 10, marginBottom: 2 },
  surligne: { backgroundColor: '#fde68a' },
  tblHead: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderBottom: '1 solid #000' },
  th: { flex: 1, padding: 4, fontFamily: 'Helvetica-Bold' },
});

function enTete(extra) {
  const src = logo();
  return h(View, { style: s.head },
    src ? h(Image, { src, style: s.logo }) : h(Text, null, 'PLAI'),
    extra ? h(Text, null, extra) : null
  );
}

export function FicheClassePdf({ vm }) {
  const date = vm.dateMaj ? new Date(vm.dateMaj).toLocaleDateString('fr-BE') : '...';
  return h(Document, null,
    h(Page, { size: 'A4', style: s.page },
      enTete('Date de mise a jour : ' + date),
      h(Text, { style: s.titre }, 'Amenagements raisonnables - ' + vm.classeNom),
      h(Text, { style: { color: '#555', marginBottom: 10 } }, `${vm.ecoleNom} - ${vm.anneeLibelle}`),

      h(View, { style: { border: '1 solid #000', marginBottom: 12 } },
        h(View, { style: s.tblHead },
          h(Text, { style: s.th }, 'Integrations (referent PIA)'),
          h(Text, { style: s.th }, 'PAR (Direction)')
        ),
        h(View, { style: { flexDirection: 'row' } },
          h(Text, { style: { flex: 1, padding: 6 } }, vm.tableauReferents.pia.join(', ') || '-'),
          h(Text, { style: { flex: 1, padding: 6 } }, vm.tableauReferents.par.join(', ') || '-')
        )
      ),

      h(Text, { style: s.h2 }, 'Pour tous :'),
      vm.pourTous.length === 0
        ? h(Text, { style: { color: '#777' } }, 'Aucun amenagement universel retenu.')
        : vm.pourTous.map((x, i) => h(Text, { key: i, style: [s.li, x.surligne ? s.surligne : {}] }, '- ' + x.libelle)),

      h(Text, { style: s.h2 }, 'AR specifiques a un eleve :'),
      h(View, { style: { border: '1 solid #000', marginBottom: 12 } },
        vm.parEleve.length === 0
          ? h(Text, { style: { padding: 6, color: '#777' } }, 'Aucun.')
          : vm.parEleve.map((rowItem) =>
              h(View, { key: rowItem.eleve, style: s.row },
                h(Text, { style: s.cellL }, rowItem.eleve),
                h(View, { style: { flex: 1 } },
                  rowItem.amenagements.map((a, i) => h(Text, { key: i, style: s.li }, '- ' + a))
                )
              )
            )
      ),

      h(View, { style: { flexDirection: 'row', border: '1 solid #000', alignSelf: 'flex-start' } },
        h(Text, { style: { padding: 6 } }, 'Nombre de cours a imprimer en recto'),
        h(Text, { style: { padding: 6, borderLeft: '1 solid #000' } }, String(vm.nbRecto))
      )
    )
  );
}

export function FicheElevePdf({ vm }) {
  return h(Document, null,
    h(Page, { size: 'A4', style: s.page },
      enTete(null),
      h(Text, { style: s.titre }, `Amenagements - ${vm.eleve} (${vm.classeNom})`),
      vm.parChapitre.length === 0
        ? h(Text, { style: { color: '#777' } }, 'Aucun amenagement specifique.')
        : vm.parChapitre.map((ch) =>
            h(View, { key: ch.chapitreTitre, style: { marginBottom: 6 } },
              h(Text, { style: s.h2 }, ch.chapitreTitre),
              ch.amenagements.map((a, i) => h(Text, { key: i, style: s.li }, '- ' + a))
            )
          )
    )
  );
}
