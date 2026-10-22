const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  assetExts: [...(config.resolver ? config.resolver.assetExts : []), "wasm"],
  extraNodeModules: {
    ...(config.resolver ? config.resolver.extraNodeModules : {}),
    "react-native-web-webview": path.resolve(__dirname, "lib/web-webview-shim.tsx"),
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });
