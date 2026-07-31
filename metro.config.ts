// CommonJS form: `eas build --local` loads this via Node, and Node ESM can't
// resolve the bare specifiers (`expo/metro-config`, `nativewind/metro`). Using
// require/module.exports makes Node parse it as CJS, where require resolves.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, { inlineRem: 16 });
