import { speakViaCloud, stopCloud } from './ttsCloud';

export type SpeakOptions = {
  cancelBeforeSpeak?: boolean;
};

export function guessLang(
  text: string,
  _opts?: { preferJa?: boolean }
): 'ja' | 'en' | 'other' {
  if (/[぀-ヿ㐀-䶿一-鿿]/.test(text)) return 'ja';
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'other';
}

let utterance: SpeechSynthesisUtterance | null = null;

export function stopTts() {
  if (utterance) {
    window.speechSynthesis.cancel();
    utterance = null;
  }
  stopCloud();
}

// legacy-compatible wrapper
export function speakText(text: string, _lang?: any, _opts?: SpeakOptions) {
  void speakTextAsync(text, _lang, _opts);
}

export async function speakTextAsync(
  text: string,
  lang?: any,
  opts?: SpeakOptions
) {
  if (!text) return;

  if (opts?.cancelBeforeSpeak !== false) {
    stopTts();
  }

  const detected = typeof lang === 'string' ? lang : guessLang(text);
  const isApple = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && (navigator as any).maxTouchPoints > 1);

  // iOS/iPadOS + Japanese → force cloud
  if ((detected === 'ja' || detected === 'ja-JP') && isApple) {
    await speakViaCloud(text);
    return;
  }

  // Web Speech fallback (non-iOS or non-JA)
  utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = detected === 'en' ? 'en-US' : 'ja-JP';
  window.speechSynthesis.speak(utterance);
}
