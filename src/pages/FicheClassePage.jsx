export default function FicheClassePage({ picker }) {
  return <div className="plai-section">Fiche classe {picker ? '(sélecteur)' : ''} (à venir)</div>;
}
