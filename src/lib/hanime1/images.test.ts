import { cardOrientation } from './images';

describe('cardOrientation', () => {
  it('classifies cover URLs as portrait', () => {
    expect(
      cardOrientation('https://vdownload.hembed.com/image/cover/407591.jpg?secure=rHzHJ,1756')
    ).toBe('portrait');
  });

  it('classifies thumbnail URLs as landscape', () => {
    expect(
      cardOrientation('https://vdownload.hembed.com/image/thumbnail/407591l.jpg?secure=NMiVz,1756')
    ).toBe('landscape');
    expect(
      cardOrientation('https://vdownload.hembed.com/image/thumbnail/407591h.jpg?secure=NMiVz,1756')
    ).toBe('landscape');
  });

  it('falls back to landscape for unknown URL shapes', () => {
    expect(cardOrientation('https://example.com/t.jpg')).toBe('landscape');
    expect(cardOrientation('')).toBe('landscape');
  });
});
