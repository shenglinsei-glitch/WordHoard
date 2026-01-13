import { speakViaCloudAsync, stopCloud } from './ttsCloud';

export type SpeakOptions = {
  /** Whether to call speechSynthesis.cancel() before speaking (recommended on desktop, not on iOS). */
  cancelBeforeSpeak?: boolean;
};

export type GuessLangResult = 'ja' | 'en' | 'other';

const isAppleMobile = () => {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isIPadOS = ua.includes('Macintosh') && (navigator as any).maxTouchPoints > 1;
  return isIOS || isIPadOS;
};

export function guessLang(text: string, opts?: { preferJa?: boolean }): GuessLangResult {
  const t = (text ?? '').trim();
  if (!t) return 'other';

  // If it contains any Japanese scripts / CJK ideographs, treat as Japanese (same as your current logic)
  if (/[぀-ヿ㐀-䶿一-鿿]/.test(t)) return 'ja';

  // Prefer Japanese if explicitly requested and the string looks like romaji/katakana input
  if (opts?.preferJa && /^[A-Za-z\-\s]+$/.test(t)) return 'ja';

  if (/[a-zA-Z]/.test(t)) return 'en';
  return 'other';
}

let utterance: SpeechSynthesisUtterance | null = null;
let utterToken = 0;

/** Stop any ongoing TTS (cloud + speechSynthesis). */
export function stopTts() {
  utterToken += 1;
  stopCloud();

  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {}

  utterance = null;
}

function normalizeLang(input?: string | GuessLangResult): { lang: string; bucket: GuessLangResult } {
  const v = (input ?? '').toString();
  if (!v) return { lang: 'ja-JP', bucket: 'ja' };

  // allow 'ja'/'en'/'other'
  if (v === 'ja') return { lang: 'ja-JP', bucket: 'ja' };
  if (v === 'en') return { lang: 'en-US', bucket: 'en' };
  if (v === 'other') return { lang: 'und', bucket: 'other' };

  // allow BCP-47 like 'ja-JP', 'en-US'
  if (v.toLowerCase().startsWith('ja')) return { lang: 'ja-JP', bucket: 'ja' };
  if (v.toLowerCase().startsWith('en')) return { lang: 'en-US', bucket: 'en' };

  return { lang: v, bucket: 'other' };
}

function pickBestVoice(lang: string): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

  const target = lang.toLowerCase();

  // Exact match first
  const exact = voices.find((v) => (v.lang || '').toLowerCase() === target);
  if (exact) return exact;

  // Prefix match (en-* / ja-*)
  const prefix = target.split('-')[0];
  const prefixMatch = voices.find((v) => (v.lang || '').toLowerCase().startsWith(prefix));
  if (prefixMatch) return prefixMatch;

  // If no match, return default voice if any
  const def = voices.find((v) => (v as any).default);
  return def ?? voices[0] ?? null;
}

async function speakWebSpeechAsync(text: string, lang: string, opts: SpeakOptions = {}): Promise<void> {
  if (!('speechSynthesis' in window)) throw new Error('speechSynthesis not available');

  const token = utterToken + 1;
  utterToken = token;

  if (opts.cancelBeforeSpeak) {
    try { window.speechSynthesis.cancel(); } catch {}
  }

  // Ensure voices are loaded (some browsers load async)
  let voice = pickBestVoice(lang);
  if (!voice) {
    await new Promise<void>((r) => setTimeout(r, 50));
    voice = pickBestVoice(lang);
  }

  return new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    utterance = u;

    u.lang = lang;
    if (voice) u.voice = voice;

    // Avoid "quiet / robotic" by forcing sane params
    u.volume = 1;
    u.rate = 1;
    u.pitch = 1;

    u.onend = () => {
      if (utterToken !== token) return;
      resolve();
    };
    u.onerror = (e) => {
      if (utterToken !== token) return;
      reject(e.error ? new Error(String(e.error)) : new Error('speechSynthesis error'));
    };

    try {
      window.speechSynthesis.speak(u);
    } catch (err) {
      reject(err as any);
    }
  });
}

/**
 * Speak once (fire-and-forget).
 * Keeps old API compatible: speakText(text, lang?)
 */
export function speakText(text: string, lang?: string | GuessLangResult, opts: SpeakOptions = {}) {
  void speakTextAsync(text, lang, opts);
}

/**
 * Speak once and wait until finished.
 * - iOS/iPadOS:
 *   - Japanese always uses Cloud (Keita).
 *   - English uses Cloud too (avoid JP-accent voices / unstable iOS WebSpeech).
 * - Desktop/others: Web Speech
 */
export async function speakTextAsync(text: string, lang?: string | GuessLangResult, opts: SpeakOptions = {}): Promise<void> {
  const t = (text ?? '').trim();
  if (!t) return;

  const { lang: normLang, bucket } = normalizeLang(lang ?? guessLang(t));

  const apple = isAppleMobile();

  // Force cloud for iOS/iPadOS: Japanese + English (fix JP-accent English on iOS)
  if (apple && (bucket === 'ja' || bucket === 'en')) {
    const voice = bucket === 'ja' ? 'ja-JP-KeitaNeural' : 'en-US-JennyNeural';
    await speakViaCloudAsync(t, { voice });
    return;
  }

  // Non-Apple: use Web Speech; cancel by default unless explicitly disabled
  const cancelBefore = opts.cancelBeforeSpeak ?? true;
  await speakWebSpeechAsync(t, normLang, { cancelBeforeSpeak: cancelBefore });
}
