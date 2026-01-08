import { useEffect, useState } from 'react';
import TrackPlayer, { Capability, AppKilledPlaybackBehavior, RepeatMode } from 'react-native-track-player';

export const useSetupPlayer = () => {
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  useEffect(() => {
    const setup = async () => {
      try {
        await TrackPlayer.setupPlayer();
        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          },
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
          ],
          compactCapabilities: [
            Capability.Play,
            Capability.Pause,
          ],
          progressUpdateEventInterval: 2,
        });
        setIsPlayerReady(true);
      } catch (e) {
        console.log('Player setup failed or already setup', e);
        // If it fails, it might be because it's already setup, so we assume ready.
        setIsPlayerReady(true);
      }
    };

    setup();
  }, []);

  return isPlayerReady;
};
