import { slugify, slugSuffix } from './slug';

describe('slugify', () => {
  it('lowercases and dashes non-alphanumerics', () => {
    expect(slugify("Jane's Sweet Cakes!")).toBe('jane-s-sweet-cakes');
  });
  it('trims leading/trailing dashes and collapses runs', () => {
    expect(slugify('  --Hello   World--  ')).toBe('hello-world');
  });
  it('returns empty for empty/garbage input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('***')).toBe('');
  });
  it('slugSuffix is short hex', () => {
    expect(slugSuffix()).toMatch(/^[0-9a-f]{6}$/);
  });
});
