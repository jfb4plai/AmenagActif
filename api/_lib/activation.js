// Notification aux administrateurs : un compte vient de créer ou de changer son mot de passe.
// Première fois = « activé » ; ensuite = « modifié » (changement ou réinitialisation), pour repérer un accès frauduleux.
import { envoyerEmail } from './email.js';

const LABEL_ROLE = { admin: 'Administrateur', referent_plai: 'Référent PLAI', direction: 'Direction', agent_plai: 'Agent accompagnant' };
export const INTERVALLE_MIN_MS = 10 * 60 * 1000; // au plus un courriel par compte et par 10 minutes (anti-spam des admins)
const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const heureBruxelles = (d) => new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Brussels' }).format(d);

/**
 * @returns {Promise<'active'|'modifie'|'trop_tot'|'sans_profil'|'echec_envoi'>}
 * 'trop_tot' : déjà notifié il y a moins de INTERVALLE_MIN_MS. 'echec_envoi' : aucun admin joignable ;
 * pour une première activation la ligne est retirée (la prochaine tentative réessaie), sinon derniere_notif n'est pas avancée.
 */
export async function notifierActivation(db, user, envoyer = envoyerEmail, now = new Date()) {
  const { data: profil, error: eP } = await db.from('ar_profils_acces').select('role, nom, ecole_id').eq('user_id', user.id).maybeSingle();
  if (eP) throw eP;
  if (!profil) return 'sans_profil';

  const { data: deja, error: eD } = await db.from('ar_activations').select('derniere_notif').eq('user_id', user.id).maybeSingle();
  if (eD) throw eD;
  const premiere = !deja;
  if (premiere) {
    const { error: eI } = await db.from('ar_activations').insert({ user_id: user.id });
    if (eI) {
      if (eI.code === '23505') return 'trop_tot'; // appel concurrent : l'autre notifie
      throw eI;
    }
  } else if (now.getTime() - Date.parse(deja.derniere_notif) < INTERVALLE_MIN_MS) {
    return 'trop_tot';
  }

  const { data: liaisons, error: eL } = await db.from('ar_profils_acces_ecoles').select('ecole_id').eq('user_id', user.id);
  if (eL) throw eL;
  const ecoleIds = [...new Set([profil.ecole_id, ...(liaisons ?? []).map((l) => l.ecole_id)].filter(Boolean))];
  let ecoles = [];
  if (ecoleIds.length) {
    const { data, error } = await db.from('ar_ecoles').select('nom, implantation_nom').in('id', ecoleIds);
    if (error) throw error;
    ecoles = (data ?? []).map((e) => e.implantation_nom || e.nom).filter(Boolean);
  }

  const { data: admins, error: eA } = await db.from('ar_profils_acces').select('user_id').eq('role', 'admin');
  if (eA) throw eA;
  const adresses = [];
  for (const a of admins ?? []) {
    const { data } = await db.auth.admin.getUserById(a.user_id);
    if (data?.user?.email) adresses.push(data.user.email);
  }

  const intro = premiere
    ? 'Un compte AménagActif vient d\'être activé (premier mot de passe créé).'
    : 'Le mot de passe d\'un compte AménagActif vient d\'être modifié (changement ou réinitialisation « mot de passe oublié »). '
      + 'Si la personne ne l\'a pas fait ou ne s\'en souvient pas, vérifiez auprès d\'elle : le compte est peut-être compromis.';
  const html = `<p>Bonjour,</p><p>${intro}</p><ul>`
    + `<li>Adresse : ${echapper(user.email)}</li>`
    + (profil.nom ? `<li>Nom : ${echapper(profil.nom)}</li>` : '')
    + `<li>Rôle : ${echapper(LABEL_ROLE[profil.role] ?? profil.role)}</li>`
    + `<li>École(s) : ${ecoles.length ? ecoles.map(echapper).join(', ') : 'aucune'}</li>`
    + `<li>Date : ${echapper(heureBruxelles(now))}</li></ul>`;
  const subject = premiere ? 'AménagActif : nouveau compte activé' : 'AménagActif : mot de passe modifié';

  let envoyes = 0;
  for (const to of adresses) {
    try { await envoyer({ to, subject, html }); envoyes += 1; }
    catch (e) { console.error('activation : envoi échoué', e?.status ?? ''); }
  }
  if (envoyes === 0) {
    if (premiere) await db.from('ar_activations').delete().eq('user_id', user.id);
    return 'echec_envoi';
  }
  if (!premiere) await db.from('ar_activations').update({ derniere_notif: now.toISOString() }).eq('user_id', user.id);
  return premiere ? 'active' : 'modifie';
}
