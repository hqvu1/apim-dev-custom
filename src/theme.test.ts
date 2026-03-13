import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('Theme Configuration', () => {
  it('exports a valid theme object', () => {
    expect(theme).toBeDefined();
    expect(theme.palette).toBeDefined();
    expect(theme.typography).toBeDefined();
  });

  it('has Komatsu Gloria Blue as primary color', () => {
    expect(theme.palette.primary.main).toBe('#140A9A');
  });

  it('has proper background colors', () => {
    expect(theme.palette.background).toBeDefined();
    expect(theme.palette.background.default).toBeDefined();
    expect(theme.palette.background.paper).toBe('#ffffff');
  });
});
