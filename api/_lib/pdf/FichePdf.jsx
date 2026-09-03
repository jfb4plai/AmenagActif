import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { readFileSync } from 'fs';
import { join } from 'path';

const logo = 'data:image/jpeg;base64,' +
  readFileSync(join(process.cwd(), 'api/_assets/plai-logo.jpg')).toString('base64');

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

export function FicheClassePdf({ vm }) {
  const date = vm.dateMaj ? new Date(vm.dateMaj).toLocaleDateString('fr-BE') : '...';
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <Image src={logo} style={s.logo} />
          <Text>Date de mise a jour : {date}</Text>
        </View>
        <Text style={s.titre}>Amenagements raisonnables - {vm.classeNom}</Text>
        <Text style={{ color: '#555', marginBottom: 10 }}>{vm.ecoleNom} - {vm.anneeLibelle}</Text>

        <View style={{ border: '1 solid #000', marginBottom: 12 }}>
          <View style={s.tblHead}>
            <Text style={s.th}>Integrations (referent PIA)</Text>
            <Text style={s.th}>PAR (Direction)</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ flex: 1, padding: 6 }}>{vm.tableauReferents.pia.join(', ') || '-'}</Text>
            <Text style={{ flex: 1, padding: 6 }}>{vm.tableauReferents.par.join(', ') || '-'}</Text>
          </View>
        </View>

        <Text style={s.h2}>Pour tous :</Text>
        {vm.pourTous.length === 0 && <Text style={{ color: '#777' }}>Aucun amenagement universel retenu.</Text>}
        {vm.pourTous.map((x, i) => (
          <Text key={i} style={[s.li, x.surligne ? s.surligne : {}]}>- {x.libelle}</Text>
        ))}

        <Text style={s.h2}>AR specifiques a un eleve :</Text>
        <View style={{ border: '1 solid #000', marginBottom: 12 }}>
          {vm.parEleve.length === 0 && <Text style={{ padding: 6, color: '#777' }}>Aucun.</Text>}
          {vm.parEleve.map((row) => (
            <View key={row.eleve} style={s.row}>
              <Text style={s.cellL}>{row.eleve}</Text>
              <View style={{ flex: 1 }}>
                {row.amenagements.map((a, i) => <Text key={i} style={s.li}>- {a}</Text>)}
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', border: '1 solid #000', alignSelf: 'flex-start' }}>
          <Text style={{ padding: 6 }}>Nombre de cours a imprimer en recto</Text>
          <Text style={{ padding: 6, borderLeft: '1 solid #000' }}>{vm.nbRecto}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function FicheElevePdf({ vm }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.head}><Image src={logo} style={s.logo} /></View>
        <Text style={s.titre}>Amenagements - {vm.eleve} ({vm.classeNom})</Text>
        {vm.parChapitre.length === 0 && <Text style={{ color: '#777' }}>Aucun amenagement specifique.</Text>}
        {vm.parChapitre.map((ch) => (
          <View key={ch.chapitreTitre} style={{ marginBottom: 6 }}>
            <Text style={s.h2}>{ch.chapitreTitre}</Text>
            {ch.amenagements.map((a, i) => <Text key={i} style={s.li}>- {a}</Text>)}
          </View>
        ))}
      </Page>
    </Document>
  );
}
