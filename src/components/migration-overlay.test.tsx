import { act, render } from '@testing-library/react-native';
import { useMigrationStore } from '@/lib/stores/migration-store';
import { MigrationOverlay } from './migration-overlay';

beforeEach(() => {
  useMigrationStore.getState().end();
});

describe('MigrationOverlay', () => {
  it('renders nothing while no migration is active', async () => {
    const { toJSON } = await render(<MigrationOverlay />);
    expect(toJSON()).toBeNull();
  });

  it('shows the preparing line before the first progress event', async () => {
    useMigrationStore.getState().begin(2);
    const { getByText } = await render(<MigrationOverlay />);
    expect(getByText('Preparing…')).toBeTruthy();
  });

  it('shows the current video with its position in the queue', async () => {
    useMigrationStore.getState().begin(2);
    useMigrationStore.getState().update(1, 2, 'A very long video title that must be cut');
    const { getByText } = await render(<MigrationOverlay />);
    expect(getByText(/A very long video title.+1\/2/)).toBeTruthy();
  });

  it('disappears again once the migration ends', async () => {
    useMigrationStore.getState().begin(1);
    const { getByText, rerender, toJSON } = await render(<MigrationOverlay />);
    expect(getByText('Preparing…')).toBeTruthy();

    await act(async () => {
      useMigrationStore.getState().end();
    });
    rerender(<MigrationOverlay />);
    expect(toJSON()).toBeNull();
  });
});
