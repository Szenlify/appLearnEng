import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { usePlayerStore } from '@/stores/usePlayerStore';

export async function playPronunciation(
  text: string,
  accent?: 'en-US' | 'en-GB'
): Promise<void> {
  const cleanText = text.replace(/^\/+|\/+$/g, '').trim();
  if (!cleanText) return;

  const targetAccent = accent || usePlayerStore.getState().accent || 'en-US';

  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = targetAccent;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
      return;
    } catch {
      // fallback to expo-speech below
    }
  }

  try {
    const speaking = await Speech.isSpeakingAsync();
    if (speaking) {
      await Speech.stop();
      // Give iOS AVSpeechSynthesizer a brief moment to finish cancelling before queuing new speech
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  } catch {
    // ignore status check errors
  }

  Speech.speak(cleanText, {
    language: targetAccent,
    pitch: 1.0,
    rate: 0.9,
    volume: 1.0,
    // Separate iOS audio session prevents WKWebView (YouTube player) from blocking or muting TTS
    useApplicationAudioSession: false,
    onError: () => {
      // Fallback with default application audio session if separate session fails
      Speech.speak(cleanText, {
        language: targetAccent,
        pitch: 1.0,
        rate: 0.9,
        volume: 1.0,
        useApplicationAudioSession: true,
      });
    },
  });
}
