import { describe, it, expect } from 'vitest';

describe('Theme Configuration', () => {
  it('exports a valid theme object', async () => {
    const { theme } = await import('../theme');
    
    expect(theme).toBeDefined();
    expect(theme.palette).toBeDefined();
    expect(theme.typography).toBeDefined();
  });

  it('has Komatsu Gloria Blue as primary color', async () => {
    const { theme } = await import('../theme');
    
    expect(theme.palette.primary.main).toBe('#140A9A');
  });

  it('has proper background colors', async () => {
    const { theme } = await import('../theme');
    
    expect(theme.palette.background).toBeDefined();
    expect(theme.palette.background.default).toBeDefined();
    expect(theme.palette.background.paper).toBe('#ffffff');
  });
});
