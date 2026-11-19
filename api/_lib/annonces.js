// Messages de l'administrateur à tous les comptes (« Nouveautés », points d'attention), via Brevo.
// Logique séparée du handler pour être testée sans réseau : l'envoi est injecté.
import { envoyerEmail } from './email.js';
import { texteVersHtml } from '../../src/domain/texteMessage.js';

export { texteVersHtml }; // même conversion que l'aperçu affiché à l'administrateur

export const ROLES = ['admin', 'referent_plai', 'direction', 'agent_plai'];
export const LABEL_ROLE = { admin: 'Administrateur', referent_plai: 'Référent PLAI', direction: 'Direction', agent_plai: 'Agent accompagnant' };
export const MAX_SUJET = 120;
export const MAX_CORPS = 5000;
export const DELAI_DOUBLON_MS = 10 * 60 * 1000;
const PARALLELE = 10;
const CONTACT = 'jeanfrancois.beguin@ens.ecl.be';

export class ErreurAnnonce extends Error {
  constructor(statut, message) { super(message); this.name = 'ErreurAnnonce'; this.statut = statut; }
}

function habiller(corpsHtml, banniere = '') {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a">${banniere}${corpsHtml}`
    + `<hr style="border:none;border-top:1px solid #ddd;margin:24px 0 8px">`
    + `<p style="font-size:14px;color:#555">Vous recevez ce message parce que vous avez un compte AménagActif (Pôle Territorial de la Ville de Liège, PLAI). Une question : ${CONTACT}</p></div>`;
}

/** Valide et normalise la saisie. @returns {{ sujet: string, corps: string, roles: string[] }} */
export function validerAnnonce({ sujet, corps, roles }) {
  const s = typeof sujet === 'string' ? sujet.trim() : '';
  const c = typeof corps === 'string' ? corps.trim() : '';
  if (s.length < 1 || s.length > MAX_SUJET) throw new ErreurAnnonce(400, `Le sujet compte de 1 à ${MAX_SUJET} caractères.`);
  if (c.length < 1 || c.length > MAX_CORPS) throw new ErreurAnnonce(400, `Le message compte de 1 à ${MAX_CORPS} caractères.`);
  if (!Array.isArray(roles) || roles.length === 0 || !roles.every((r) => ROLES.includes(r))) throw new ErreurAnnonce(400, 'Choisissez au moins un type de destinataire.');
  return { sujet: s, corps: c, roles: ROLES.filter((r) => roles.includes(r)) };
}

/** Adresses distinctes (minuscules) des comptes ayant l'un des rôles, avec le décompte par rôle. */
export async function destinataires(db, roles) {
  const { data: profils, error } = await db.from('ar_profils_acces').select('user_id, role').in('role', roles);
  if (error) throw error;
  const trouves = [];
  let sansAdresse = 0;
  for (let i = 0; i < (profils ?? []).length; i += PARALLELE) {
    const lot = profils.slice(i, i + PARALLELE);
    const reponses = await Promise.all(lot.map((p) => db.auth.admin.getUserById(p.user_id)));
    reponses.forEach((r, k) => { const mail = r.data?.user?.email?.trim().toLowerCase(); if (mail) trouves.push({ mail, role: lot[k].role }); else sansAdresse += 1; });
  }
  const vus = new Set();
  const adresses = [];
  const parRole = {};
  for (const t of trouves) {
    if (vus.has(t.mail)) continue;
    vus.add(t.mail);
    adresses.push(t.mail);
    parRole[t.role] = (parRole[t.role] ?? 0) + 1;
  }
  return { adresses, parRole, sansAdresse };
}

/** Nombre de comptes par rôle (sans lire d'adresse) : pour afficher les effectifs avant l'envoi. */
export async function effectifs(db) {
  const { data, error } = await db.from('ar_profils_acces').select('role');
  if (error) throw error;
  const n = {};
  for (const r of data ?? []) n[r.role] = (n[r.role] ?? 0) + 1;
  return n;
}

async function envoyerParLots(adresses, sujet, html, envoyer) {
  let ok = 0;
  let ko = 0;
  const detail = []; // { adresse, ok } dans l'ordre d'envoi
  for (let i = 0; i < adresses.length; i += PARALLELE) {
    const lot = adresses.slice(i, i + PARALLELE);
    const resultats = await Promise.allSettled(lot.map((to) => envoyer({ to, subject: sujet, html })));
    resultats.forEach((r, k) => {
      if (r.status === 'fulfilled') ok += 1;
      else { ko += 1; console.error('annonces : envoi échoué', r.reason?.status ?? ''); }
      detail.push({ adresse: lot[k], ok: r.status === 'fulfilled' });
    });
  }
  return { ok, ko, detail };
}

/**
 * mode 'test' : exemplaire à TOUS les administrateurs (objet préfixé [TEST], bandeau), rien n'est journalisé.
 * mode 'envoyer' : envoi réel aux rôles choisis, journalisé ; refusé si le même message est parti il y a moins de 10 minutes.
 * Pour 'test', la réponse porte aussi `detail` (une ligne par administrateur : adresse, accepté ou non par Brevo) et
 * `sansAdresse` (administrateurs dont le compte n'a pas d'adresse lisible). Jamais pour l'envoi réel : aucune adresse n'est renvoyée.
 * @returns {Promise<{ envoyes: number, echecs: number, parRole: object, detail?: Array, sansAdresse?: number }>}
 */
export async function envoyerAnnonce(db, { mode, sujet, corps, roles, userId }, envoyer = envoyerEmail, now = new Date()) {
  const v = validerAnnonce({ sujet, corps, roles });
  const corpsHtml = texteVersHtml(v.corps);

  if (mode === 'test') {
    const reels = await destinataires(db, v.roles);
    const { adresses, parRole, sansAdresse } = await destinataires(db, ['admin']);
    if (adresses.length === 0) throw new ErreurAnnonce(400, 'Aucun administrateur joignable.');
    const banniere = `<p style="background:#fff3e6;border:1px solid #f97316;padding:8px"><strong>Exemplaire de test.</strong> Le message réel partira à ${reels.adresses.length} personne${reels.adresses.length > 1 ? 's' : ''} après votre envoi.</p>`;
    const { ok, ko, detail } = await envoyerParLots(adresses, `[TEST] ${v.sujet}`, habiller(corpsHtml, banniere), envoyer);
    return { envoyes: ok, echecs: ko, parRole, detail, sansAdresse };
  }

  if (mode !== 'envoyer') throw new ErreurAnnonce(400, 'Action inconnue.');
  const depuis = new Date(now.getTime() - DELAI_DOUBLON_MS).toISOString();
  const { data: recents, error: eR } = await db.from('ar_annonces').select('id').eq('sujet', v.sujet).eq('corps', v.corps).gte('envoye_le', depuis);
  if (eR) throw eR;
  if ((recents ?? []).length > 0) throw new ErreurAnnonce(409, 'Ce message vient déjà de partir (il y a moins de 10 minutes). Rien n\'a été renvoyé.');

  const { adresses, parRole } = await destinataires(db, v.roles);
  if (adresses.length === 0) throw new ErreurAnnonce(400, 'Aucun destinataire pour cette sélection.');
  const { ok, ko } = await envoyerParLots(adresses, v.sujet, habiller(corpsHtml), envoyer);
  const { error: eJ } = await db.from('ar_annonces').insert({ sujet: v.sujet, corps: v.corps, roles: v.roles, nb_destinataires: ok, nb_echecs: ko, envoye_par: userId, envoye_le: now.toISOString() });
  if (eJ) console.error('annonces : journal indisponible', eJ.code ?? '');
  return { envoyes: ok, echecs: ko, parRole };
}
