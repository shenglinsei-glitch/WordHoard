// 经过优化的 TTS 辅助工具
export type TtsLang = 'ja-JP' | 'en-US' | 'en-GB' | 'zh-CN' | string;

const RE_JA = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
const RE_LATIN = /[A-Za-z]/;

function isAppleMobile(): boolean {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isIPadOS = ua.includes('Macintosh') && (navigator as any).maxTouchPoints > 1;
  return isIOS || isIPadOS;
}

export function guessLang(text: string, opts?: { preferJa?: boolean }): TtsLang {
  const t = (text ?? '').trim();
  if (!t) return 'en-US';
  if (opts?.preferJa) return 'ja-JP';
  if (RE_JA.test(t)) return 'ja-JP';
  if (RE_LATIN.test(t)) return 'en-US';
  return 'en-US';
}

/**
 * 核心优化：筛选高质量语音包
 */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  if (!voices.length) return undefined;

  // 统一语言格式 (例如 zh-CN vs zh_CN)
  const targetLang = lang.toLowerCase().replace('_', '-');
  const sameLang = voices.filter((v) => (v.lang ?? '').toLowerCase().replace('_', '-').startsWith(targetLang));
  
  const pool = sameLang.length ? sameLang : voices;

  // 优先级排序：神经网络声音 > 厂商优质声音 > 普通声音
  const getPriority = (v: SpeechSynthesisVoice) => {
    const name = (v.name ?? '').toLowerCase();
    // 优先选择包含这些关键字的语音，它们通常音质更高、音量更饱满
    if (name.includes('natural') || name.includes('neural')) return 10;
    // iOS/iPadOS 的日语男声（Otoya）优先锁定
    if (name.includes('otoya')) return 9;
    if (name.includes('google')) return 8; // Google 在线语音通常很好听
    if (name.includes('premium') || name.includes('enhanced')) return 7;
    if (name.includes('apple') || name.includes('microsoft')) return 5;
    if (['otoya', 'o-ren', 'nanami', 'kyoko', 'samantha', 'meijia'].some(n => name.includes(n))) return 3;
    return 0;
  };

  return [...pool].sort((a, b) => getPriority(b) - getPriority(a))[0];
}

const VOICE_CACHE = new Map<string, { name: string; lang: string }>();

function normLang(lang: string) {
  return String(lang ?? '').toLowerCase();
}

function getCachedVoice(lang: string): SpeechSynthesisVoice | undefined {
  const key = normLang(lang);
  const cached = VOICE_CACHE.get(key);
  if (!cached) return undefined;
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  return voices.find((v) => (v.name ?? '') === cached.name && (v.lang ?? '') === cached.lang);
}

function cacheVoice(lang: string, v: SpeechSynthesisVoice) {
  VOICE_CACHE.set(normLang(lang), { name: v.name ?? '', lang: v.lang ?? '' });
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

  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    return;
  }

  const synth = window.speechSynthesis;
  const appleMobile = isAppleMobile();
  let shouldInterrupt = opts?.interrupt !== false;

  if (appleMobile && !synth.speaking && !synth.pending) {
    shouldInterrupt = false;
  }
  
  if (shouldInterrupt) {
    try { synth.cancel(); } catch { }
  }

  const utter = new SpeechSynthesisUtterance(t);
  utter.lang = lang;
  
  // --- 优化参数设置 ---
  utter.volume = opts?.volume ?? 1.0; // 默认满音量
  utter.rate = opts?.rate ?? 1.0;     // 默认标准语速
  
  // 针对日语微调，防止声音太“平”
  const isJa = String(lang).toLowerCase().startsWith('ja');
  utter.pitch = opts?.pitch ?? (isJa ? (appleMobile ? 1.0 : 1.05) : 1.0); 

  const doSpeak = () => {
    // 延迟处理，防止在某些浏览器上音量突变或被切断
    const delay = shouldInterrupt ? (appleMobile ? 150 : 50) : 0;
    setTimeout(() => {
      try { synth.speak(utter); } catch (e) { console.error(e); }
    }, delay);
  };

  const assignVoiceAndSpeak = () => {
    const cached = getCachedVoice(lang);
    const v = cached ?? pickVoice(lang);
    if (v) {
      utter.voice = v;
      cacheVoice(lang, v);
    }
    doSpeak();
  };

  const voicesNow = synth.getVoices();
  if (voicesNow.length) {
    assignVoiceAndSpeak();
  } else {
    const handler = () => {
      synth.removeEventListener('voiceschanged', handler);
      assignVoiceAndSpeak();
    };
    synth.addEventListener('voiceschanged', handler);
    setTimeout(handler, 350); // 兜底
  }
}

/**
 * Promise 版本的异步朗读（适合队列播放）
 */
export function speakTextAsync(
  text: string,
  lang: TtsLang,
  opts?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    interrupt?: boolean;
  }
): Promise<void> {
  return new Promise((resolve) => {
    const t = (text ?? '').trim();
    if (!t) return resolve();
    if (!('speechSynthesis' in window)) return resolve();

    const synth = window.speechSynthesis;
    const appleMobile = isAppleMobile();

    let shouldInterrupt = opts?.interrupt !== false;
    if (appleMobile && !synth.speaking && !synth.pending) {
      shouldInterrupt = false;
    }
    if (shouldInterrupt) {
      try { synth.cancel(); } catch { }
    }

    const utter = new SpeechSynthesisUtterance(t);
    utter.lang = lang;
    utter.volume = opts?.volume ?? 1.0;
    utter.rate = opts?.rate ?? 1.0;
    const isJa = String(lang).toLowerCase().startsWith('ja');
    utter.pitch = opts?.pitch ?? (isJa ? (appleMobile ? 1.0 : 1.05) : 1.0);

    utter.onend = () => resolve();
    utter.onerror = () => resolve();

    const assignVoiceAndSpeak = () => {
      const cached = getCachedVoice(lang);
      const v = cached ?? pickVoice(lang);
      if (v) {
        utter.voice = v;
        cacheVoice(lang, v);
      }
      const delay = shouldInterrupt ? (appleMobile ? 150 : 50) : 0;
      setTimeout(() => {
        try { synth.speak(utter); } catch { resolve(); }
      }, delay);
    };

    const voicesNow = synth.getVoices();
    if (voicesNow.length) {
      assignVoiceAndSpeak();
    } else {
      const handler = () => {
        synth.removeEventListener('voiceschanged', handler);
        assignVoiceAndSpeak();
      };
      synth.addEventListener('voiceschanged', handler);
      setTimeout(handler, 350);
    }
  });
}

export function stopTts() {
  try {
    window.speechSynthesis?.cancel?.();
  } catch { }
}