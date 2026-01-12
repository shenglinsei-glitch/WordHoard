// 最终兼容版：同时优化 PC (Chrome/Edge) 与 iOS (Safari)
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
 * 核心筛选逻辑：智能权重
 */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  if (!voices.length) return undefined;

  const targetLang = lang.toLowerCase().replace('_', '-');
  // 过滤出语种匹配的声音
  const sameLang = voices.filter((v) => (v.lang ?? '').toLowerCase().replace('_', '-').startsWith(targetLang));
  
  const pool = sameLang.length ? sameLang : voices;

  const getPriority = (v: SpeechSynthesisVoice) => {
    const name = (v.name ?? '').toLowerCase();
    let score = 0;

    // 1. 最高优先级：PC 端的神经网络声音 (Google/Microsoft Online)
    if (name.includes('online') || name.includes('neural') || name.includes('natural')) score += 100;
    
    // 2. 厂商权重 (Google 和 Microsoft 的 Web 语音通常音质和音量最好)
    if (name.includes('google')) score += 50;
    if (name.includes('microsoft')) score += 40;

    // 3. 针对 iOS 的权重 (匹配你截图中的“拡張”或“Enhanced”)
    if (name.includes('拡張') || name.includes('expanded') || name.includes('enhanced') || name.includes('premium')) score += 60;
    
    // 4. 角色权重
    if (['nanami', 'otoya', 'kyoko', 'samantha'].some(n => name.includes(n))) score += 20;

    return score;
  };

  // 排序并取最高分
  const sorted = [...pool].sort((a, b) => getPriority(b) - getPriority(a));
  return sorted[0];
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

  if (!('speechSynthesis' in window)) return;

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
  utter.pitch = opts?.pitch ?? (isJa ? 1.0 : 1.0); 

  const doSpeak = () => {
    const delay = shouldInterrupt ? (appleMobile ? 150 : 30) : 0;
    setTimeout(() => {
      try { synth.speak(utter); } catch (e) { }
    }, delay);
  };

  const assignVoiceAndSpeak = () => {
    // PC 端优先使用缓存，iOS 初次尝试让系统选（为了稳定）
    const cached = getCachedVoice(lang);
    if (appleMobile && !cached) {
      doSpeak();
      return;
    }
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
    setTimeout(handler, 300);
  }
}

// Promise 版异步播放（逻辑同上）
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
    utter.lang = lang;
    utter.volume = opts?.volume ?? 1.0;
    utter.rate = opts?.rate ?? 1.0;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();

    const assignVoiceAndSpeak = () => {
      const v = getCachedVoice(lang) ?? pickVoice(lang);
      if (v) {
        utter.voice = v;
        cacheVoice(lang, v);
      }
      const delay = shouldInterrupt ? (appleMobile ? 150 : 30) : 0;
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
      setTimeout(handler, 300);
    }
  });
}

export function stopTts() {
  try { window.speechSynthesis?.cancel?.(); } catch { }
}