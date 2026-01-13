// ttsCloud.ts
// Cloud TTS: fetch from Cloudflare Worker (Azure TTS proxy) and play as <audio>.
// NOTE: This file MUST NOT do any speechSynthesis fallback.

interface ImportMetaEnv {
  readonly VITE_TTS_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

const DEFAULT_WORKER_URL = 'https://wordhoard-tts.shenglin-sei.workers.dev/';

const WORKER_URL =
  ((import.meta as unknown as ImportMeta).env.VITE_TTS_PROXY_URL || '').trim() || DEFAULT_WORKER_URL;

// Simple in-memory cache for the current session
const audioCache = new Map<string, Blob>();

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

function cleanupCurrentUrl() {
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl);
    } catch {
      // ignore
    }
    currentObjectUrl = null;
  }
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
  cleanupCurrentUrl();
}

async function fetchMp3(text: string, voice: string): Promise<Blob> {
  const key = `${voice}::${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;

  const url = new URL(WORKER_URL);
  url.searchParams.set('text', text);
  url.searchParams.set('voice', voice);

  const res = await fetch(url.toString(), {
    method: 'GET',
    // Allow browser/CF edge caching if enabled server-side; safe for TTS blobs
    cache: 'force-cache',
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Cloud TTS failed: ${res.status} ${errText}`);
  }

  const blob = await res.blob();
  audioCache.set(key, blob);
  return blob;
}

export async function speakViaCloud(
  text: string,
  voice = 'ja-JP-KeitaNeural'
): Promise<void> {
  const t = (text ?? '').trim();
  if (!t) return;

  // Stop previous playback first (avoid overlaps)
  stopCloudTts();

  const blob = await fetchMp3(t, voice);
  const objectUrl = URL.createObjectURL(blob);
  currentObjectUrl = objectUrl;

  const audio = new Audio();
  audio.src = objectUrl;
  audio.preload = 'auto';
  audio.volume = 1;

  currentAudio = audio;

  await new Promise<void>((resolve, reject) => {
    const onEnded = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      // Cleanup after finishing
      if (currentAudio === audio) {
        currentAudio = null;
      }
      cleanupCurrentUrl();
      resolve();
    };

    const onError = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      if (currentAudio === audio) {
        currentAudio = null;
      }
      cleanupCurrentUrl();
      reject(new Error('Audio element error'));
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // Must be triggered by a user gesture on iOS (we unlock once in App.tsx)
    audio
      .play()
      .then(() => {
        // playing
      })
      .catch((err) => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        if (currentAudio === audio) currentAudio = null;
        cleanupCurrentUrl();
        reject(err);
      });
  });
}
