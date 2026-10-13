// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';
import { signInvitationToken, verifyInvitationToken, verifyFicheToken, signFicheToken, invitationDejaUtilisee } from '../../api/_lib/jwt.js';

beforeAll(() => { process.env.AMENAG_TOKEN_SECRET = 'secret-de-test-assez-long-0123456789'; });

describe("jeton d'invitation", () => {
  it("aller-retour : retrouve l'email", async () => {
    const t = await signInvitationToken({ email: 'a@b.be' });
    const v = await verifyInvitationToken(t);
    expect(v.email).toBe('a@b.be');
    expect(v.uid).toBeNull(); // ancien format : pas de contrôle d'usage unique possible
    expect(typeof v.iat).toBe('number');
  });
  it("porte l'uid du compte quand il est fourni", async () => {
    const t = await signInvitationToken({ email: 'a@b.be', uid: 'u-123' });
    expect((await verifyInvitationToken(t)).uid).toBe('u-123');
  });
  it('valable 7 jours', async () => {
    const t = await signInvitationToken({ email: 'a@b.be' });
    const p = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
    expect(p.exp - p.iat).toBe(7 * 86400);
  });
  it('expiré : refusé', async () => {
    const s = new TextEncoder().encode(process.env.AMENAG_TOKEN_SECRET);
    const t = await new SignJWT({ email: 'a@b.be' }).setProtectedHeader({ alg: 'HS256' }).setAudience('invitation')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 10).setExpirationTime(Math.floor(Date.now() / 1000) - 5).sign(s);
    await expect(verifyInvitationToken(t)).rejects.toThrow();
  });
  it("un jeton de fiche n'est pas un jeton d'invitation, et inversement", async () => {
    await expect(verifyInvitationToken(await signFicheToken({ classeId: 'x' }))).rejects.toThrow();
    await expect(verifyFicheToken(await signInvitationToken({ email: 'a@b.be' }))).rejects.toThrow();
  });
});

describe("usage unique de l'invitation", () => {
  const iat = 1_760_000_000; // secondes
  it('jamais connecté : lien utilisable', () => {
    expect(invitationDejaUtilisee(iat, null)).toBe(false);
    expect(invitationDejaUtilisee(iat, undefined)).toBe(false);
  });
  it('connecté AVANT l\'émission (ré-invitation) : lien utilisable', () => {
    expect(invitationDejaUtilisee(iat, new Date((iat - 60) * 1000).toISOString())).toBe(false);
  });
  it('connecté après l\'émission : lien déjà utilisé', () => {
    expect(invitationDejaUtilisee(iat, new Date((iat + 60) * 1000).toISOString())).toBe(true);
  });
  it('date illisible : pas de blocage', () => {
    expect(invitationDejaUtilisee(iat, 'pas une date')).toBe(false);
  });
});
