// @testing-library/react-native v14 auto-registers its jest matchers
// (toBeOnTheScreen, toBeVisible, ...) when the library is imported in tests.

// react-hook form setup for testing
// @ts-expect-error
global.window = {};
// @ts-expect-error
global.window = global;

// Mock react-native-capture-protection (native module not available in jsdom)
jest.mock('react-native-capture-protection', () =>
  require('react-native-capture-protection/jest/capture-protection-mock')
);

// NativeWind's styled() needs the native runtime; in jsdom make it a passthrough
// (className is a harmless no-op prop on the underlying component — tests assert
// on text/testID, not styles).
jest.mock('nativewind', () => ({ styled: (component: unknown) => component }));

// Native modules that can't load under jsdom, imported (via styled wrappers) at
// module scope by components under test.
jest.mock('expo-video', () => ({ VideoView: () => null, useVideoPlayer: () => ({}) }));
jest.mock('expo-image', () => ({ Image: () => null }));

// expo-media-library reaches for the native module at import time; tests that
// exercise user-space logic override the pieces they need per-file.
jest.mock('expo-media-library', () => {
  class MockAsset {
    id: string;
    static create = jest.fn();
    static delete = jest.fn();
    delete = jest.fn();
    getUri = jest.fn();
    constructor(id: string) {
      this.id = id;
    }
  }
  return {
    Asset: MockAsset,
    Album: { get: jest.fn(), create: jest.fn() },
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  };
});
