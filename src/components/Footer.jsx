import { Link } from 'react-router-dom';
import { rouvrirBandeauAvantages } from './BandeauAvantages.jsx';

export default function Footer() {
  return (
    <footer className="plai-footer flex flex-wrap items-center gap-3 px-4 py-6 text-sm text-[color:var(--text3)]">
      <img src="/plai-logo.jpg" alt="" style={{ height: 40, width: 'auto' }} />
      <span>AménagActif — Pôle Territorial de la Ville de Liège (PLAI). Diffusion restreinte aux enseignants concernés.</span>
      <Link
        to="/saisie" onClick={rouvrirBandeauAvantages}
        className="inline-block rounded-full border border-[color:var(--teal-border)] bg-[color:var(--teal-bg)] px-4 py-2 font-semibold text-[color:var(--teal)] no-underline hover:brightness-95 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
        style={{ fontSize: 16 }}
      >
        Avantages de l'application PLAI
      </Link>
      <a
        href="/modes-emploi/index.html" target="_blank" rel="noopener noreferrer"
        className="underline text-[color:var(--teal)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
        style={{ fontSize: 16 }}
      >
        Modes d'emploi (nouvel onglet)
      </a>
      <p className="w-full m-0" style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'left' }}>
        Code :{' '}
        <a
          href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noopener noreferrer"
          className="underline text-[color:var(--text2)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
        >
          PolyForm Noncommercial 1.0.0
        </a>
        {' · '}Contenus :{' '}
        <a
          href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer"
          className="underline text-[color:var(--text2)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
        >
          CC BY-NC-SA 4.0
        </a>
        {' · '}Jean-François Beguin, jfb4plai.com
      </p>
    </footer>
  );
}