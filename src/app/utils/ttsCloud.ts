const WORKER_URL = 'https://wordhoard-tts.shenglin-sei.workers.dev/';

let audio: HTMLAudioElement | null = null;
let currentToken = 0;

export type CloudSpeakOptions = {
  voice?: string; // e.g. 'ja-JP-KeitaNeural', 'en-US-JennyNeural'
  signal?: AbortSignal;
};

/** Stop current cloud audio immediately. */
export function stopCloud() {
  currentToken += 1;
  if (audio) {
    try { audio.pause(); } catch {}
    try { audio.src = ''; } catch {}
    audio = null;
  }
}

/**
 * Speak via Cloudflare Worker (Azure TTS).
 * - No speechSynthesis fallback here.
 * - Resolves when playback ends (or rejects on error).
 */
export function speakViaCloudAsync(text: string, opts: CloudSpeakOptions = {}): Promise<void> {
  const t = (text ?? '').trim();
  if (!t) return Promise.resolve();

  const token = currentToken + 1;
  currentToken = token;

  const url = new URL(WORKER_URL);
  url.searchParams.set('text', t);
  if (opts.voice) url.searchParams.set('voice', opts.voice);

  stopCloud();

  audio = new Audio(url.toString());
  audio.preload = 'auto';
  audio.volume = 1;

  // iOS inline playback hint (TS doesn't know playsInline on HTMLAudioElement)
  (audio as any).playsInline = true;
  try { audio.setAttribute('playsinline', 'true'); } catch {}

  const a = audio;

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      if (a) {
        a.onended = null;
        a.onerror = null;
        a.onpause = null;
      }
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        cleanup();
        stopCloud();
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const onAbort = () => {
        opts.signal?.removeEventListener('abort', onAbort);
        cleanup();
        stopCloud();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    a.onended = () => {
      if (currentToken !== token) return;
      cleanup();
      resolve();
    };

    a.onerror = () => {
      if (currentToken !== token) return;
      cleanup();
      reject(new Error('Cloud audio playback failed'));
    };

    // Play must be called in a user gesture chain on iOS (caller ensures this)
    a.play().catch((err) => {
      if (currentToken !== token) return;
      cleanup();
      reject(err);
    });
  });
}
