// ttsCloud.ts
// 只做两件事：请求 Cloudflare Worker → 播放 mp3（不做任何 speechSynthesis fallback）

interface ImportMetaEnv {
  readonly VITE_TTS_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

const DEFAULT_WORKER_URL = 'https://wordhoard-tts.shenglin-sei.workers.dev/';
const WORKER_URL = ((import.meta as unknown as ImportMeta).env.VITE_TTS_PROXY_URL || DEFAULT_WORKER_URL).trim();

const audioCache = new Map<string, Blob>();

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

function buildWorkerUrl(text: string, voice: string) {
  const base = WORKER_URL.endsWith('/') ? WORKER_URL : WORKER_URL + '/';
  const u = new URL(base);
  u.searchParams.set('text', text);
  if (voice) u.searchParams.set('voice', voice);
  return u.toString();
}

export function stopCloudTts() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl);
    } catch {
      // ignore
    }
    currentObjectUrl = null;
  }
}

export async function speakViaCloud(text: string, voice = 'ja-JP-KeitaNeural'): Promise<void> {
  const t = (text ?? '').trim();
  if (!t) return;

  const cacheKey = `${voice}|${t}`;

  // 新开播音前，先停掉正在播的
  stopCloudTts();

  let blob = audioCache.get(cacheKey);
  if (!blob) {
    const url = buildWorkerUrl(t, voice);
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) {
      const msg = await r.text().catch(() => '');
      throw new Error(`Cloud TTS failed: ${r.status} ${msg}`);
    }
    blob = await r.blob();
    audioCache.set(cacheKey, blob);
  }

  const objectUrl = URL.createObjectURL(blob);
  currentObjectUrl = objectUrl;

  const audio = new Audio(objectUrl);
  currentAudio = audio;

  // iOS: TS 类型里没有 playsInline，用 attribute 设置
  try {
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
  } catch {
    // ignore
  }

  audio.preload = 'auto';

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      if (currentAudio === audio) currentAudio = null;
      if (currentObjectUrl === objectUrl) currentObjectUrl = null;
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
      resolve();
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;

    // 必须由用户交互触发，否则 iOS 可能阻止；这里不兜底 speechSynthesis
    void audio.play().catch(() => cleanup());
  });
}
