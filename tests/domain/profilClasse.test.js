import { describe, it, expect } from 'vitest';
import {
  computeProfilClasse, trancheEffectif, K_SEUIL_DEFAUT, CHAPITRES_PERIMETRE, REGLES_CONFLIT,
} from '../../src/domain/projections/profilClasse.js';

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CH = { supports: U(1), lecture: U(5), autre: U(6), sciences: U(7) };

const chapitres = [
  { id: CH.supports, ordre: 1, titre: '1. SUPPORTS', code: 'supports' },
  { id: CH.lecture, ordre: 5, titre: '5. LECTURE', code: 'lecture' },
  { id: CH.autre, ordre: 6, titre: '6. ÉCRITURE', code: null },
  { id: CH.sciences, ordre: 7, titre: '7. NOTIONS SCIENTIFIQUES', code: 'sciences' },
];

const A = (n, chapitre_id, ordre, libelle, type, code) => ({ id: U(100 + n), chapitre_id, ordre, libelle, type, code });
const amenagements = [
  A(1, CH.supports, 1, 'Mise en page', 'AU', 'ar_supports_mise_en_page'),
  A(2, CH.supports, 3, 'Ne pas utiliser de carte mentale', 'AR', 'ar_supports_carte_mentale_non'),
  A(3, CH.supports, 4, 'Utiliser des cartes mentales', 'AR', 'ar_supports_carte_mentale_oui'),
  A(4, CH.lecture, 1, 'Utiliser les livres audio pour la lecture', 'AR', 'ar_lecture_livres_audio'),
  A(5, CH.lecture, 20, 'AR de catalogue sans code', 'AR', null),
  A(6, CH.autre, 1, 'AR hors périmètre', 'AR', null),
  A(7, CH.supports, 30, 'AU sans code', 'AU', null),
  A(8, CH.sciences, 1, 'Utiliser la calculatrice', 'AR', 'ar_sciences_calculatrice'),
];
const id = (n) => U(100 + n);

const prenoms = ['Emilie', 'Karim', 'Lea', 'Sofiane', 'Chloe', 'Nolan', 'Ines'];
const eleves = prenoms.map((prenom, i) => ({
  id: U(200 + i), classe_id: U(9), prenom, initiale_nom: 'Z' + i,
  commentaire: i === 1 ? 'Décès de la grand-mère mi-septembre' : '', statut: i % 2 ? 'IPT' : 'PAR',
}));
const sel = (e, n) => ({ eleve_id: U(200 + e), amenagement_id: id(n), cree_le: '2026-09-02T08:00:00Z' });

const input = {
  classe: { id: U(9), niveau: '3e', created_at: '2026-08-20T08:00:00Z', referent_plai_nom: 'Carole Mona' },
  contexte: { classeNom: '3LA', ecoleNom: 'Athénée de test', anneeLibelle: '2026-2027' },
  eleves,
  amenagements,
  chapitres,
  auClasse: [
    { amenagement_id: id(1), cree_le: '2026-09-01T08:00:00Z' },
    { amenagement_id: id(7), cree_le: '2026-09-01T08:00:00Z' },
  ],
  selectionsAR: [
    // livres audio : 6 élèves -> 6+
    ...[0, 1, 2, 3, 4, 5].map((e) => sel(e, 4)),
    // carte mentale non : 3 élèves -> 3-5 ; carte mentale oui : 3 élèves -> 3-5 (conflit)
    ...[0, 1, 2].map((e) => sel(e, 2)),
    ...[3, 4, 5].map((e) => sel(e, 3)),
    // calculatrice : 2 élèves -> sous le seuil k=3 -> supprimée
    sel(0, 8), sel(1, 8),
    // AR de catalogue sans code, 3 élèves -> non_codes
    ...[2, 3, 4].map((e) => sel(e, 5)),
    // hors périmètre
    sel(6, 6),
  ],
  libres: [{ id: U(300), eleve_id: U(200), chapitre_id: CH.supports, texte: 'Vérifier oralement la consigne avant de commencer', cree_le: '2026-09-10T08:00:00Z' }],
};
const NOW = new Date('2026-09-24T10:00:00Z');
const calc = (over = {}, opts = {}) => computeProfilClasse({ ...input, ...over }, { now: NOW, ...opts });

describe('computeProfilClasse : contrat', () => {
  it('produit le schéma, la version et les dates', () => {
    const p = calc();
    expect(p.schema).toBe('plai.profil-classe');
    expect(p.version).toBe(1);
    expect(p.emis_le).toBe('2026-09-24T10:00:00.000Z');
    expect(p.expire_le).toBe('2027-01-22'); // + 120 jours
    expect(p.fiche_du).toBe('2026-09-10');
    expect(p.contexte).toEqual({ classe_libelle: '3LA', niveau: '3e', annee: '2026-2027', ecole: 'Athénée de test' });
  });

  it('publie les AU codés et range les AU sans code dans non_codes', () => {
    const p = calc();
    expect(p.au).toEqual([{ code: 'ar_supports_mise_en_page', chapitre: 'supports', libelle: 'Mise en page' }]);
    expect(p.non_codes).toContainEqual({ chapitre: 'supports', libelle: 'AU sans code' });
  });

  it('détaille les AR des chapitres du périmètre avec un effectif en tranches', () => {
    const p = calc();
    expect(p.ar_mecanisables).toEqual([
      { code: 'ar_supports_carte_mentale_non', chapitre: 'supports', libelle: 'Ne pas utiliser de carte mentale', effectif: '3-5' },
      { code: 'ar_supports_carte_mentale_oui', chapitre: 'supports', libelle: 'Utiliser des cartes mentales', effectif: '3-5' },
      { code: 'ar_lecture_livres_audio', chapitre: 'lecture', libelle: 'Utiliser les livres audio pour la lecture', effectif: '6+' },
    ]);
  });

  it('un AR sans code (dans le périmètre, assez porté) va dans non_codes, jamais omis', () => {
    expect(calc().non_codes).toContainEqual({ chapitre: 'lecture', libelle: 'AR de catalogue sans code' });
  });

  it('AR hors périmètre et AR sous le seuil k : réduits au booléen', () => {
    const p = calc();
    expect(p.ar_hors_perimetre_present).toBe(true);
    expect(p.ar_mecanisables.some((x) => x.code === 'ar_sciences_calculatrice')).toBe(false);
    expect(JSON.stringify(p)).not.toContain('calculatrice');
    expect(JSON.stringify(p)).not.toContain('AR hors périmètre');
  });

  it('sans AR hors périmètre ni sous le seuil, le booléen est faux', () => {
    const p = calc({
      selectionsAR: [0, 1, 2].map((e) => sel(e, 4)),
      libres: [],
    });
    expect(p.ar_hors_perimetre_present).toBe(false);
    expect(p.libres_present).toBe(false);
  });

  it('libres_present vrai si un texte libre existe', () => {
    expect(calc().libres_present).toBe(true);
  });

  it('signale les conflits entre codes publiés, exprimés en codes', () => {
    expect(calc().conflits).toEqual([['ar_supports_carte_mentale_oui', 'ar_supports_carte_mentale_non']]);
  });

  it('un conflit avec un AR supprimé par le seuil k n\'est jamais signalé', () => {
    const p = calc({
      selectionsAR: [...[0, 1, 2].map((e) => sel(e, 2)), sel(3, 3)], // « oui » porté par 1 seul élève
    });
    expect(p.conflits).toEqual([]);
    expect(p.ar_mecanisables.map((x) => x.code)).toEqual(['ar_supports_carte_mentale_non']);
  });

  it('le périmètre et le seuil sont configurables', () => {
    const k1 = calc({}, { k: 1 });
    expect(k1.ar_mecanisables.find((x) => x.code === 'ar_sciences_calculatrice')?.effectif).toBe('1-2');
    const chap1 = calc({}, { chapitresPerimetre: [1] });
    expect(chap1.ar_mecanisables.some((x) => x.code === 'ar_lecture_livres_audio')).toBe(false);
    expect(chap1.ar_hors_perimetre_present).toBe(true);
  });

  it('constantes documentées', () => {
    expect(K_SEUIL_DEFAUT).toBe(3);
    expect(CHAPITRES_PERIMETRE).toEqual([1, 5, 7, 9]);
    expect(REGLES_CONFLIT.length).toBeGreaterThan(0);
  });

  it('tranches d\'effectif', () => {
    expect([1, 2, 3, 5, 6, 30].map(trancheEffectif)).toEqual(['1-2', '1-2', '3-5', '3-5', '6+', '6+']);
  });

  it('déterministe : même entrée, même sortie, quel que soit l\'ordre des lignes', () => {
    const a = JSON.stringify(calc());
    const inverse = JSON.stringify(calc({
      selectionsAR: [...input.selectionsAR].reverse(),
      auClasse: [...input.auClasse].reverse(),
      amenagements: [...amenagements].reverse(),
    }));
    expect(inverse).toBe(a);
  });

  it('un élève absent de la classe est ignoré', () => {
    const p = calc({ selectionsAR: [...[0, 1].map((e) => sel(e, 4)), { eleve_id: U(999), amenagement_id: id(4) }] });
    expect(p.ar_mecanisables).toEqual([]); // 2 élèves de la classe < k
  });
});

describe('computeProfilClasse : NON-FUITE', () => {
  const sortie = JSON.stringify(calc());

  it('aucun prénom, initiale, commentaire, texte libre, nom de référent', () => {
    for (const e of eleves) {
      expect(sortie).not.toContain(e.prenom);
      expect(sortie).not.toContain(e.initiale_nom);
    }
    expect(sortie).not.toContain('Décès');
    expect(sortie).not.toContain('grand-mère');
    expect(sortie).not.toContain('Vérifier oralement');
    expect(sortie).not.toContain('Carole');
    expect(sortie).not.toContain('Mona');
    expect(sortie).not.toContain('referent');
  });

  it('aucun statut IPT/PAR', () => {
    expect(sortie).not.toMatch(/\bIPT\b/);
    expect(sortie).not.toMatch(/\bPAR\b/);
    expect(sortie).not.toContain('statut');
  });

  it('aucun UUID ni identifiant interne', () => {
    expect(sortie).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(sortie).not.toContain('00000000-0000');
  });

  it('aucun effectif exact ni clé de regroupement par élève', () => {
    const p = JSON.parse(sortie);
    for (const x of p.ar_mecanisables) expect(['1-2', '3-5', '6+']).toContain(x.effectif);
    expect(Object.keys(p).sort()).toEqual([
      'ar_hors_perimetre_present', 'ar_mecanisables', 'au', 'conflits', 'contexte', 'emis_le',
      'expire_le', 'fiche_du', 'libres_present', 'non_codes', 'schema', 'version',
    ]);
  });
});
