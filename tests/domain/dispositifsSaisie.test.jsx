import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BandeauAU from '../../src/components/saisie/BandeauAU.jsx';
import CarteDispositif from '../../src/components/saisie/CarteDispositif.jsx';
import EnTeteDispositif from '../../src/components/saisie/EnTeteDispositif.jsx';
import ChapitreAR from '../../src/components/saisie/ChapitreAR.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const classe = { id: 'c1', nom: '3A' };
const chapitre = { id: 'ch1', ordre: 7, titre: '7. Dispositif test' };

describe('BandeauAU : confirmation au décochage', () => {
  const au = { id: 'au1', chapitre_id: 'ch1', ordre: 1, libelle: 'Police lisible' };
  const rendre = (auClasse, onToggle) => render(
    <BandeauAU classe={classe} auCatalogue={[au]} chapitres={[chapitre]} auClasse={auClasse} onToggle={onToggle} />
  );

  it('demande confirmation (avec le libellé) et ne bascule pas si refus', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onToggle = vi.fn();
    rendre([{ amenagement_id: 'au1' }], onToggle);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain('Police lisible');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('bascule si confirmé', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onToggle = vi.fn();
    rendre([{ amenagement_id: 'au1' }], onToggle);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith({ classeId: 'c1', amenagementId: 'au1', actif: false });
  });

  it('ne demande rien au cochage', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onToggle = vi.fn();
    rendre([], onToggle);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith({ classeId: 'c1', amenagementId: 'au1', actif: true });
  });
});

describe('CarteDispositif', () => {
  const items = [{ id: 'a1', ordre: 1, libelle: 'Temps majoré' }];
  const entete = { mode: 'AU', peutBasculer: true, blocage: null, onBascule: () => {} };
  const rendre = (props) => render(
    <CarteDispositif classe={classe} chapitre={chapitre} items={items} auClasse={[]} onToggle={() => {}} entete={entete} {...props} />
  );

  it('affiche le titre du chapitre et le badge de mode', () => {
    rendre({});
    expect(screen.getByRole('heading', { name: '7. Dispositif test' })).toBeTruthy();
    expect(screen.getByText('AU · toute la classe')).toBeTruthy();
  });

  it('confirme le décochage et respecte le refus', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onToggle = vi.fn();
    rendre({ auClasse: [{ amenagement_id: 'a1' }], onToggle });
    fireEvent.click(screen.getByRole('checkbox', { name: /Temps majoré/ }));
    expect(confirm.mock.calls[0][0]).toContain('Temps majoré');
    expect(onToggle).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Temps majoré/ }));
    expect(onToggle).toHaveBeenCalledWith({ classeId: 'c1', amenagementId: 'a1', actif: false });
  });

  it('ne demande rien au cochage', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onToggle = vi.fn();
    rendre({ onToggle });
    fireEvent.click(screen.getByRole('checkbox', { name: /Temps majoré/ }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledWith({ classeId: 'c1', amenagementId: 'a1', actif: true });
  });

  it('désactive la case cochée quand peutRetirer=false', () => {
    rendre({ auClasse: [{ amenagement_id: 'a1' }], peutRetirer: false });
    expect(screen.getByRole('checkbox', { name: /Temps majoré/ }).disabled).toBe(true);
  });
});

describe('EnTeteDispositif', () => {
  const base = { chapitre, mode: 'AR', peutBasculer: true, blocage: null };

  it('désactive les radios et explique pourquoi si peutBasculer=false', () => {
    render(<EnTeteDispositif {...base} peutBasculer={false} onBascule={() => {}} />);
    screen.getAllByRole('radio').forEach((r) => expect(r.disabled).toBe(true));
    expect(screen.getByText(/modifiable par le référent PLAI, la direction ou l'administrateur/)).toBeTruthy();
  });

  it("désactive les radios pendant une bascule sans afficher la phrase d'explication", () => {
    render(<EnTeteDispositif {...base} enCours onBascule={() => {}} />);
    screen.getAllByRole('radio').forEach((r) => expect(r.disabled).toBe(true));
    expect(screen.queryByText(/modifiable par le référent PLAI/)).toBeNull();
  });

  it('affiche le blocage avec role alert', () => {
    render(<EnTeteDispositif {...base} blocage="1 élève a déjà des cases cochées" onBascule={() => {}} />);
    expect(screen.getByRole('alert').textContent).toContain('1 élève a déjà');
  });

  it('appelle onBascule avec AU / AR', () => {
    const onBascule = vi.fn();
    const { rerender } = render(<EnTeteDispositif {...base} mode="AR" onBascule={onBascule} />);
    fireEvent.click(screen.getByRole('radio', { name: /AU/ }));
    expect(onBascule).toHaveBeenLastCalledWith('AU');
    rerender(<EnTeteDispositif {...base} mode="AU" onBascule={onBascule} />);
    fireEvent.click(screen.getByRole('radio', { name: /AR/ }));
    expect(onBascule).toHaveBeenLastCalledWith('AR');
  });
});

describe('ChapitreAR avec dispositif', () => {
  const props = {
    chapitre, amenagements: [{ id: 'a1', libelle: 'X', ordre: 1 }], eleves: [{ id: 'e1', prenom: 'Lou', initiale_nom: 'D' }],
    selectionsAR: [], libres: [], filtre: '', onToggle: () => {}, onAddLibre: () => {}, onRemoveLibre: () => {},
  };
  const rendre = (extra) => render(<table><tbody><ChapitreAR {...props} {...extra} /></tbody></table>);

  it('rend la ligne d\'en-tête de dispositif quand la prop est fournie', () => {
    rendre({ dispositif: { mode: 'AR', peutBasculer: true, blocage: null, onBascule: () => {} } });
    expect(screen.getByText('AR · par élève')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('ne rend aucun groupe radio sans la prop', () => {
    rendre({});
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText('AR · par élève')).toBeNull();
  });
});
