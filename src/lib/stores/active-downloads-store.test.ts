import { useActiveDownloadsStore } from './active-downloads-store';

beforeEach(() => {
  useActiveDownloadsStore.setState({ tasks: {} });
});

describe('useActiveDownloadsStore', () => {
  it('start creates a preparing task keyed by videoId', () => {
    useActiveDownloadsStore.getState().start({ videoId: '1', title: 'T', thumbnail: '' });

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task).toBeDefined();
    expect(task?.status).toBe('preparing');
    expect(task?.progress).toBe(0);
    expect(task?.startedAt).toBeGreaterThan(0);
  });

  it('setProgress flips to downloading and clamps the ratio', () => {
    useActiveDownloadsStore.getState().start({ videoId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().setProgress('1', 0.5, 50, 100);

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('downloading');
    expect(task?.progress).toBe(0.5);
  });

  it('marks progress indeterminate (-1) when total size is unknown', () => {
    useActiveDownloadsStore.getState().start({ videoId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().setProgress('1', 0, 10, 0);

    expect(useActiveDownloadsStore.getState().tasks['1']?.progress).toBe(-1);
  });

  it('complete removes the task', () => {
    useActiveDownloadsStore.getState().start({ videoId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().complete('1');

    expect(useActiveDownloadsStore.getState().tasks['1']).toBeUndefined();
  });

  it('fail marks the task as error with a message', () => {
    useActiveDownloadsStore.getState().start({ videoId: '1', title: 'T', thumbnail: '' });
    useActiveDownloadsStore.getState().fail('1', 'network down');

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('error');
    expect(task?.error).toBe('network down');
  });

  it('setProgress / complete / fail are no-ops for unknown videoId', () => {
    expect(() => {
      useActiveDownloadsStore.getState().setProgress('nope', 0.5, 1, 2);
      useActiveDownloadsStore.getState().complete('nope');
      useActiveDownloadsStore.getState().fail('nope', 'x');
    }).not.toThrow();
    expect(useActiveDownloadsStore.getState().tasks.nope).toBeUndefined();
  });
});
