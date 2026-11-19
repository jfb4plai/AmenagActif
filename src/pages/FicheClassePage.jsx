import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useFicheClasse, useFicheGroupe } from '../hooks/useFicheClasse.js';
import { useEcoles, useAnnees, useEcoleGrid } from '../hooks/useEcoleGrid.js';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { imprimerFiche, piedFicheClasse } from '../lib/imprimerFiche.js';
import { useRole } from '../lib/auth.jsx';
import GenerateurLien from '../components/GenerateurLien.jsx';
import ChoixModeLien from '../components/ChoixModeLien.jsx';
import FicheGroupeeForm from '../components/FicheGroupeeForm.jsx';
import { useFichesGroupees, useEnregistrerFicheGroupee, useSupprimerFicheGroupee } from '../hooks/useFichesGroupees.js';
import { useAConfirmerClasses } from '../hooks/useAConfirmer.js';
import { messageAvantEnvoi } from '../domain/changementClasse.js';

// Guide qui décrit le sommaire, selon le rôle (l'agent accompagnant utilise le guide des référents PLAI).
const GUIDE_SOMMAIRE = { direction: '/modes-emploi/directions.html#sommaire' };
const GUIDE_SOMMAIRE_DEFAUT = '/modes-emploi/referents-plai.html#sommaire';

/** Annonce permanente du sommaire (nouveauté) : sans elle, le choix n'apparaît qu'après avoir coché deux classes. */
function NoteSommaire({ role }) {
  return (
    <aside role="note" aria-label="Nouveauté : le sommaire de classes" className="plai-card p-3 space-y-1 max-w-3xl no-print">
      <p className="font-medium" style={{ fontSize: 16 }}>Nouveau : le sommaire, pour un enseignant qui a plusieurs classes</p>
      <>
          <p className="text-[color:var(--text2)]" style={{ fontSize: 16 }}>
            Un seul lien ouvre la liste de ses classes ; chacune garde sa propre fiche. Pour le créer, cochez au moins deux classes ci-dessous, puis choisissez « Un sommaire : une fiche par classe ». Pour y mettre aussi un cours commun à plusieurs classes, enregistrez d'abord une fiche groupée (section « Fiches groupées »), puis cochez-la comme une classe.
          </p>
          <p style={{ fontSize: 16 }}>
            <a className="text-teal underline" href={GUIDE_SOMMAIRE[role] ?? GUIDE_SOMMAIRE_DEFAUT} target="_blank" rel="noopener noreferrer">
              Mode d'emploi du sommaire
            </a>
          </p>
      </>
    </aside>
  );
}

function Picker() {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const { isAdmin, role } = useRole();
  const ecoleUnique = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;
  const [ecoleId, setEcoleId] = useState('');
  const [anneeId, setAnneeId] = useState('');
  const [selection, setSelection] = useState(new Set());
  const [nomGroupe, setNomGroupe] = useState('');
  const [valide, setValide] = useState(null); // { classeIds, nomGroupe } une fois "Valider" cliqué
  const [selectionFg, setSelectionFg] = useState(new Set()); // fiches groupées enregistrées cochées (pour un sommaire)
  const [formFg, setFormFg] = useState(null); // null | { initial } : formulaire de création / modification
  const peutGrouper = role === 'admin' || role === 'referent_plai' || role === 'direction' || role === 'agent_plai';
  const peutLier = true; // tous les rôles éditeurs créent des liens (cf. api/_lib/ficheData.js) ; l'agent ne gère que les siens (api/liens.js)
  const [mode, setMode] = useState('fusion'); // 'fusion' | 'sommaire' (sommaire : rôles pouvant lier, 2 classes ou plus)
  const nbElements = selection.size + selectionFg.size; // une fiche groupée cochée compte comme une classe
  // Une fiche groupée cochée impose le sommaire : une fiche fusionnée ne contient que des classes.
  const sommaire = peutLier && nbElements >= 2 && (selectionFg.size > 0 || mode === 'sommaire');
  // En mode sommaire, l'aperçu fusionné n'est pas chargé (ids indéfinis : requête désactivée).
  const apercu = useFicheGroupe(sommaire ? undefined : valide?.classeIds, valide?.nomGroupe);
  const aConfirmer = useAConfirmerClasses(valide?.classeIds);

  useEffect(() => {
    if (ecoleUnique && ecoleId !== ecoleUnique.id) setEcoleId(ecoleUnique.id);
  }, [ecoleUnique, ecoleId]);
  useEffect(() => {
    if (!anneeId && annees.length) {
      const active = annees.find((a) => a.active);
      if (active) setAnneeId(active.id);
    }
  }, [annees, anneeId]);
  const { data: grid } = useEcoleGrid(ecoleId || null, anneeId || null);
  const fiches = useFichesGroupees(ecoleId || null, anneeId || null).data ?? [];
  const enregistrerFg = useEnregistrerFicheGroupee(ecoleId, anneeId);
  const supprimerFg = useSupprimerFicheGroupee(ecoleId, anneeId);

  function basculer(classeId) {
    setSelection((s) => {
      const n = new Set(s);
      n.has(classeId) ? n.delete(classeId) : n.add(classeId);
      return n;
    });
    setValide(null); // toute modification de la sélection invalide l'aperçu déjà confirmé
  }

  function basculerFg(id) {
    setSelectionFg((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setValide(null);
  }

  async function enregistrerFiche({ id, nom, classeIds }) {
    try {
      await enregistrerFg.mutateAsync({ id, nom, classeIds });
      setFormFg(null);
    } catch {
      // le message reste affiché dans le formulaire (enregistrerFg.error)
    }
  }

  function supprimerFiche(f) {
    if (!confirm(`Supprimer la fiche groupée « ${f.nom} » ? Elle disparaîtra aussi des sommaires qui la contiennent. Les classes ne sont pas touchées.`)) return;
    setSelectionFg((s) => { const n = new Set(s); n.delete(f.id); return n; });
    supprimerFg.mutate(f.id);
  }

  function changerMode(m) {
    setMode(m);
    setValide(null); // changer de mode invalide l'aperçu déjà confirmé
  }

  // Changer d'école ou d'année vide la sélection : le sommaire ne compte jamais de classe absente de la liste.
  function changerEcole(id) {
    setEcoleId(id);
    setSelection(new Set());
    setSelectionFg(new Set());
    setFormFg(null);
    setValide(null);
  }

  function changerAnnee(id) {
    setAnneeId(id);
    setSelection(new Set());
    setSelectionFg(new Set());
    setFormFg(null);
    setValide(null);
  }

  function changerNomGroupe(v) {
    setNomGroupe(v);
    setValide(null);
  }

  return (
    <div className="plai-section space-y-3">
      <h1 className="text-xl font-semibold no-print">Fiches par classe</h1>
      <Link className="text-sm text-teal underline no-print" to="/fiches/ecole">Voir la fiche « vue école complète »</Link>
      <NoteSommaire role={role} />
      <div className="flex gap-3 no-print">
        {ecoleUnique ? (
          <span className="plai-input inline-block bg-[color:var(--bg)]">{ecoleUnique.nom}</span>
        ) : (
          <select className="plai-input" aria-label="École" value={ecoleId} onChange={(e) => changerEcole(e.target.value)}>
            <option value="">École…</option>
            {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        )}
        <select className="plai-input" aria-label="Année scolaire" value={anneeId} onChange={(e) => changerAnnee(e.target.value)}>
          <option value="">Année…</option>
          {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
        </select>
      </div>
      <ul className="space-y-1 no-print">
        {(grid?.classes ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            {peutGrouper && (
              <input type="checkbox" checked={selection.has(c.id)} onChange={() => basculer(c.id)}
                aria-label={`Sélectionner ${c.nom} pour un regroupement`} />
            )}
            <Link className="text-teal underline" to={`/classe/${c.id}/fiche`}>{c.nom}</Link>
          </li>
        ))}
      </ul>

      {(grid?.classes ?? []).length > 0 && (
        <section className="space-y-2 no-print" aria-label="Fiches groupées">
          <h2 className="font-medium" style={{ fontSize: 16 }}>Fiches groupées</h2>
          {fiches.length === 0 && (
            <p className="text-[color:var(--text2)]" style={{ fontSize: 16 }}>
              Aucune pour l'instant. Une fiche groupée réunit plusieurs classes en une seule fiche (cours commun) ; une fois enregistrée, elle se coche comme une classe pour composer un sommaire.
            </p>
          )}
          <ul className="space-y-1">
            {fiches.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2" style={{ fontSize: 16 }}>
                {peutGrouper && (
                  <input type="checkbox" className="w-5 h-5" checked={selectionFg.has(f.id)} onChange={() => basculerFg(f.id)}
                    aria-label={`Sélectionner la fiche groupée ${f.nom} pour un sommaire`} />
                )}
                <strong>{f.nom}</strong>
                <span className="text-[color:var(--text2)]">({f.classeIds.map((cid) => (grid?.classes ?? []).find((c) => c.id === cid)?.nom).filter(Boolean).join(' + ')})</span>
                <button type="button" className="underline text-teal" onClick={() => { setSelection(new Set()); setSelectionFg(new Set()); setFormFg(null); setValide({ classeIds: f.classeIds, nomGroupe: f.nom }); }}>
                  Aperçu{peutLier ? ' et lien' : ''}<span className="sr-only"> de {f.nom}</span>
                </button>
                {peutGrouper && (
                  <>
                    <button type="button" className="underline text-teal" onClick={() => { enregistrerFg.reset(); setFormFg({ initial: f }); }}>Modifier<span className="sr-only"> {f.nom}</span></button>
                    <button type="button" className="underline text-red-600" onClick={() => supprimerFiche(f)}>Supprimer<span className="sr-only"> {f.nom}</span></button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {supprimerFg.isError && <p role="alert" className="plai-error" style={{ fontSize: 16 }}>{supprimerFg.error.message}</p>}
          {fiches.length > 0 && peutGrouper && !sommaire && selectionFg.size === 1 && nbElements === 1 && (
            <p className="text-[color:var(--text2)]" style={{ fontSize: 16 }}>Cochez aussi une classe ou une autre fiche groupée pour composer un sommaire.</p>
          )}
          {peutGrouper && !formFg && (
            <button type="button" className="plai-btn" style={{ fontSize: 16 }} onClick={() => { enregistrerFg.reset(); setFormFg({ initial: null }); }}>
              + Nouvelle fiche groupée
            </button>
          )}
          {formFg && (
            <FicheGroupeeForm
              key={formFg.initial?.id ?? 'nouvelle'}
              classes={grid?.classes ?? []} initial={formFg.initial} classeIdsPreselection={[...selection]}
              enCours={enregistrerFg.isPending} erreur={enregistrerFg.error?.message}
              onEnregistrer={enregistrerFiche} onAnnuler={() => setFormFg(null)}
            />
          )}
        </section>
      )}

      {peutGrouper && nbElements >= 2 && (
        <div className="plai-card p-3 space-y-2 max-w-md no-print">
          <p className="font-medium" style={{ fontSize: 16 }}>
            {sommaire ? 'Sommaire' : 'Fiche groupée'} — {selectionFg.size > 0
              ? `${selection.size} classe${selection.size > 1 ? 's' : ''} et ${selectionFg.size} fiche${selectionFg.size > 1 ? 's' : ''} groupée${selectionFg.size > 1 ? 's' : ''} sélectionnée${nbElements > 1 ? 's' : ''}`
              : `${selection.size} classes sélectionnées`}
          </p>
          <p className="text-[color:var(--text2)]" style={{ fontSize: 16 }}>
            {sommaire
              ? (selectionFg.size > 0
                ? "Un seul lien pour l'enseignant : chaque classe ou fiche groupée garde sa propre fiche, il choisit celle qu'il veut ouvrir."
                : "Un seul lien pour l'enseignant : chaque classe garde sa propre fiche, il choisit celle qu'il veut ouvrir.")
              : 'Pour un cours pratique réunissant plusieurs classes (atelier, groupe transversal…) : une seule fiche, AU et AR fusionnés, sans doublon.'}
            {peutLier && " L'envoi du lien à l'enseignant reste à faire vous-même, comme pour une classe seule."}
          </p>
          {peutLier && selectionFg.size === 0 && <ChoixModeLien mode={mode} onChange={changerMode} nbClasses={selection.size} />}
          {!sommaire && (
          <label className="text-sm block">Nom du groupe (optionnel)
            <input className="plai-input w-full" placeholder="Atelier cuisine 3e" value={nomGroupe} onChange={(e) => changerNomGroupe(e.target.value)} />
            <span className="block text-xs text-[color:var(--text3)] font-normal">Affiché en titre de la fiche. Vide : les noms des classes sont concatenés (« 3LA + 3LB »).</span>
          </label>
          )}
          {!sommaire && (
          <button className="plai-btn" onClick={() => setValide({ classeIds: [...selection], nomGroupe: nomGroupe.trim() })}>
            Valider la sélection — voir la fiche
          </button>
          )}
        </div>
      )}

      {sommaire && (
        <div className="space-y-3 max-w-xl no-print">
          <div className="plai-card p-3 space-y-1" style={{ fontSize: 16 }}>
            <p className="font-medium">{selectionFg.size > 0 ? 'Contenu du sommaire' : 'Classes du sommaire'} ({nbElements})</p>
            <ul className="list-disc pl-5">
              {(grid?.classes ?? []).filter((c) => selection.has(c.id)).map((c) => <li key={c.id}>{c.nom}</li>)}
              {fiches.filter((f) => selectionFg.has(f.id)).map((f) => <li key={f.id}>Fiche groupée : {f.nom}</li>)}
            </ul>
          </div>
          <GenerateurLien
            key={`sommaire:${[...selection].sort().join(',')}|${[...selectionFg].sort().join(',')}`}
            mode="sommaire"
            classeIds={[...selection]}
            ficheGroupeeIds={[...selectionFg]}
            libelle={`Aménagements à mettre en place — Vos classes (${ecoleUnique?.nom ?? ecoles.find((e) => e.id === ecoleId)?.nom ?? ''})`}
            avertissement="Ce lien ouvre toutes les classes listées. Ne le transmettez qu'à l'enseignant concerné."
          />
        </div>
      )}

      {valide && !sommaire && (
        <div className="space-y-2 max-w-3xl">
          {apercu.isLoading && <p className="text-sm">Chargement de l'aperçu…</p>}
          {apercu.error && <p className="plai-error text-sm">{apercu.error.message}</p>}
          {apercu.data && (
            <>
              <p className="text-base no-print">
                Aperçu confirmé pour <strong>{apercu.data.classeNom}</strong> : vérifiez le contenu ci-dessous{peutLier && ' avant de générer le lien à envoyer'}.
              </p>
              <div className="no-print">
                <button className="plai-btn" onClick={() => imprimerFiche(piedFicheClasse(apercu.data))}>Imprimer / Enregistrer en PDF</button>
              </div>
              {peutLier && (
                <div className="no-print">
                  <GenerateurLien
                    classeIds={valide.classeIds}
                    nomGroupe={valide.nomGroupe}
                    libelle={`Aménagements à mettre en place — ${apercu.data.classeNom}`}
                    avertissement={messageAvantEnvoi(aConfirmer.data)}
                  />
                </div>
              )}
              <div className="apercu-fiche border border-[color:var(--border)] rounded overflow-auto max-h-[70vh]">
                <FicheClasseView vm={apercu.data} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function FicheClassePage({ picker }) {
  const { classeId } = useParams();
  if (picker || !classeId) return <Picker />;
  return <FicheClasseContenu classeId={classeId} />;
}

function FicheClasseContenu({ classeId }) {
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  const { role } = useRole();
  const aConfirmer = useAConfirmerClasses([classeId]);

  const [lienOuvert, setLienOuvert] = useState(false);

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">{error.message}</p></div>;
  return (
    <div className="plai-section space-y-3">
      <div className="flex gap-3 no-print">
        <button className="plai-btn" onClick={() => imprimerFiche(piedFicheClasse(vm))}>Imprimer / Enregistrer en PDF</button>
        {(
          <button className="plai-btn" style={{ fontSize: 16 }} aria-expanded={lienOuvert} onClick={() => setLienOuvert((o) => !o)}>
            Copier le lien enseignant
          </button>
        )}
      </div>
      {lienOuvert && (
        <GenerateurLien classeIds={[classeId]} libelle={`Aménagements à mettre en place — ${vm.classeNom} (${vm.ecoleNom})`}
          avertissement={messageAvantEnvoi(aConfirmer.data)} />
      )}
      <FicheClasseView vm={vm} />
    </div>
  );
}
