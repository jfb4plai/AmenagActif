import { SignJWT, jwtVerify } from 'jose';

const secret = () => {
  const s = process.env.AMENAG_TOKEN_SECRET;
  if (!s) throw new Error('AMENAG_TOKEN_SECRET manquant');
  return new TextEncoder().encode(s);
};

/** @param {{ classeId: string, joursValide?: number }} p */
export async function signFicheToken({ classeId, joursValide = 120 }) {
  return new SignJWT({ classeId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${joursValide}d`)
    .sign(secret());
}

export async function verifyFicheToken(token) {
  const { payload } = await jwtVerify(token, secret());
  return { classeId: payload.classeId };
}
