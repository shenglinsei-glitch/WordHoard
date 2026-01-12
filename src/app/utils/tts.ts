// Small TTS helper for Web Speech API.
// - Speaks the original text (no IPA required)
// - Picks a reasonable language automatically
// - Tries to select a better voice when available

export type TtsLang = 'ja-JP' | 'en-US' | 'en-GB' | 'zh-CN' | string;

const RE_JA = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/; // Hiragana/Katakana + CJK
const RE_HIRAKATA = /[\u3040-\u30ff]/;
const RE_LATIN = /[A-Za-z]/;

export function guessLang(text: string, opts?: { preferJa?: boolean }): TtsLang {
  const t = (text ?? '').trim();
  if (!t) return 'en-US';
  if (opts?.preferJa) return 'ja-JP';

  // Japanese: kana or kanji
  if (RE_JA.test(t)) return 'ja-JP';

  // Latin letters -> English
  if (RE_LATIN.test(t)) return 'en-US';

  // Fallback
  return 'en-US';
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  if (!voices.length) return undefined;

  const sameLang = voices.filter((v) => (v.lang ?? '').toLowerCase().startsWith(lang.toLowerCase()));
  const pool = sameLang.length ? sameLang : voices;

  // Prefer "Natural" voices when present
  const prefer = (v: SpeechSynthesisVoice) => {
    const name = (v.name ?? '').toLowerCase();
    return (
      name.includes('natural') ||
      name.includes('neural') ||
      name.includes('google') ||
      name.includes('microsoft') ||
      name.includes('kyoko') ||
      name.includes('nanami')
    );
  };

  return pool.find(prefer) ?? pool[0];
}

export function speakText(
  text: string,
  lang: TtsLang,
  opts?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    interrupt?: boolean;
  }
) {
  const t = (text ?? '').trim();
  if (!t) return;

  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    alert('お使いのブラウザは音声再生に対応していません');
    return;
  }

  const synth = window.speechSynthesis;
  if (opts?.interrupt !== false) {
    try {
      synth.cancel();
    } catch {
      // ignore
    }
  }

  const utter = new SpeechSynthesisUtterance(t);
  utter.lang = lang;
  utter.volume = opts?.volume ?? 1;

  // Learning-friendly defaults
  const isJa = String(lang).toLowerCase().startsWith('ja');
  const isEn = String(lang).toLowerCase().startsWith('en');
  utter.rate = opts?.rate ?? (isJa ? 0.95 : isEn ? 0.95 : 1);
  utter.pitch = opts?.pitch ?? (isJa ? 1.05 : 1);

  const assignVoiceAndSpeak = () => {
    const v = pickVoice(lang);
    if (v) utter.voice = v;
    synth.speak(utter);
  };

  // On some browsers, voices are loaded async.
  const voicesNow = synth.getVoices?.() ?? [];
  if (voicesNow.length) {
    assignVoiceAndSpeak();
    return;
  }

  const handler = () => {
    synth.removeEventListener?.('voiceschanged', handler);
    assignVoiceAndSpeak();
  };

  synth.addEventListener?.('voiceschanged', handler);
  // Fallback: try anyway
  setTimeout(() => {
    try {
      synth.removeEventListener?.('voiceschanged', handler);
    } catch {
      // ignore
    }
    assignVoiceAndSpeak();
  }, 300);
}
