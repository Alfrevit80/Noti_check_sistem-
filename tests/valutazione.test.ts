import { describe, expect, it } from 'vitest';
import { valutaMisura } from '../src/analysis/valutazione';
import { S } from './fixtures';

describe('valutaMisura', () => {
  it('isolamento e calza', () => {
    expect(valutaMisura('pT', 'OL', S)).toBe('ok');
    expect(valutaMisura('nT', 0.4, S)).toBe('basso');
    expect(valutaMisura('pC', 500, S)).toBe('attenzione');
    expect(valutaMisura('nC', 'OL', S)).toBe('ok');
  });
  it('resistenze', () => {
    expect(valutaMisura('rN', 'OL', S)).toBe('basso');
    expect(valutaMisura('rN', 21, S)).toBe('basso');
    expect(valutaMisura('rN', 19, S)).toBe('attenzione');
    expect(valutaMisura('rP', 12, S)).toBe('ok');
  });
  it('tensioni', () => {
    expect(valutaMisura('vRes', 3, S)).toBe('basso');
    expect(valutaMisura('vRes', -0.2, S)).toBe('ok');
    expect(valutaMisura('vRit', 16.5, S)).toBe('basso');
    expect(valutaMisura('vRit', 19, S)).toBe('ok');
  });
});
