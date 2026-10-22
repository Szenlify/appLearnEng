import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';

function extractVideoIdFromUri(uri?: string): string | null {
  if (!uri) return null;
  try {
    const idx = uri.indexOf('?data=');
    if (idx >= 0) {
      const encoded = uri.slice(idx + 6);
      const parsed = JSON.parse(decodeURIComponent(encoded));
      if (parsed?.videoId_s) return String(parsed.videoId_s);
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export const WebView = forwardRef<any, any>((props, ref) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const latestTimeRef = useRef<number>(0);

  const storeVideoId = usePlayerStore((s) => s.videoId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playbackRate = usePlayerStore((s) => s.playbackRate);

  const videoId = useMemo(() => {
    return extractVideoIdFromUri(props?.source?.uri) || storeVideoId || 'UF8uR6Z6KLc';
  }, [props?.source?.uri, storeVideoId]);

  const sendCommand = (func: string, args: any[] = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    } catch {
      // ignore cross-origin postMessage errors
    }
  };

  useImperativeHandle(ref, () => ({
    postMessage: (message: string) => {
      if (!message) return;
      try {
        const parsed = JSON.parse(message);
        const eventName = parsed?.eventName;
        const meta = parsed?.meta;
        switch (eventName) {
          case 'playVideo':
            sendCommand('playVideo');
            break;
          case 'pauseVideo':
            sendCommand('pauseVideo');
            break;
          case 'muteVideo':
            sendCommand('mute');
            break;
          case 'unMuteVideo':
            sendCommand('unMute');
            break;
          case 'setVolume':
            if (typeof meta?.volume === 'number') {
              sendCommand('setVolume', [meta.volume]);
            }
            break;
          case 'setPlaybackRate':
            if (typeof meta?.playbackRate === 'number') {
              sendCommand('setPlaybackRate', [meta.playbackRate]);
            }
            break;
          default:
            break;
        }
      } catch {
        // ignore invalid JSON
      }
    },
    injectJavaScript: (script: string) => {
      if (!script) return;
      if (script.includes('getCurrentTime')) {
        props?.onMessage?.({
          nativeEvent: {
            data: JSON.stringify({
              eventType: 'getCurrentTime',
              data: latestTimeRef.current,
            }),
          },
        });
      }
      if (script.includes('getDuration')) {
        props?.onMessage?.({
          nativeEvent: {
            data: JSON.stringify({
              eventType: 'getDuration',
              data: usePlayerStore.getState().duration || 0,
            }),
          },
        });
      }
      const seekMatch = script.match(/seekTo\(([0-9.]+)/);
      if (seekMatch) {
        const targetSec = parseFloat(seekMatch[1]);
        latestTimeRef.current = targetSec;
        sendCommand('seekTo', [targetSec, true]);
      }
      if (script.includes('pauseVideo')) {
        sendCommand('pauseVideo');
      }
      if (script.includes('playVideo')) {
        sendCommand('playVideo');
      }
      const rateMatch = script.match(/setPlaybackRate\(([0-9.]+)/);
      if (rateMatch) {
        sendCommand('setPlaybackRate', [parseFloat(rateMatch[1])]);
      }
    },
  }));

  // Sync play/pause state with YouTube iframe
  useEffect(() => {
    if (isPlaying) {
      sendCommand('playVideo');
    } else {
      sendCommand('pauseVideo');
    }
  }, [isPlaying]);

  // Sync playbackRate with YouTube iframe
  useEffect(() => {
    sendCommand('setPlaybackRate', [playbackRate]);
  }, [playbackRate]);

  // Listen to YouTube IFrame API postMessage events (infoDelivery -> currentTime & playerState)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const payload = JSON.parse(event.data);
        if (payload?.event === 'onReady') {
          props?.onMessage?.({
            nativeEvent: {
              data: JSON.stringify({ eventType: 'playerReady' }),
            },
          });
        }
        if (payload?.event === 'infoDelivery' && payload?.info) {
          if (typeof payload.info.currentTime === 'number') {
            latestTimeRef.current = payload.info.currentTime;
            usePlayerStore.getState().setCurrentTime(payload.info.currentTime);
          }
          if (typeof payload.info.playerState === 'number') {
            props?.onMessage?.({
              nativeEvent: {
                data: JSON.stringify({
                  eventType: 'playerStateChange',
                  data: payload.info.playerState,
                }),
              },
            });
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [props]);

  const handleIframeLoad = () => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        '*'
      );
      props?.onMessage?.({
        nativeEvent: {
          data: JSON.stringify({ eventType: 'playerReady' }),
        },
      });
    } catch {
      // ignore
    }
  };

  const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1`;

  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, props.style]}>
      {React.createElement('iframe', {
        ref: iframeRef,
        src: embedUrl,
        onLoad: handleIframeLoad,
        style: { border: 'none', width: '100%', height: '100%' },
        allow: 'autoplay; encrypted-media; fullscreen',
      })}
    </View>
  );
});

export default WebView;
