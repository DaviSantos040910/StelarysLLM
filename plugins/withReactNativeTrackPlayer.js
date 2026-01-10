const {
  withAndroidManifest,
  withInfoPlist,
  withAndroidStyles,
  AndroidConfig,
} = require('@expo/config-plugins');

const { Manifest } = AndroidConfig;

const withReactNativeTrackPlayer = (config) => {
  config = withAndroidPermissions(config);
  config = withAndroidService(config);
  config = withIosBackgroundAudio(config);
  return config;
};

const withAndroidPermissions = (config) => {
  return AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.WAKE_LOCK',
  ]);
};

const withAndroidService = (config) => {
  return withAndroidManifest(config, (config) => {
    const mainApplication = Manifest.getMainApplicationOrThrow(config.modResults);

    const serviceName = 'com.doublesymmetry.trackplayer.service.MusicService';

    // Check if service already exists
    if (mainApplication.service?.some((s) => s.$['android:name'] === serviceName)) {
        return config;
    }

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    mainApplication.service.push({
      $: {
        'android:name': serviceName,
        'android:enabled': 'true',
        'android:exported': 'true',
        'android:foregroundServiceType': 'mediaPlayback',
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'android.media.browse.MediaBrowserService',
              },
            },
          ],
        },
      ],
    });

    return config;
  });
};

const withIosBackgroundAudio = (config) => {
  return withInfoPlist(config, (config) => {
    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }
    if (!config.modResults.UIBackgroundModes.includes('audio')) {
      config.modResults.UIBackgroundModes.push('audio');
    }
    return config;
  });
};

module.exports = withReactNativeTrackPlayer;
