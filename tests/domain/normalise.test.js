import { describe, it, expect } from 'vitest';
import { normaliseLibelle } from '../../src/domain/normalise.js';

describe('normaliseLibelle', () => {
  it('supprime accents, casse, espaces insecables et ponctuation de bord', () => {
    expect(normaliseLibelle('  Doubler les espaces de réponse\u00a0')).toBe(
      normaliseLibelle('doubler les espaces de reponse')
    );
  });
  it('reduit les espaces multiples', () => {
    expect(normaliseLibelle('Parler   sans  se déplacer')).toBe('parler sans se deplacer');
  });
  it('ignore le prefixe AU', () => {
    expect(normaliseLibelle('AU Mise en page')).toBe(normaliseLibelle('Mise en page'));
  });
});
