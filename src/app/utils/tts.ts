// 最终修正版：解决 iOS 强制变回女声及音量平淡问题
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
 * 核心筛选：加入 Otoya/男声 极高权重
 */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  if (!voices.length) return undefined;

  const targetLang = lang.toLowerCase().replace('_', '-');
  const sameLang = voices.filter((v) => (v.lang ?? '').toLowerCase().replace('_', '-').startsWith(targetLang));
  
  const pool = sameLang.length ? sameLang : voices;

  const getPriority = (v: SpeechSynthesisVoice) => {
    const name = (v.name ?? '').toLowerCase();
    let score = 0;

    // 1. 强制匹配男声关键角色 (Otoya)
    if (name.includes('otoya')) score += 500; 

    // 2. 匹配高质量扩展包 (iOS 截图中的“拡張”)
    if (name.includes('拡張') || name.includes('enhanced') || name.includes('premium')) score += 100;
    
    // 3. PC端神经网络声音
    if (name.includes('online') || name.includes('neural') || name.includes('natural')) score += 80;
    
    // 4. 厂商权重
    if (name.includes('google')) score += 50;
    if (name.includes('apple')) score += 40;
    if (name.includes('microsoft')) score += 30;

    return score;
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
  if (!t || !('speechSynthesis' in window)) return;

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
  // 初步设置语种
  utter.lang = lang;
  utter.volume = opts?.volume ?? 1.0; 
  utter.rate = opts?.rate ?? 1.0;     
  utter.pitch = opts?.pitch ?? 1.0; 

  const doSpeak = () => {
    const delay = shouldInterrupt ? (appleMobile ? 200 : 30) : 0;
    setTimeout(() => {
      try {
        // iOS 兜底：如果还是在说话，强行重置一次
        if (appleMobile && synth.speaking) synth.cancel();
        synth.speak(utter);
      } catch (e) { }
    }, delay);
  };

  const assignVoiceAndSpeak = () => {
    const v = getCachedVoice(lang) ?? pickVoice(lang);
    if (v) {
      utter.voice = v;
      // 重要：在 iOS 上，utter.lang 必须与 voice.lang 完全一致，否则会被忽略强制变回女声
      utter.lang = v.lang; 
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
    setTimeout(handler, 350);
  }
}

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
    if (!t || !('speechSynthesis' in window)) return resolve();

    const synth = window.speechSynthesis;
    const appleMobile = isAppleMobile();
    let shouldInterrupt = opts?.interrupt !== false;

    if (appleMobile && !synth.speaking && !synth.pending) shouldInterrupt = false;
    if (shouldInterrupt) { try { synth.cancel(); } catch { } }

    const utter = new SpeechSynthesisUtterance(t);
    utter.volume = opts?.volume ?? 1.0;
    utter.rate = opts?.rate ?? 1.0;
    utter.pitch = opts?.pitch ?? 1.0;

    utter.onend = () => resolve();
    utter.onerror = () => resolve();

    const assignVoiceAndSpeak = () => {
      const v = getCachedVoice(lang) ?? pickVoice(lang);
      if (v) {
        utter.voice = v;
        utter.lang = v.lang;
        cacheVoice(lang, v);
      } else {
        utter.lang = lang;
      }
      const delay = shouldInterrupt ? (appleMobile ? 200 : 30) : 0;
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
  try { window.speechSynthesis?.cancel?.(); } catch { }
}