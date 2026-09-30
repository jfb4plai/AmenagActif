import { useEffect, useState } from 'react';

/**
 * Bandeau d'avantages qui défile (10 s par message, ordre aléatoire à chaque chargement).
 * Garde-fous accessibilité : pause/lecture, précédent/suivant, arrêt au survol du texte,
 * pas de défilement automatique si l'utilisateur demande « réduire les animations »,
 * lecteurs d'écran non sollicités tant qu'on ne navigue pas à la main, bouton Fermer mémorisé.
 */
const DUREE_MS = 10000;
const PAS_MS = 100;
const CLE_FERME = 'amenagactif.bandeau-avantages.ferme';
const EVENEMENT_ROUVRIR = 'amenagactif:bandeau-avantages-rouvrir';
const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';

export const AVANTAGES = [
  { titre: 'Une saisie unique à l’école', texte: 'une colonne par élève, groupées par classe. Les AU se cochent une fois pour la classe, les AR élève par élève.' },
  { titre: 'La fiche de classe se génère toute seule', texte: 'à imprimer ou à enregistrer en PDF.' },
  { titre: 'Fiche toujours à jour', texte: 'l’enseignant voit la version actuelle à chaque ouverture de son lien.' },
  { titre: 'Enseignants sans compte', texte: 'un lien en lecture seule, révocable, qui expire le 31 août.' },
  { titre: 'Un vocabulaire commun', texte: 'plus de 130 aménagements classés en chapitres, avec recherche par mot-clé.' },
  { titre: 'RGPD', texte: 'prénom et initiale seulement, liens expirés supprimés, accès limité à son école.' },
  { titre: 'Ouvert aux autres apps PLAI', texte: 'le profil de classe peut leur être transmis.' },
];

function melanger(n) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function lireFerme() {
  try { return window.localStorage.getItem(CLE_FERME) === '1'; } catch { return false; }
}

function ecrireFerme() {
  try { window.localStorage.setItem(CLE_FERME, '1'); } catch { /* stockage indisponible : le bandeau reviendra */ }
}

/** Lien de réaffichage (pied de page) : efface le choix « Fermer » et réveille le bandeau s'il est déjà monté. */
export function rouvrirBandeauAvantages() {
  try { window.localStorage.removeItem(CLE_FERME); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new Event(EVENEMENT_ROUVRIR));
}

function animationsReduites() {
  try { return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

const Icone = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {d}
  </svg>
);
const ICONES = {
  precedent: <Icone d={<polyline points="15 6 9 12 15 18" />} />,
  suivant: <Icone d={<polyline points="9 6 15 12 9 18" />} />,
  pause: <Icone d={<><line x1="9" y1="6" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="18" /></>} />,
  lecture: <Icone d={<polygon points="8 5 19 12 8 19 8 5" fill="currentColor" />} />,
  fermer: <Icone d={<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>} />,
};

function Bouton({ label, onClick, children }) {
  return (
    <button
      type="button" aria-label={label} title={label} onClick={onClick}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-[color:var(--teal)] hover:bg-white/70 ${FOCUS}`}
    >
      {children}
    </button>
  );
}

export default function BandeauAvantages() {
  const [ferme, setFerme] = useState(lireFerme);
  const [ordre] = useState(() => melanger(AVANTAGES.length));
  const [index, setIndex] = useState(0);
  const [ecoule, setEcoule] = useState(0);
  const [lecture, setLecture] = useState(() => !animationsReduites());
  const [survol, setSurvol] = useState(false);
  const [manuel, setManuel] = useState(false); // vrai dès qu'on navigue à la main : la lecture d'écran annonce alors le message

  const enMarche = lecture && !survol && !ferme;

  useEffect(() => {
    const rouvrir = () => { setFerme(false); setIndex(0); setEcoule(0); setLecture(!animationsReduites()); };
    window.addEventListener(EVENEMENT_ROUVRIR, rouvrir);
    return () => window.removeEventListener(EVENEMENT_ROUVRIR, rouvrir);
  }, []);

  useEffect(() => {
    if (!enMarche) return undefined;
    const id = setInterval(() => setEcoule((ms) => ms + PAS_MS), PAS_MS);
    return () => clearInterval(id);
  }, [enMarche]);

  useEffect(() => {
    if (ecoule >= DUREE_MS) {
      setIndex((i) => (i + 1) % ordre.length);
      setEcoule(0);
    }
  }, [ecoule, ordre.length]);

  if (ferme) return null;

  const aller = (delta) => {
    setManuel(true);
    setIndex((i) => (i + delta + ordre.length) % ordre.length);
    setEcoule(0);
  };
  const fermer = () => { ecrireFerme(); setFerme(true); };

  return (
    <section
      aria-label="Pourquoi AménagActif"
      className="relative border-b border-[color:var(--teal-border)] bg-[color:var(--teal-bg)]"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap sm:gap-5">
        <span className="hidden md:inline-block shrink-0 rounded-full border border-[color:var(--teal-border)] bg-white/60 px-3 py-1 text-sm font-semibold text-[color:var(--teal)]">
          Pourquoi AménagActif ?
        </span>

        <div
          className="basis-full sm:basis-0 sm:flex-1 min-w-0 grid"
          aria-live={manuel ? 'polite' : 'off'}
          onMouseEnter={() => setSurvol(true)}
          onMouseLeave={() => setSurvol(false)}
        >
          {/* Tous les messages occupent la même cellule : la hauteur s'adapte au plus long, la page ne saute jamais. */}
          {AVANTAGES.map((a, i) => {
            const actif = ordre[index] === i;
            return (
              <p
                key={a.titre}
                data-actif={actif ? 'true' : 'false'}
                aria-hidden={actif ? undefined : 'true'}
                className={`col-start-1 row-start-1 leading-snug text-[color:var(--text)] transition-opacity duration-500 motion-reduce:transition-none ${actif ? 'opacity-100' : 'opacity-0 invisible'}`}
                style={{ fontSize: 18 }}
              >
                <strong className="font-semibold text-[color:var(--teal)]">{a.titre}</strong>
                {' : '}{a.texte}
              </p>
            );
          })}
        </div>

        <div className="shrink-0 flex items-center gap-1 ml-auto">
          <span className="hidden sm:inline text-sm tabular-nums text-[color:var(--text2)] mr-1" aria-hidden="true">{index + 1} / {ordre.length}</span>
          <Bouton label="Message précédent" onClick={() => aller(-1)}>{ICONES.precedent}</Bouton>
          <Bouton label={lecture ? 'Mettre en pause le défilement' : 'Reprendre le défilement'} onClick={() => setLecture((l) => !l)}>
            {lecture ? ICONES.pause : ICONES.lecture}
          </Bouton>
          <Bouton label="Message suivant" onClick={() => aller(1)}>{ICONES.suivant}</Bouton>
          <Bouton label="Fermer le bandeau" onClick={fermer}>{ICONES.fermer}</Bouton>
        </div>
      </div>

      {/* Avancement du message courant */}
      <div className="absolute left-0 bottom-0 h-[3px] w-full" style={{ background: 'rgba(29, 158, 117, 0.2)' }} aria-hidden="true">
        <div className="h-full bg-[color:var(--teal-border)]" style={{ width: `${Math.min(100, (ecoule / DUREE_MS) * 100)}%` }} />
      </div>
    </section>
  );
}
