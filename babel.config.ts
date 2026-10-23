export default (api) => {
  api.cache.using(() => process.env.NODE_ENV ?? 'default');

  return {
    presets: ['babel-preset-expo'],
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
