import { readableFilenameFor } from './index';

describe('readableFilenameFor', () => {
  it('strips path-hostile characters and collapses separators', () => {
    expect(readableFilenameFor('a/b\\c:d*e?f"g<h>i|j  k')).toBe('a_b_c_d_e_f_g_h_i_j_k');
  });

  it('caps length at 60 chars and trims trailing dots/spaces', () => {
    expect(readableFilenameFor('x'.repeat(80))).toHaveLength(60);
    expect(readableFilenameFor('title... ')).toBe('title');
  });

  it('strips punctuation beyond basic separators (MediaStore-safe)', () => {
    expect(readableFilenameFor('Sparxie & Sparkle - Double Trouble [HMV]')).toBe(
      'Sparxie_Sparkle_-_Double_Trouble_HMV'
    );
  });

  it('falls back when nothing readable remains', () => {
    expect(readableFilenameFor('///???')).toBe('video');
  });
});
