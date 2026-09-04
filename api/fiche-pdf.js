import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { loadClasseData } from './_lib/ficheData.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { computeFicheClasse } from '../src/domain/projections/ficheClasse.js';
import { computeFicheEleve } from '../src/domain/projections/ficheEleve.js';
import { FicheClassePdf, FicheElevePdf } from './_lib/pdf/FichePdf.js';

export default async function handler(req, res) {
  try {
    const { type, id } = req.query;
    if (!id || !['classe', 'eleve'].includes(type)) {
      res.status(400).json({ error: 'type=classe|eleve & id requis' });
      return;
    }

    const jwt = (req.headers.authorization || '').replace('Bearer ', '');
    if (jwt) {
      const { data, error } = await supabaseAdmin().auth.getUser(jwt);
      if (error || !data.user) { res.status(401).json({ error: 'non authentifie' }); return; }
    } else {
      res.status(401).json({ error: 'non authentifie' });
      return;
    }

    let element;
    let filename;
    if (type === 'classe') {
      const d = await loadClasseData(id);
      const vm = computeFicheClasse(d);
      element = React.createElement(FicheClassePdf, { vm });
      filename = `fiche-${vm.classeNom}.pdf`;
    } else {
      const db = supabaseAdmin();
      const { data: eleve, error } = await db
        .from('ar_eleves').select('id, prenom, initiale_nom, classe_id, ar_classes(nom)').eq('id', id).single();
      if (error) throw error;
      const d = await loadClasseData(eleve.classe_id);
      const vm = computeFicheEleve({
        eleve, classeNom: eleve.ar_classes?.nom ?? '',
        amenagements: d.amenagements, chapitres: d.chapitres,
        selectionsAR: d.selectionsAR.filter((s) => s.eleve_id === id),
        libres: d.libres.filter((l) => l.eleve_id === id),
      });
      element = React.createElement(FicheElevePdf, { vm });
      filename = `fiche-${vm.eleve}.pdf`;
    }

    const buffer = await renderToBuffer(element);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.status(200).send(buffer);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
