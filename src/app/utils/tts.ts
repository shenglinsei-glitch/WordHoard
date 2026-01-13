// tts.ts (补全版本)
import { speakViaCloud } from './ttsCloud';

export type TtsLang = string;

// 1. 补全 guessLang 函数 (根据你的业务逻辑简单判断，或根据需要扩展)
export function guessLang(text: string): TtsLang {
  if (/[ぁ-んァ-ン一-龠]/.test(text)) return 'ja-JP';
  return 'en-US';
}

// 2. 补全 stopTts 函数
export function stopTts() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// 3. 原有的 speakText 函数
export async function speakText(
  text: string,
  lang: TtsLang,
  opts?: { interrupt?: boolean }
) {
  const t = (text ?? '').trim();
  if (!t) return;

  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

  // iOS + Japanese → cloud ONLY
  if (isIOS && lang.startsWith('ja')) {
    await speakViaCloud(t, 'ja-JP-KeitaNeural');
    return;
  }

  // Desktop or non-JA: normal Web Speech
  if (!('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  try {
    if (opts?.interrupt !== false) synth.cancel();
  } catch {}

  const u = new SpeechSynthesisUtterance(t);
  u.lang = lang;
  u.rate = 1;
  u.pitch = lang.startsWith('ja') ? 1.05 : 1;
  u.volume = 1;

  synth.speak(u);
}

// 4. 补全 speakTextAsync (通常是 speakText 的异步封装)
export async function speakTextAsync(
  text: string,
  lang: TtsLang,
  opts?: { interrupt?: boolean }
) {
  return speakText(text, lang, opts);
}