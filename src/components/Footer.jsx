import { Link } from 'react-router-dom';
import { rouvrirBandeauAvantages } from './BandeauAvantages.jsx';

export default function Footer() {
  return (
    <footer className="plai-footer flex flex-wrap items-center gap-3 px-4 py-6 text-sm text-[color:var(--text3)]">
      <img src="/plai-logo.jpg" alt="" style={{ height: 40, width: 'auto' }} />
      <span>AménagActif — Pôle Territorial de la Ville de Liège (PLAI). Diffusion restreinte aux enseignants concernés.</span>
      <Link
        to="/saisie" onClick={rouvrirBandeauAvantages}
        className="underline text-[color:var(--teal)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
      >
        Avantages de l'application PLAI
      </Link>
    </footer>
  );
}