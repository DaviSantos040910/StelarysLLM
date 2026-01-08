// src/services/playbackService.js
import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function() {
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
    TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.destroy());
    // Adding seek handlers for completeness
    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
    TrackPlayer.addEventListener(Event.RemoteNext, () => { /* Handle next if playlist support needed */ });
    TrackPlayer.addEventListener(Event.RemotePrevious, () => { /* Handle prev */ });
};
