// tts.ts
import { speakViaCloud, stopCloudTts } from './ttsCloud'; // 导入新方法

export type TtsLang = string;

export function guessLang(text: string): TtsLang {
  return /[ぁ-んァ-ン一-龠]/.test(text) ? 'ja-JP' : 'en-US';
}

// 统一停止所有语音
export function stopTts() {
  // 1. 停止本地 Web Speech API
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  // 2. 停止云端 Audio 对象
  stopCloudTts();
}

export async function speakText(
  text: string,
  lang: TtsLang,
  opts?: { interrupt?: boolean }
) {
  const t = (text ?? '').trim();
  if (!t) return;

  // 这里的 interrupt 逻辑：如果为 true，先调用停止
  if (opts?.interrupt !== false) {
    stopTts();
  }

  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

  if (isIOS && lang.startsWith('ja')) {
    await speakViaCloud(t, 'ja-JP-KeitaNeural');
    return;
  }

  if (!('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(t);
  u.lang = lang;
  u.rate = 1;
  u.pitch = lang.startsWith('ja') ? 1.05 : 1;
  u.volume = 1;

  synth.speak(u);
}

export async function speakTextAsync(text: string, lang: TtsLang, opts?: { interrupt?: boolean }) {
  return speakText(text, lang, opts);
}