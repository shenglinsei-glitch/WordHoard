// 最终强化版：解决 iOS 强制女声与音质问题
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

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  const targetLang = lang.toLowerCase().replace('_', '-');
  
  // 仅在当前语种的语音包中寻找
  const pool = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(targetLang));
  if (!pool.length) return undefined;

  const getPriority = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase();
    let score = 0;
    // 【核心】给 Otoya 极高权重，只要系统里有，无论什么版本都选它
    if (name.includes('otoya')) score += 1000; 
    // 扩展包/增强包权重
    if (name.includes('拡張') || name.includes('enhanced') || name.includes('premium')) score += 100;
    // PC端优质语音权重
    if (name.includes('online') || name.includes('neural') || name.includes('google')) score += 50;
    return score;
  };

  return [...pool].sort((a, b) => getPriority(b) - getPriority(a))[0];
}

const VOICE_CACHE = new Map<string, { name: string; lang: string }>();

export function speakText(
  text: string,
  lang: TtsLang,
  opts?: { rate?: number; pitch?: number; volume?: number; interrupt?: boolean }
) {
  const t = (text ?? '').trim();
  if (!t || !('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  const appleMobile = isAppleMobile();

  // iOS 必须先彻底取消之前的播放，否则新设置的 voice 会失效
  if (opts?.interrupt !== false) {
    synth.cancel();
  }

  const utter = new SpeechSynthesisUtterance(t);
  const v = pickVoice(lang);

  if (v) {
    utter.voice = v;
    utter.lang = v.lang; // 关键：lang 必须和 voice 的 lang 完全一致，iOS 才不切女声
  } else {
    utter.lang = lang;
  }

  utter.volume = opts?.volume ?? 1.0;
  utter.rate = opts?.rate ?? 1.0;
  utter.pitch = opts?.pitch ?? 1.0;

  // iOS Safari 的执行延迟 Bug 修复
  const delay = appleMobile ? 200 : 20;
  setTimeout(() => {
    synth.speak(utter);
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
    if (opts?.interrupt !== false) synth.cancel();

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
    
    utter.onend = () => resolve();
    utter.onerror = () => resolve();

    setTimeout(() => {
      synth.speak(utter);
    }, isAppleMobile() ? 200 : 20);
  });
}

export function stopTts() {
  window.speechSynthesis?.cancel();
}