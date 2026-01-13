// ttsCloud.ts
interface ImportMetaEnv {
  readonly VITE_TTS_PROXY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

const WORKER_URL = (import.meta as unknown as ImportMeta).env.VITE_TTS_PROXY_URL || 'https://wordhoard-tts.shenglin-sei.workers.dev/';

const audioCache = new Map<string, Blob>();
// 引用当前播放的音频对象
let currentAudio: HTMLAudioElement | null = null;

export async function speakViaCloud(text: string, voice = 'ja-JP-KeitaNeural') {
  const key = `${voice}|${text}`;
  
  // 停止之前正在播放的内容
  stopCloudTts();

  let blob = audioCache.get(key);

  if (!blob) {
    try {
      const r = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });
      if (!r.ok) throw new Error(await r.text());
      blob = await r.blob();
      audioCache.set(key, blob);
    } catch (e) {
      console.error('[Cloud TTS failed]', e);
      return;
    }
  }

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio; // 记录引用

  audio.onended = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };

  // 针对 iOS 的 play() 可能会被拦截的处理
  try {
    await audio.play();
  } catch (err) {
    console.warn("Audio play blocked. Ensure this is triggered by a user click.", err);
  }
}

// 导出停止云端语音的方法
export function stopCloudTts() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}