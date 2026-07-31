export default (api) => {
  api.cache.using(() => process.env.NODE_ENV ?? 'default');

  return {
    presets: ['babel-preset-expo', './nativewind-preset.cjs'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@env': './src/lib/env.ts',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
