import { speakViaCloud, stopCloudTts } from './ttsCloud';

export type SpeakOptions = {
  /**
   * 默认 true：每次播放前会 stopTts()（适合手动点击）。
   * iOS/iPadOS 连续播放时建议传 false，避免频繁 cancel 导致语音降级。
   */
  cancelBeforeSpeak?: boolean;
};

export function guessLang(
  text: string,
  opts?: { preferJa?: boolean }
): 'ja' | 'en' | 'other' {
  const t = (text ?? '').trim();
  if (!t) return 'other';
  // 日语/汉字/假名优先
  if (/[぀-ヿ㐀-䶿一-鿿]/.test(t)) return 'ja';
  if (opts?.preferJa && /[ぁ-ゟァ-ヿ]/.test(t)) return 'ja';
  if (/[a-zA-Z]/.test(t)) return 'en';
  return 'other';
}

const isAppleMobile = () => {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isIPadOS = ua.includes('Macintosh') && (navigator as any).maxTouchPoints > 1;
  return isIOS || isIPadOS;
};

let currentUtterance: SpeechSynthesisUtterance | null = null;
let playToken = 0;
let playingPromise: Promise<void> = Promise.resolve();

export function stopTts() {
  playToken += 1;

  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
  currentUtterance = null;

  stopCloudTts();
}

// legacy-compatible wrapper
export function speakText(text: string, lang?: any, opts?: SpeakOptions) {
  void speakTextAsync(text, lang, opts);
}

function normalizeLang(input: any, text: string) {
  const detected = typeof input === 'string' ? input : guessLang(text);
  if (detected === 'ja') return 'ja-JP';
  if (detected === 'en') return 'en-US';
  if (detected === 'ja-JP' || detected === 'en-US') return detected;
  // 容错：传入过其它 locale 也尽量保留
  return String(detected || 'ja-JP');
}

function getVoicesSafe(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

function waitForVoices(timeoutMs = 800): Promise<SpeechSynthesisVoice[]> {
  const now = getVoicesSafe();
  if (now.length) return Promise.resolve(now);

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
      } catch {
        // ignore
      }
      resolve(getVoicesSafe());
    };

    const onChanged = () => finish();

    try {
      window.speechSynthesis.addEventListener('voiceschanged', onChanged);
    } catch {
      // ignore
    }

    setTimeout(finish, timeoutMs);
  });
}

function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const target = lang.toLowerCase();
  const prefix = target.split('-')[0];

  const byLangExact = voices.filter((v) => (v.lang || '').toLowerCase() === target);
  const byLangPrefix = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(prefix));

  const preferredNameHints: Record<string, string[]> = {
    'en-us': [
      'google us english',
      'google english',
      'microsoft',
      'zira',
      'aria',
      'david',
      'samantha',
      'alex',
    ],
    'ja-jp': ['google 日本語', 'google japanese', 'microsoft', 'kyoko', 'otoya', 'haruka'],
  };

  const hints = preferredNameHints[target] || [];
  const score = (v: SpeechSynthesisVoice) => {
    const name = (v.name || '').toLowerCase();
    let s = 0;
    if ((v.lang || '').toLowerCase() === target) s += 100;
    if ((v.lang || '').toLowerCase().startsWith(prefix)) s += 50;
    if (v.default) s += 5;
    for (let i = 0; i < hints.length; i += 1) {
      if (name.includes(hints[i])) {
        s += 20 - i; // 越靠前越优先
        break;
      }
    }
    // eSpeak / 机械感关键词降权
    if (name.includes('espeak') || name.includes('microsoft hui') || name.includes('compact')) s -= 30;
    return s;
  };

  const pool = (byLangExact.length ? byLangExact : byLangPrefix.length ? byLangPrefix : voices).slice();
  pool.sort((a, b) => score(b) - score(a));
  return pool[0] || null;
}

async function speakViaWebSpeech(text: string, lang: string, tokenAtStart: number): Promise<void> {
  const t = (text ?? '').trim();
  if (!t) return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;

  const voices = await waitForVoices();
  if (playToken !== tokenAtStart) return;

  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(t);
    currentUtterance = u;

    u.lang = lang;

    const v = pickBestVoice(voices, lang);
    if (v) u.voice = v;

    // 关键：避免“很小声/机械音”
    u.volume = 1;
    u.rate = 1;
    u.pitch = 1;

    const cleanup = () => {
      if (currentUtterance === u) currentUtterance = null;
      resolve();
    };

    u.onend = cleanup;
    u.onerror = cleanup;

    try {
      window.speechSynthesis.speak(u);
    } catch {
      cleanup();
    }
  });
}

export async function speakTextAsync(text: string, lang?: any, opts?: SpeakOptions) {
  const t = (text ?? '').trim();
  if (!t) return;

  const normalizedLang = normalizeLang(lang, t);
  const tokenAtStart = playToken + 1;

  const cancel = opts?.cancelBeforeSpeak !== false;
  if (cancel) {
    stopTts();
  } else {
    // 连续播放：等前一个播完再开始（避免重叠）
    await playingPromise.catch(() => undefined);
  }

  // 更新 token（stopTts() 会 +1，这里要以最新为准）
  playToken += 1;
  const myToken = playToken;

  const task = (async () => {
    const apple = isAppleMobile();

    // iOS/iPadOS + Japanese → 强制走云端 Keita
    if (apple && normalizedLang.toLowerCase().startsWith('ja')) {
      await speakViaCloud(t, 'ja-JP-KeitaNeural').catch(() => undefined);
      return;
    }

    // 其它情况 → Web Speech（English 在桌面一定要选到 en-US voice）
    await speakViaWebSpeech(t, normalizedLang, myToken);
  })();

  playingPromise = task;
  await task;
}
