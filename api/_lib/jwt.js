import { SignJWT, jwtVerify } from 'jose';

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
  if (Array.isArray(payload.classeIds) && payload.classeIds.length > 0) {
    return { classeIds: payload.classeIds, nomGroupe: payload.nomGroupe ?? null };
  }
  return { classeId: payload.classeId };
}
