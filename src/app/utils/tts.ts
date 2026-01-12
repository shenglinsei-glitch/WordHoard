// Small TTS helper for Web Speech API.
// Goals (esp. for Japanese):
// - Speak original text (no IPA required)
// - Keep voice stable across repeated speaks (avoid "first ok, then switches/flat")
// - Avoid volume/prosody drifting in rapid sequences (list autoplay)
// - Provide Promise-based speak for sequential playback

export type TtsLang = 'ja-JP' | 'en-US' | 'en-GB' | 'zh-CN' | string;

const RE_JA = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/; // Hiragana/Katakana + CJK
const RE_LATIN = /[A-Za-z]/;

export function guessLang(text: string, opts?: { preferJa?: boolean }): TtsLang {
  const t = (text ?? '').trim();
  if (!t) return 'en-US';
  if (opts?.preferJa) return 'ja-JP';

  // Japanese: kana or kanji
  if (RE_JA.test(t)) return 'ja-JP';

  // Latin letters -> English
  if (RE_LATIN.test(t)) return 'en-US';

  return 'en-US';
}

function normLang(lang: string) {
  return String(lang ?? '').toLowerCase();
}

// Cache chosen voice per language to avoid drifting/switching between calls.
const VOICE_CACHE = new Map<string, { name: string; lang: string; voiceURI?: string }>();

function getVoices(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis?.getVoices?.() ?? [];
  } catch {
    return [];
  }
}

function getCachedVoice(lang: string): SpeechSynthesisVoice | undefined {
  const key = normLang(lang);
  const cached = VOICE_CACHE.get(key);
  if (!cached) return undefined;
  const voices = getVoices();
  return voices.find((v) => (v.name ?? '') === cached.name && (v.lang ?? '') === cached.lang) ??
         voices.find((v) => (v.voiceURI ?? '') === (cached.voiceURI ?? '') && (v.lang ?? '') === cached.lang);
}

function cacheVoice(lang: string, v: SpeechSynthesisVoice) {
  VOICE_CACHE.set(normLang(lang), { name: v.name ?? '', lang: v.lang ?? '', voiceURI: (v as any).voiceURI });
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = getVoices();
  if (!voices.length) return undefined;

  const want = normLang(lang);
  const sameLang = voices.filter((v) => normLang(v.lang ?? '').startsWith(want));
  const pool = sameLang.length ? sameLang : voices;

  // Prefer higher quality / natural voices when present.
  const score = (v: SpeechSynthesisVoice) => {
    const name = (v.name ?? '').toLowerCase();
    let s = 0;
    if (name.includes('natural')) s += 50;
    if (name.includes('neural')) s += 45;
    if (name.includes('google')) s += 35;
    if (name.includes('kyoko')) s += 30;
    if (name.includes('otoya')) s += 30;
    if (name.includes('nanami')) s += 30;
    if (name.includes('microsoft')) s += 20;

    // Slightly de-prioritize very "compact"/"offline" voices if labeled.
    if (name.includes('compact')) s -= 10;
    if (name.includes('offline')) s -= 5;

    // Prefer default voice a bit (often well-integrated)
    if ((v as any).default) s += 5;
    return s;
  };

  return pool.slice().sort((a, b) => score(b) - score(a))[0];
}

// Ensure voices list is actually populated before first speak.
// This prevents "first speak uses default voice, later switches" behavior.
async function ensureVoicesReady(timeoutMs: number = 2000): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth?.getVoices) return;

  const start = Date.now();
  if (getVoices().length) return;

  await new Promise<void>((resolve) => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      try {
        synth.removeEventListener?.('voiceschanged', onChanged);
      } catch {}
      resolve();
    };

    const onChanged = () => {
      if (getVoices().length) finish();
    };

    try {
      synth.addEventListener?.('voiceschanged', onChanged);
    } catch {}

    // Poll as a fallback (some browsers don't fire voiceschanged reliably)
    const tick = () => {
      if (done) return;
      if (getVoices().length) return finish();
      if (Date.now() - start >= timeoutMs) return finish();
      setTimeout(tick, 100);
    };
    tick();
  });
}

export function stopTts() {
  try {
    window.speechSynthesis?.cancel?.();
  } catch {
    // ignore
  }
}

type SpeakOpts = {
  rate?: number;
  pitch?: number;
  volume?: number;
  interrupt?: boolean; // cancel before speaking
  delayMs?: number;    // delay after cancel
};

// Internal core: returns a Promise resolved on end/error so we can chain sequential playback.
async function speakCore(text: string, lang: TtsLang, opts?: SpeakOpts): Promise<void> {
  const t = (text ?? '').trim();
  if (!t) return;

  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;

  const synth = window.speechSynthesis;

  // IMPORTANT: ensure voices are loaded before the first utterance
  await ensureVoicesReady(2000);

  const shouldInterrupt = opts?.interrupt !== false;

  if (shouldInterrupt) {
    try { synth.cancel(); } catch {}
  }

  const utter = new SpeechSynthesisUtterance(t);
  utter.lang = lang;

  const isJa = normLang(lang).startsWith('ja');
  const isEn = normLang(lang).startsWith('en');

  utter.volume = opts?.volume ?? 1;
  utter.rate = opts?.rate ?? (isJa ? 0.95 : isEn ? 0.95 : 1);
  // For Japanese, keep pitch at 1.0 by default (more natural + stable across voices)
  utter.pitch = opts?.pitch ?? 1.0;

  // Lock voice
  const cached = getCachedVoice(lang);
  const v = cached ?? pickVoice(lang);
  if (v) {
    utter.voice = v;
    cacheVoice(lang, v);
  }

  const delay = shouldInterrupt ? Math.max(0, opts?.delayMs ?? 40) : 0;

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    utter.onend = finish;
    utter.onerror = finish;

    setTimeout(() => {
      try {
        synth.speak(utter);
      } catch {
        finish();
      }
    }, delay);
  });
}

// Fire-and-forget API (single click speak)
export function speakText(text: string, lang: TtsLang, opts?: SpeakOpts) {
  void speakCore(text, lang, opts);
}

// Promise API (for list autoplay)
export function speakTextAsync(text: string, lang: TtsLang, opts?: SpeakOpts): Promise<void> {
  return speakCore(text, lang, opts);
}
