module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo automatically adds react-native-worklets/plugin
    // (required by Reanimated 4) when the package is installed — do NOT add
    // it again here or worklets get transformed twice.
    presets: ['babel-preset-expo'],
  };
};
