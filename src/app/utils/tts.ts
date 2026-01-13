// tts.ts
// Compatibility layer: keep old exports and ensure iOS/iPadOS + Japanese always uses Cloud TTS.

import { speakViaCloud, stopCloudTts } from './ttsCloud';

export type SpeakOptions = {
  cancelBeforeSpeak?: boolean;
};

export type TtsLang = 'ja-JP' | 'en-US' | string;

const isAppleMobile = () => {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isIPadOS = ua.includes('Macintosh') && (navigator as any).maxTouchPoints > 1;
  return isIOS || isIPadOS;
};

export function guessLang(text: string, opts?: { preferJa?: boolean }): TtsLang {
  const t = (text ?? '').trim();
  if (opts?.preferJa) return 'ja-JP';
  if (/[ぁ-んァ-ン一-龠]/.test(t)) return 'ja-JP';
  if (/[a-zA-Z]/.test(t)) return 'en-US';
  // default: keep en-US so Web Speech has a stable fallback
  return 'en-US';
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  const lower = lang.toLowerCase();

  const starts = (v: SpeechSynthesisVoice, p: string) =>
    v.lang?.toLowerCase().startsWith(p);

  const prefer = (arr: SpeechSynthesisVoice[]) => (arr.length ? arr[0] : null);

  if (lower.startsWith('en')) {
    return (
      prefer(voices.filter((v) => starts(v, 'en-us') && /google/i.test(v.name))) ||
      prefer(voices.filter((v) => starts(v, 'en-us') && /microsoft/i.test(v.name))) ||
      prefer(voices.filter((v) => starts(v, 'en-us'))) ||
      prefer(voices.filter((v) => starts(v, 'en'))) ||
      null
    );
  }

  if (lower.startsWith('ja')) {
    return (
      prefer(voices.filter((v) => starts(v, 'ja-jp') && /google/i.test(v.name))) ||
      prefer(voices.filter((v) => starts(v, 'ja-jp'))) ||
      prefer(voices.filter((v) => starts(v, 'ja'))) ||
      null
    );
  }

  return null;
}

export function stopTts() {
  // Stop Web Speech
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  // Stop Cloud Audio
  stopCloudTts();
}

export function speakText(text: string, lang?: TtsLang, opts?: SpeakOptions) {
  // fire-and-forget wrapper
  void speakTextAsync(text, lang, opts);
}

export async function speakTextAsync(text: string, lang?: TtsLang, opts?: SpeakOptions): Promise<void> {
  const t = (text ?? '').trim();
  if (!t) return;

  const detected = (lang || guessLang(t)) as string;
  const apple = isAppleMobile();

  // iOS/iPadOS + Japanese → force cloud (no Web Speech fallback)
  if (apple && detected.toLowerCase().startsWith('ja')) {
    await speakViaCloud(t, 'ja-JP-KeitaNeural');
    return;
  }

  // Web Speech for other cases
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;

  // Cancel before speak (default: true)
  if (opts?.cancelBeforeSpeak !== false) {
    try {
      synth.cancel();
    } catch {
      // ignore
    }
  }

  // Ensure voices loaded (Chrome needs a tick sometimes)
  if (synth.getVoices && synth.getVoices().length === 0) {
    await new Promise<void>((r) => setTimeout(() => r(), 0));
  }

  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = detected.toLowerCase().startsWith('ja') ? 'ja-JP' : 'en-US';
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;

    const v = pickVoice(u.lang);
    if (v) u.voice = v;

    u.onend = () => resolve();
    u.onerror = () => reject(new Error('speechSynthesis error'));

    synth.speak(u);
  });
}
