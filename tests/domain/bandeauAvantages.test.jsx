import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BandeauAvantages, { AVANTAGES } from '../../src/components/BandeauAvantages.jsx';
import Footer from '../../src/components/Footer.jsx';

const actif = (container) => container.querySelector('[data-actif="true"]');
const titreActif = (container) => actif(container).querySelector('strong').textContent;
const avancer = (ms) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  vi.spyOn(Math, 'random').mockReturnValue(0); // ordre mélangé déterministe
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.matchMedia;
});

describe('bandeau d\'avantages', () => {
  it('affiche tous les avantages dans une région nommée, un seul visible à la fois', () => {
    const { container } = render(<BandeauAvantages />);
    expect(screen.getByRole('region', { name: /Pourquoi AménagActif/ })).toBeTruthy();
    const n = AVANTAGES.length;
    expect(n).toBe(11);
    expect(container.querySelectorAll('p[data-actif]')).toHaveLength(n);
    expect(container.querySelectorAll('[data-actif="true"]')).toHaveLength(1);
    // les messages inactifs sont cachés aux lecteurs d'écran
    expect(container.querySelectorAll('p[aria-hidden="true"]')).toHaveLength(n - 1);
  });

  it('passe au message suivant après 10 s, pas avant', () => {
    const { container } = render(<BandeauAvantages />);
    const premier = titreActif(container);
    avancer(9000);
    expect(titreActif(container)).toBe(premier);
    avancer(1200);
    expect(titreActif(container)).not.toBe(premier);
  });

  it('couvre tous les messages puis reboucle, sans en répéter un avant la fin du cycle', () => {
    const { container } = render(<BandeauAvantages />);
    const vus = [titreActif(container)];
    for (let i = 0; i < AVANTAGES.length - 1; i += 1) { avancer(10100); vus.push(titreActif(container)); }
    expect(new Set(vus).size).toBe(AVANTAGES.length);
    avancer(10100);
    expect(titreActif(container)).toBe(vus[0]);
  });

  it('l\'ordre est aléatoire : un autre tirage donne un autre premier message', () => {
    Math.random.mockReturnValue(0);
    const a = render(<BandeauAvantages />);
    const premierA = titreActif(a.container);
    a.unmount();
    Math.random.mockReturnValue(0.99);
    const b = render(<BandeauAvantages />);
    expect(titreActif(b.container)).not.toBe(premierA);
  });

  it('pause puis reprise', () => {
    const { container } = render(<BandeauAvantages />);
    const premier = titreActif(container);
    fireEvent.click(screen.getByRole('button', { name: /Mettre en pause/ }));
    avancer(60000);
    expect(titreActif(container)).toBe(premier);
    fireEvent.click(screen.getByRole('button', { name: /Reprendre le défilement/ }));
    avancer(10200);
    expect(titreActif(container)).not.toBe(premier);
  });

  it('précédent / suivant naviguent à la main et remettent le minuteur à zéro', () => {
    const { container } = render(<BandeauAvantages />);
    const premier = titreActif(container);
    avancer(8000);
    fireEvent.click(screen.getByRole('button', { name: 'Message suivant' }));
    const second = titreActif(container);
    expect(second).not.toBe(premier);
    avancer(8000); // 8 s depuis le clic : pas encore de changement automatique
    expect(titreActif(container)).toBe(second);
    fireEvent.click(screen.getByRole('button', { name: 'Message précédent' }));
    expect(titreActif(container)).toBe(premier);
  });

  it('s\'arrête tant que la souris survole le texte', () => {
    const { container } = render(<BandeauAvantages />);
    const premier = titreActif(container);
    const zone = actif(container).parentElement;
    fireEvent.mouseEnter(zone);
    avancer(40000);
    expect(titreActif(container)).toBe(premier);
    fireEvent.mouseLeave(zone);
    avancer(10200);
    expect(titreActif(container)).not.toBe(premier);
  });

  it('les lecteurs d\'écran ne sont sollicités qu\'après une navigation à la main', () => {
    const { container } = render(<BandeauAvantages />);
    const zone = actif(container).parentElement;
    expect(zone.getAttribute('aria-live')).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: 'Message suivant' }));
    expect(zone.getAttribute('aria-live')).toBe('polite');
  });

  it('fermer : le bandeau disparaît et le choix est mémorisé', () => {
    const { unmount } = render(<BandeauAvantages />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le bandeau' }));
    expect(screen.queryByRole('region', { name: /Pourquoi AménagActif/ })).toBeNull();
    expect(window.localStorage.getItem('amenagactif.bandeau-avantages.ferme')).toBe('1');
    unmount();
    render(<BandeauAvantages />);
    expect(screen.queryByRole('region', { name: /Pourquoi AménagActif/ })).toBeNull();
  });

  it('réglage « réduire les animations » : pas de défilement automatique, lecture possible à la demande', () => {
    window.matchMedia = () => ({ matches: true });
    const { container } = render(<BandeauAvantages />);
    const premier = titreActif(container);
    avancer(60000);
    expect(titreActif(container)).toBe(premier);
    expect(screen.getByRole('button', { name: /Reprendre le défilement/ })).toBeTruthy();
  });

  it('le stockage indisponible ne casse pas le bandeau', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqué'); });
    render(<BandeauAvantages />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le bandeau' }));
    expect(screen.queryByRole('region', { name: /Pourquoi AménagActif/ })).toBeNull();
  });

  it('lien « Avantages de l\'application PLAI » du pied de page : fait revenir le bandeau fermé', () => {
    render(<MemoryRouter><BandeauAvantages /><Footer /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le bandeau' }));
    expect(screen.queryByRole('region', { name: /Pourquoi AménagActif/ })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: "Avantages de l'application PLAI" }));
    expect(screen.getByRole('region', { name: /Pourquoi AménagActif/ })).toBeTruthy();
    expect(window.localStorage.getItem('amenagactif.bandeau-avantages.ferme')).toBeNull();
  });

  it('depuis une autre page : le lien efface le choix, le bandeau apparaît à l\'arrivée sur la saisie', () => {
    window.localStorage.setItem('amenagactif.bandeau-avantages.ferme', '1');
    render(<MemoryRouter><Footer /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: "Avantages de l'application PLAI" }));
    render(<BandeauAvantages />);
    expect(screen.getByRole('region', { name: /Pourquoi AménagActif/ })).toBeTruthy();
  });
});