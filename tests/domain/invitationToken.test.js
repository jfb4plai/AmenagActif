// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';
import { signInvitationToken, verifyInvitationToken, verifyFicheToken, signFicheToken } from '../../api/_lib/jwt.js';

beforeAll(() => { process.env.AMENAG_TOKEN_SECRET = 'secret-de-test-assez-long-0123456789'; });

describe("jeton d'invitation", () => {
  it("aller-retour : retrouve l'email", async () => {
    const t = await signInvitationToken({ email: 'a@b.be' });
    expect(await verifyInvitationToken(t)).toEqual({ email: 'a@b.be' });
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
