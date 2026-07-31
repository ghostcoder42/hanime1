import { useHistoryStore } from './history-store';

const mockStore = require('react-native-mmkv').__store as Record<string, string>;

beforeEach(() => {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  useHistoryStore.setState({ history: [] });
});

describe('useHistoryStore', () => {
  it('adds to history and dedupes (moves to front)', () => {
    const { addToHistory } = useHistoryStore.getState();
    addToHistory({ id: '1', title: 'A', thumbnail: 't' });
    addToHistory({ id: '2', title: 'B', thumbnail: 't' });
    addToHistory({ id: '1', title: 'A', thumbnail: 't' });

    expect(useHistoryStore.getState().history.map((h) => h.id)).toEqual(['1', '2']);
  });

  it('caps at 200 entries', () => {
    const { addToHistory } = useHistoryStore.getState();
    for (let i = 0; i < 210; i++) addToHistory({ id: String(i), title: 'x', thumbnail: 't' });

    expect(useHistoryStore.getState().history).toHaveLength(200);
    expect(useHistoryStore.getState().history[0].id).toBe('209');
  });

  it('removes a single entry by id', () => {
    const { addToHistory, removeFromHistory } = useHistoryStore.getState();
    addToHistory({ id: '1', title: 'A', thumbnail: 't' });
    addToHistory({ id: '2', title: 'B', thumbnail: 't' });

    removeFromHistory('1');

    expect(useHistoryStore.getState().history.map((h) => h.id)).toEqual(['2']);
    expect(JSON.parse(mockStore.watch_history)).toHaveLength(1);
  });

  it('clears history', () => {
    useHistoryStore.getState().addToHistory({ id: '1', title: 'A', thumbnail: 't' });
    useHistoryStore.getState().clearHistory();

    expect(useHistoryStore.getState().history).toHaveLength(0);
    expect(JSON.parse(mockStore.watch_history)).toEqual([]);
  });
});
