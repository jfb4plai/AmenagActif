import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import FicheClasseView from '../../src/components/fiche/FicheClasseView.jsx';

const vm = {
  classeNom: '6L1', ecoleNom: 'E', anneeLibelle: '2026-2027', dateMaj: null,
  tableauReferents: { pia: [], par: [] }, pourTous: [], dispositifsClasse: [], parEleve: [], commentaires: [],
  commentairesClasses: [], elevesListe: [],
  parAmenagement: [
    { libelle: 'A1', chapitreTitre: '1. SUPPORTS', eleves: [{ nom: 'Lia', eleveId: 'e1', statut: 'PAR' }] },
    { libelle: 'A2', chapitreTitre: '1. SUPPORTS', eleves: [{ nom: 'Lia', eleveId: 'e1', statut: 'PAR' }] },
    { libelle: 'B1', chapitreTitre: '5. LECTURE', eleves: [{ nom: 'Lia', eleveId: 'e1', statut: 'PAR' }] },
    { libelle: 'L1', chapitreTitre: 'Aménagements complémentaires', eleves: [{ nom: 'Lia', eleveId: 'e1', statut: 'PAR' }] },
  ],
};

describe('FicheClasseView : séparateurs de chapitre', () => {
  it('insère un titre une seule fois par chapitre, avant son premier AR', () => {
    const { container } = render(<FicheClasseView vm={vm} lienEleve={false} />);
    const lignes = [...container.querySelectorAll('tr')].map((tr) => (tr.classList.contains('titre-chapitre') ? `# ${tr.textContent}` : tr.textContent.split('Lia')[0]));
    expect(lignes.slice(-7)).toEqual(['# 1. SUPPORTS', 'A1', 'A2', '# 5. LECTURE', 'B1', '# Aménagements complémentaires', 'L1']);
  });
});
