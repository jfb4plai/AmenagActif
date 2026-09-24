import { SignJWT, jwtVerify, errors } from 'jose';
import { randomUUID } from 'node:crypto';

const secret = () => {
  const s = process.env.AMENAG_TOKEN_SECRET;
  if (!s) throw new Error('AMENAG_TOKEN_SECRET manquant');
  return new TextEncoder().encode(s);
};

/** @param {{ classeId?: string, classeIds?: string[], nomGroupe?: string, joursValide?: number }} p */
export async function signFicheToken({ classeId, classeIds, nomGroupe, joursValide = 120 }) {
  const payload = classeIds && classeIds.length > 0 ? { classeIds, nomGroupe: nomGroupe || null } : { classeId };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${joursValide}d`)
    .sign(secret());
}

/** @returns {Promise<{ classeId: string }|{ classeIds: string[], nomGroupe: string|null }>} */
export async function verifyFicheToken(token) {
  const { payload } = await jwtVerify(token, secret());
  // Un jeton portant une audience (ex. 'profil') n'est PAS un jeton de fiche. Les jetons de fiche
  // historiques n'ont pas de claim aud : ils restent valides.
  if (payload.aud !== undefined) throw new errors.JWTClaimValidationFailed('audience inattendue', payload, 'aud', 'check_failed');
  if (Array.isArray(payload.classeIds) && payload.classeIds.length > 0) {
    return { classeIds: payload.classeIds, nomGroupe: payload.nomGroupe ?? null };
  }
  return { classeId: payload.classeId };
}

export const AUDIENCE_PROFIL = 'profil';
export const JOURS_PROFIL_DEFAUT = 120; // À valider ; surchargeable par AMENAG_PROFIL_JOURS (non secret)

export function joursProfil() {
  const n = Number(process.env.AMENAG_PROFIL_JOURS);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? Math.floor(n) : JOURS_PROFIL_DEFAUT;
}

/** Jeton passerelle « profil de classe » : audience distincte du jeton de fiche, jti unique. */
export async function signProfilToken({ classeId, joursValide = joursProfil() }) {
  return new SignJWT({ classeId })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE_PROFIL)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${joursValide}d`)
    .sign(secret());
}

/** @returns {Promise<{ classeId: string, jti: string, exp: number }>} Lève si signature, aud ou exp invalide. */
export async function verifyProfilToken(token) {
  const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE_PROFIL, algorithms: ['HS256'] });
  if (typeof payload.classeId !== 'string' || !payload.jti) throw new errors.JWTClaimValidationFailed('claims manquants', payload, 'classeId', 'missing');
  return { classeId: payload.classeId, jti: payload.jti, exp: payload.exp };
}
