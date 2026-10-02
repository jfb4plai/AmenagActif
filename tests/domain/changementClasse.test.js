import { describe, it, expect } from 'vitest';
import {
  dispositifsBloquants, dispositifsPerdus, messageBlocageChangement, messagePerte,
  avertissementEleve, messageAvantEnvoi, messageErreurChangement,
} from '../../src/domain/changementClasse.js';

const TITRE = 'Dispositif de régulation des comportements';
const chapitres = [
  { id: 'c1', titre: '1. SUPPORTS', est_dispositif: false },
  { id: 'd1', titre: TITRE, est_dispositif: true },
];
const amenagements = [
  { id: 'a2', chapitre_id: 'c1', type: 'AR' },
  { id: 'x1', chapitre_id: 'd1', type: 'AR' },
];
const modes = [
  { classe_id: 'cAU', chapitre_id: 'd1', pour_toute_la_classe: true },
  { classe_id: 'cAR', chapitre_id: 'd1', pour_toute_la_classe: false },
];
const base = { eleveId: 'e1', modes, chapitres, amenagements, selectionsAR: [], libres: [] };

describe('dispositifsBloquants', () => {
  it("bloque si l'élève a une case du dispositif et que la classe d'arrivée l'applique à toute la classe", () => {
    const r = dispositifsBloquants({ ...base, classeCibleId: 'cAU', selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }] });
    expect(r).toEqual([TITRE]);
  });
  it('bloque aussi pour un aménagement libre du chapitre du dispositif', () => {
    const r = dispositifsBloquants({ ...base, classeCibleId: 'cAU', libres: [{ eleve_id: 'e1', chapitre_id: 'd1', texte: 'x' }] });
    expect(r).toEqual([TITRE]);
  });
  it("ne bloque pas si la classe d'arrivée est en mode AR, ou sans ligne de mode", () => {
    const sel = [{ eleve_id: 'e1', amenagement_id: 'x1' }];
    expect(dispositifsBloquants({ ...base, classeCibleId: 'cAR', selectionsAR: sel })).toEqual([]);
    expect(dispositifsBloquants({ ...base, classeCibleId: 'cX', selectionsAR: sel })).toEqual([]);
  });
  it("ignore les cases d'un chapitre ordinaire et celles des autres élèves", () => {
    expect(dispositifsBloquants({ ...base, classeCibleId: 'cAU', selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'a2' }] })).toEqual([]);
    expect(dispositifsBloquants({ ...base, classeCibleId: 'cAU', selectionsAR: [{ eleve_id: 'e2', amenagement_id: 'x1' }] })).toEqual([]);
  });
});

describe('dispositifsPerdus', () => {
  it("liste les dispositifs AU au départ qui deviennent AR à l'arrivée", () => {
    expect(dispositifsPerdus({ classeSourceId: 'cAU', classeCibleId: 'cAR', modes, chapitres })).toEqual([TITRE]);
    expect(dispositifsPerdus({ classeSourceId: 'cAU', classeCibleId: 'cX', modes, chapitres })).toEqual([TITRE]);
  });
  it('rien si le mode ne change pas ou si le départ est en AR', () => {
    expect(dispositifsPerdus({ classeSourceId: 'cAU', classeCibleId: 'cAU', modes, chapitres })).toEqual([]);
    expect(dispositifsPerdus({ classeSourceId: 'cAR', classeCibleId: 'cAU', modes, chapitres })).toEqual([]);
  });
});

describe('messages de dispositif', () => {
  it('le blocage nomme le dispositif et le prénom, demande de décocher, sans pronom genré', () => {
    const m = messageBlocageChangement([TITRE], 'Emilie');
    expect(m).toContain(TITRE);
    expect(m).toContain('Emilie');
    expect(m).toContain('Décochez');
    expect(m).not.toMatch(/\b(elle|il|lui)\b/i);
  });
  it('pluriel pour plusieurs dispositifs', () => {
    expect(messageBlocageChangement(['A', 'B'], 'Emilie')).toContain('les dispositifs');
  });
  it('la note de perte invite à cocher le dispositif pour l\'élève', () => {
    const m = messagePerte([TITRE]);
    expect(m).toContain(TITRE);
    expect(m).toContain('élève par élève');
  });
});

describe('avertissementEleve', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const sans = { classe_changee_le: null, classe_precedente_nom: null };

  it('aucun avertissement : liste vide', () => {
    expect(avertissementEleve({ eleve: sans, nAConfirmer: 0, now })).toEqual([]);
  });
  it('singulier / pluriel pour les aménagements à confirmer', () => {
    expect(avertissementEleve({ eleve: sans, nAConfirmer: 1, now })[0]).toContain('1 aménagement « à confirmer »');
    expect(avertissementEleve({ eleve: sans, nAConfirmer: 3, now })[0]).toContain('3 aménagements « à confirmer »');
    expect(avertissementEleve({ eleve: sans, nAConfirmer: 3, now })[0]).toContain('avant d\'envoyer un lien enseignant');
  });
  it('changement de classe récent (moins de 30 jours) : mention de la date et de la classe de départ', () => {
    const l = avertissementEleve({ eleve: { classe_changee_le: '2026-10-03T12:00:00Z', classe_precedente_nom: '4A' }, nAConfirmer: 0, now });
    expect(l).toHaveLength(1);
    expect(l[0]).toContain('octobre 2026');
    expect(l[0]).toContain('depuis 4A');
  });
  it('changement ancien (plus de 30 jours) : pas de mention', () => {
    expect(avertissementEleve({ eleve: { classe_changee_le: '2026-08-01T12:00:00Z', classe_precedente_nom: '4A' }, nAConfirmer: 0, now })).toEqual([]);
  });
  it('les deux lignes quand les deux cas se présentent', () => {
    const l = avertissementEleve({ eleve: { classe_changee_le: '2026-10-03T12:00:00Z', classe_precedente_nom: null }, nAConfirmer: 2, now });
    expect(l).toHaveLength(2);
    expect(l[0]).not.toContain('depuis');
  });
});

describe('messageAvantEnvoi', () => {
  it('null quand il n\'y a rien à confirmer ou pas de donnée', () => {
    expect(messageAvantEnvoi(null)).toBeNull();
    expect(messageAvantEnvoi({ total: 0, parEleve: [], nAU: 0 })).toBeNull();
  });
  it('détaille élèves et AU, et rappelle que la fiche est lue à l\'ouverture', () => {
    const m = messageAvantEnvoi({ total: 3, parEleve: [{ n: 1 }, { n: 1 }], nAU: 1 });
    expect(m).toContain('3 aménagements « à confirmer »');
    expect(m).toContain('2 élèves, 1 AU de classe');
    expect(m).toContain('au moment où il l\'ouvre');
  });
  it('singulier', () => {
    expect(messageAvantEnvoi({ total: 1, parEleve: [{ n: 1 }], nAU: 0 })).toContain('1 aménagement « à confirmer » dans cette fiche (1 élève)');
  });
});

describe('messageErreurChangement', () => {
  it('dispositif incompatible : reprend les titres renvoyés par la base', () => {
    expect(messageErreurChangement({ message: `dispositif_incompatible: ${TITRE}` })).toContain(TITRE);
  });
  it('droit insuffisant (code 42501 ou message)', () => {
    expect(messageErreurChangement({ code: '42501', message: 'x' })).toContain('administrateur');
    expect(messageErreurChangement({ message: 'droit_insuffisant' })).toContain('administrateur');
  });
  it('année différente, classe introuvable, même classe, défaut', () => {
    expect(messageErreurChangement({ message: 'annee_differente' })).toContain('même année');
    expect(messageErreurChangement({ message: 'classe_cible_introuvable' })).toContain('introuvable');
    expect(messageErreurChangement({ message: 'meme_classe' })).toContain('déjà');
    expect(messageErreurChangement({ message: 'autre chose' })).toContain('réessayez');
    expect(messageErreurChangement(undefined)).toContain('réessayez');
  });
});
