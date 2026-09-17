const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const EXPEDITEUR = { name: 'AménagActif', email: 'no-reply@mail.amenagactif.jfb4plai.com' };

/** Envoie un email via l'API transactionnelle Brevo. Lève une erreur si l'envoi échoue. */
export async function envoyerEmail({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY manquant');
  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({ sender: EXPEDITEUR, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Envoi email Brevo échoué (${res.status}) : ${detail}`);
  }
}
