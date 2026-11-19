import { describe, it, expect } from 'vitest';
import {
  ROLES, LIBELLE_ROLE, CAPACITES, rolesAvec,
  EDITEURS, GESTIONNAIRES_LIENS, LIENS_ENSEIGNANTS, LECTEURS,
} from '../../src/domain/droits.js';

describe('droits centralisés', () => {
  it('EDITEURS, GESTIONNAIRES_LIENS, LIENS_ENSEIGNANTS, LECTEURS égalent les anciens littéraux de App.jsx', () => {
    expect(EDITEURS).toEqual(['admin', 'referent_plai', 'direction', 'agent_plai']);
    expect(GESTIONNAIRES_LIENS).toEqual(['admin', 'referent_plai', 'direction']);
    expect(LIENS_ENSEIGNANTS).toEqual(['admin', 'referent_plai', 'direction', 'agent_plai']);
    expect(LECTEURS).toEqual(EDITEURS);
  });

  it('ROLES a quatre rôles et LIBELLE_ROLE quatre libellés non vides', () => {
    expect(ROLES).toEqual(['admin', 'referent_plai', 'direction', 'agent_plai']);
    expect(Object.keys(LIBELLE_ROLE).sort()).toEqual([...ROLES].sort());
    for (const r of ROLES) expect(LIBELLE_ROLE[r].length).toBeGreaterThan(0);
  });

  it('chaque capacité a un id unique, un libellé, un effet et une valeur (true, false ou null) pour chaque rôle', () => {
    const ids = CAPACITES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CAPACITES) {
      expect(c.libelle.length).toBeGreaterThan(0);
      expect(c.effet.length).toBeGreaterThan(0);
      for (const r of ROLES) expect([true, false, null]).toContain(c.roles[r]);
    }
  });

  it('les douze capacités attendues sont présentes', () => {
    expect(CAPACITES.map((c) => c.id)).toEqual([
      'consulter_fiches', 'saisir', 'ajouter_au', 'retirer_au', 'creer_classe', 'supprimer_renommer_classe',
      'changer_classe', 'reprise', 'creer_liens', 'gerer_tous_liens', 'mon_ecole', 'administration',
    ]);
  });

  it("cellules de l'agent accompagnant épinglées", () => {
    const agent = (id) => CAPACITES.find((c) => c.id === id).roles.agent_plai;
    for (const id of ['creer_classe', 'ajouter_au', 'creer_liens']) expect(agent(id)).toBe(true);
    for (const id of ['retirer_au', 'supprimer_renommer_classe', 'changer_classe', 'reprise', 'gerer_tous_liens', 'administration']) expect(agent(id)).toBe(false);
  });

  it('admin est vrai pour toute capacité sauf mon_ecole (faux)', () => {
    for (const c of CAPACITES) expect(c.roles.admin).toBe(c.id !== 'mon_ecole');
  });

  it('chaque capacité cite sa preuve (fichier:ligne)', () => {
    for (const c of CAPACITES) expect(c.preuve).toMatch(/\S+:\d+/);
  });

  it("administration n'est vraie que pour admin", () => {
    expect(rolesAvec('administration')).toEqual(['admin']);
  });

  it('mon_ecole est faux pour admin et vrai pour les trois autres', () => {
    expect(rolesAvec('mon_ecole')).toEqual(['referent_plai', 'direction', 'agent_plai']);
  });

  it("rolesAvec d'une capacité inconnue renvoie []", () => {
    expect(rolesAvec('inconnu')).toEqual([]);
  });
});
