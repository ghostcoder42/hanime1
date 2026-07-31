/**
 * Local NativeWind v5 babel preset.
 *
 * `nativewind/babel` (→ `react-native-css/babel`) is a *plugin* that returns
 * `{ plugins: [...] }`. That shape is invalid for a Babel plugin, and
 * `@babel/core` >= 7.27 rejects it with ".plugins is not a valid Plugin
 * property". Returning `{ plugins }` is the contract of a *preset*, not a
 * plugin — so this preset does the same job legitimately: it loads the real
 * className import-rewrite plugin (`react-native-css/.../import-plugin`) that
 * rewrites `react-native` imports to `react-native-css` so components honour
 * `className`. `react-native-worklets/plugin` stays listed directly in
 * babel.config.js.
 *
 * `react-native-css`'s `exports` map doesn't expose the import-plugin subpath,
 * so we resolve the exported `react-native-css/babel` entry and require its
 * sibling via absolute path (absolute-path requires bypass the `exports` map).
 */
const path = require('node:path');

const babelEntry = require.resolve('react-native-css/babel');
const importPluginPath = path.join(path.dirname(babelEntry), 'import-plugin.js');
const importPlugin = require(importPluginPath).default;

module.exports = function nativewindPreset() {
  // The import-rewrite (react-native → react-native-css) must NOT run under
  // Jest: react-native-css's component wrappers need the native runtime and
  // crash under jsdom. Tests assert text/testID, not styles, and `styled()` is
  // mocked in jest-setup, so NativeWind is unnecessary there.
  const isTest = process.env.NODE_ENV === 'test';
  return { plugins: isTest ? [] : [importPlugin] };
};
