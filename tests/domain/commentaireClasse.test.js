import { describe, it, expect } from 'vitest';
import { computeFicheClasse } from '../../src/domain/projections/ficheClasse.js';
import { fusionnerDonneesClasses } from '../../src/domain/projections/fusionClasses.js';
import * as f from '../../src/test/fixtures/sample.js';

const partie = (classe, nom) => ({
  classe,
  contexte: { classeNom: nom, ecoleNom: f.contexte.ecoleNom, anneeLibelle: f.contexte.anneeLibelle },
  eleves: [],
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  auClasse: [],
  selectionsAR: [],
  libres: [],
  referents: f.referents,
});

const argsAvec = (classeExtra) => ({
  classe: { ...f.classe5LA, ...classeExtra },
  contexte: f.contexte,
  eleves: f.eleves,
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  auClasse: f.auClasse,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
  referents: f.referents,
});

describe('commentaire de classe — fiche classe', () => {
  it('sans commentaire : liste vide', () => {
    expect(computeFicheClasse(argsAvec({})).commentairesClasses).toEqual([]);
    expect(computeFicheClasse(argsAvec({ commentaire: null })).commentairesClasses).toEqual([]);
    expect(computeFicheClasse(argsAvec({ commentaire: '   ' })).commentairesClasses).toEqual([]);
  });

  it('avec commentaire : un élément portant le nom de la classe, le texte nettoyé et la date', () => {
    const vm = computeFicheClasse(argsAvec({ commentaire: '  Classe en contrat discipline  ', commentaire_modifie_le: '2026-09-20T10:00:00Z' }));
    expect(vm.commentairesClasses).toEqual([
      { classe: f.contexte.classeNom, texte: 'Classe en contrat discipline', modifieLe: '2026-09-20T10:00:00Z' },
    ]);
  });

  it('ne modifie pas la date de mise à jour de la fiche (dateMaj) ni les commentaires d\'élèves', () => {
    const sans = computeFicheClasse(argsAvec({}));
    const avec = computeFicheClasse(argsAvec({ commentaire: 'Contrat discipline', commentaire_modifie_le: '2030-01-01T00:00:00Z' }));
    expect(avec.dateMaj).toBe(sans.dateMaj);
    expect(avec.commentaires).toEqual(sans.commentaires);
  });
});

describe('commentaire de classe — fiche groupée', () => {
  it('un commentaire par classe source, étiqueté du nom de sa classe, sans les classes sans commentaire', () => {
    const fusion = fusionnerDonneesClasses([
      partie({ commentaire: 'Contrat discipline', commentaire_modifie_le: '2026-09-20T10:00:00Z' }, '5LA'),
      partie({ commentaire: null }, '5LB'),
      partie({ commentaire: 'Deux titulaires en alternance' }, '5LC'),
    ]);
    expect(fusion.commentairesClasses).toEqual([
      { classe: '5LA', texte: 'Contrat discipline', modifieLe: '2026-09-20T10:00:00Z' },
      { classe: '5LC', texte: 'Deux titulaires en alternance', modifieLe: null },
    ]);
  });

  it('la projection reprend les commentaires fusionnés tels quels (pas ceux de classe.commentaire)', () => {
    const fusion = fusionnerDonneesClasses([
      partie({ commentaire: 'A' }, '5LA'),
      partie({ commentaire: 'B' }, '5LB'),
    ]);
    const vm = computeFicheClasse(fusion);
    expect(vm.commentairesClasses.map((c) => `${c.classe}:${c.texte}`)).toEqual(['5LA:A', '5LB:B']);
  });

  it('aucun commentaire dans le groupe : liste vide', () => {
    const fusion = fusionnerDonneesClasses([partie({}, '5LA'), partie({}, '5LB')]);
    expect(computeFicheClasse(fusion).commentairesClasses).toEqual([]);
  });
});
