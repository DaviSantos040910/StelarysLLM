const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Adicionando regra para ignorar a pasta 'backend' no Metro Bundler
config.resolver.blockList = [
    new RegExp(`${__dirname.replace(/\\/g, '/')}/backend/.*`),
];

module.exports = withNativeWind(config, { input: './global.css' });
