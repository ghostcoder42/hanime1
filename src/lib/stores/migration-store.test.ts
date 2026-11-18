import { useMigrationStore } from './migration-store';

beforeEach(() => {
  useMigrationStore.getState().end();
});

describe('useMigrationStore', () => {
  it('begins in an inactive state', () => {
    const s = useMigrationStore.getState();
    expect(s.active).toBe(false);
    expect(s.currentTitle).toBe('');
  });

  it('begin marks active with a zeroed counter', () => {
    useMigrationStore.getState().begin(3);
    const s = useMigrationStore.getState();
    expect(s).toMatchObject({ active: true, done: 0, total: 3, currentTitle: '' });
  });

  it('update tracks per-video progress', () => {
    const { begin, update } = useMigrationStore.getState();
    begin(2);
    update(1, 2, 'Video B');
    expect(useMigrationStore.getState()).toMatchObject({
      active: true,
      done: 1,
      total: 2,
      currentTitle: 'Video B',
    });
  });

  it('end resets everything', () => {
    const { begin, update, end } = useMigrationStore.getState();
    begin(5);
    update(4, 5, 'Video E');
    end();
    expect(useMigrationStore.getState()).toMatchObject({
      active: false,
      done: 0,
      total: 0,
      currentTitle: '',
    });
  });
});
