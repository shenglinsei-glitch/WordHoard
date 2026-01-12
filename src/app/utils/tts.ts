// utils/tts.ts

export type TtsLang = 'ja-JP' | 'en-US' | 'en-GB' | 'zh-CN' | string;

const RE_JA = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
const RE_LATIN = /[A-Za-z]/;

function isAppleMobile(): boolean {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/i.test(ua) || (ua.includes('Macintosh') && (navigator as any).maxTouchPoints > 1);
}

export function guessLang(text: string, opts?: { preferJa?: boolean }): TtsLang {
  const t = (text ?? '').trim();
  if (!t) return 'en-US';
  if (opts?.preferJa || RE_JA.test(t)) return 'ja-JP';
  if (RE_LATIN.test(t)) return 'en-US';
  return 'en-US';
}

/**
 * 核心筛选：Otoya 绝对优先
 */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices() ?? [];
  if (!voices.length) return undefined;

  const targetLang = lang.toLowerCase().replace('_', '-');
  const pool = voices.filter((v) => (v.lang ?? '').toLowerCase().replace('_', '-').startsWith(targetLang));
  
  if (pool.length === 0) return undefined;

  const getPriority = (v: SpeechSynthesisVoice) => {
    const name = (v.name ?? '').toLowerCase();
    let score = 0;
    // Otoya 拥有最高优先级，确保 iOS 能选到男声
    if (name.includes('otoya')) score += 1000;
    if (name.includes('拡張') || name.includes('enhanced') || name.includes('premium')) score += 200;
    if (name.includes('online') || name.includes('neural')) score += 100;
    return score;
  };

  return [...pool].sort((a, b) => getPriority(b) - getPriority(a))[0];
}

/**
 * 【关键逻辑】iOS 暴力重置函数
 */
function forceResetIOS() {
  const synth = window.speechSynthesis;
  if (!isAppleMobile()) {
    synth.cancel();
    return;
  }
  
  // iOS 暴力清理：连续调用 cancel 并清空队列
  synth.pause();
  synth.cancel();
  synth.resume();
  synth.cancel(); 
}

export function speakText(
  text: string,
  lang: TtsLang,
  opts?: { rate?: number; pitch?: number; volume?: number; interrupt?: boolean }
) {
  const t = (text ?? '').trim();
  if (!t || !('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  const apple = isAppleMobile();

  // 1. 触发暴力重置
  if (opts?.interrupt !== false) {
    forceResetIOS();
  }

  const utter = new SpeechSynthesisUtterance(t);
  const v = pickVoice(lang);

  if (v) {
    utter.voice = v;
    utter.lang = v.lang; // 必须和 voice.lang 完全一致
  } else {
    utter.lang = lang;
  }

  utter.volume = opts?.volume ?? 1.0;
  utter.rate = opts?.rate ?? 1.0;
  utter.pitch = opts?.pitch ?? 1.0;

  // 2. 给 iOS 留出足够的“冷却时间”去切换男声
  // 延迟太短会导致 iOS 忽略刚才设置的 voice
  const delay = apple ? 300 : 20;
  setTimeout(() => {
    try {
      synth.speak(utter);
    } catch (e) {
      console.error(e);
    }
  }, delay);
}

export async function speakTextAsync(
  text: string,
  lang: TtsLang,
  opts?: { rate?: number; pitch?: number; volume?: number; interrupt?: boolean }
): Promise<void> {
  return new Promise((resolve) => {
    const t = (text ?? '').trim();
    if (!t || !('speechSynthesis' in window)) return resolve();

    const synth = window.speechSynthesis;
    const apple = isAppleMobile();

    if (opts?.interrupt !== false) {
      forceResetIOS();
    }

    const utter = new SpeechSynthesisUtterance(t);
    const v = pickVoice(lang);

    if (v) {
      utter.voice = v;
      utter.lang = v.lang;
    } else {
      utter.lang = lang;
    }

    utter.volume = opts?.volume ?? 1.0;
    utter.rate = opts?.rate ?? 1.0;
    utter.pitch = opts?.pitch ?? 1.0;

    const finish = () => resolve();
    utter.onend = finish;
    utter.onerror = finish;

    // iOS 异步等待时间增加，确保队列清空
    const delay = apple ? 400 : 20;
    setTimeout(() => {
      try {
        synth.speak(utter);
      } catch (e) {
        resolve();
      }
    }, delay);
  });
}

export function stopTts() {
  try {
    window.speechSynthesis?.cancel();
  } catch (e) {}
}