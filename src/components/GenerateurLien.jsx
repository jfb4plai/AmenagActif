import { useId, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { copierLien } from '../lib/copierLien.js';
import { dateFR } from '../domain/liens.js';

const MAX_DESTINATAIRE = 80;

/**
 * Génère un lien enseignant opaque. Le destinataire est obligatoire : il sert à retrouver et révoquer le lien.
 * Props : classeIds (1 à 10), nomGroupe (fiche groupée), libelle (texte cliquable collé dans le courriel).
 */
export default function GenerateurLien({ classeIds, nomGroupe, libelle }) {
  const id = useId();
  const [destinataire, setDestinataire] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null); // { url, expire_le, copie }
  const [erreur, setErreur] = useState('');

  async function generer(e) {
    e.preventDefault();
    setErreur('');
    setResultat(null);
    if (!destinataire.trim()) { setErreur('Indiquez le destinataire du lien.'); return; }
    setEnCours(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/fiche-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ classeIds, nomGroupe: nomGroupe || undefined, destinataire: destinataire.trim() }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setErreur(b.error || 'Impossible de générer le lien.'); return; }
      const copie = await copierLien(b.url, libelle);
      setResultat({ url: b.url, expire_le: b.expire_le, copie });
    } catch {
      setErreur('Impossible de générer le lien. Vérifiez votre connexion et réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={generer} className="plai-card p-4 space-y-3 max-w-xl text-base no-print">
      <div>
        <label htmlFor={`${id}-dest`} className="block font-medium">Destinataire du lien (obligatoire)</label>
        <input
          id={`${id}-dest`}
          className="plai-input w-full text-base"
          style={{ fontSize: 16 }}
          value={destinataire}
          onChange={(e) => { setDestinataire(e.target.value); setResultat(null); }}
          maxLength={MAX_DESTINATAIRE}
          required
          aria-describedby={`${id}-aide`}
          placeholder="Mme Dupont, français, 3e TQ B"
        />
        <p id={`${id}-aide`} className="mt-1 text-[color:var(--text2)]" style={{ fontSize: 16 }}>
          Ce nom sert à retrouver ce lien plus tard dans « Liens enseignants » et à le révoquer si l'enseignant change ou quitte l'école.
          Il n'est jamais montré aux élèves ni sur la fiche.
        </p>
      </div>
      <button type="submit" className="plai-btn" style={{ fontSize: 16 }} disabled={enCours}>
        {enCours ? 'Génération…' : 'Générer et copier le lien'}
      </button>
      <div role="status" aria-live="polite">
        {resultat && (
          <div className="space-y-1">
            <p>
              {resultat.copie === 'echec'
                ? "Lien créé, mais la copie automatique a échoué : sélectionnez-le ci-dessous."
                : "Lien copié : collez-le dans votre courriel."}
            </p>
            <p className="break-all"><a className="text-teal underline" href={resultat.url} target="_blank" rel="noopener noreferrer">{resultat.url}</a></p>
            <p className="text-[color:var(--text2)]">Actif jusqu'à la fin de l'année scolaire ({dateFR(resultat.expire_le)}) ou jusqu'à sa révocation. Ce lien n'est affiché qu'ici : notez-le avant de quitter la page.</p>
          </div>
        )}
      </div>
      {erreur && <p role="alert" className="plai-error" style={{ fontSize: 16 }}>{erreur}</p>}
    </form>
  );
}
