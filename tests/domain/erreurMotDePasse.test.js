import { describe, it, expect } from 'vitest';
import { messageErreurMotDePasse } from '../../src/domain/erreurMotDePasse.js';

describe('message d\'erreur à la définition du mot de passe', () => {
  it('même mot de passe : renvoie vers la connexion, sans parler de lien expiré', () => {
    const m = messageErreurMotDePasse({ code: 'same_password', name: 'AuthApiError' });
    expect(m.message).toMatch(/déjà le vôtre/);
    expect(m.message).not.toMatch(/expiré/);
    expect(m.versConnexion).toBe(true);
  });
  it('mot de passe faible', () => {
    const m = messageErreurMotDePasse({ code: 'weak_password', name: 'AuthWeakPasswordError' });
    expect(m.message).toMatch(/trop faible/);
    expect(m.versConnexion).toBe(false);
  });
  it('session absente : lien expiré + conseil navigateur', () => {
    const m = messageErreurMotDePasse({ name: 'AuthSessionMissingError' });
    expect(m.message).toMatch(/Session perdue/);
    expect(m.message).toMatch(/Safari ou Chrome/);
  });
  it('erreur inconnue : message générique', () => {
    expect(messageErreurMotDePasse(new Error('réseau')).message).toMatch(/Enregistrement impossible/);
    expect(messageErreurMotDePasse(null).versConnexion).toBe(true);
  });
});
