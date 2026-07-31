// @testing-library/react-native v14 auto-registers its jest matchers
// (toBeOnTheScreen, toBeVisible, ...) when the library is imported in tests.

// react-hook form setup for testing
// @ts-ignore
global.window = {};
// @ts-ignore
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
