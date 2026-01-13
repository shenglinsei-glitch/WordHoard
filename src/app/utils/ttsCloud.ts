// ttsCloud.ts (replacement)
// Calls Cloudflare Worker → Azure TTS (KeitaNeural)
// Includes client-side cache (same word = 1 request)

const WORKER_URL = 'https://wordhoard-tts.shenglin-sei.workers.dev/';

const audioCache = new Map<string, Blob>();

export async function speakViaCloud(
  text: string,
  voice = 'ja-JP-KeitaNeural'
) {
  const key = voice + '|' + text;
  let blob = audioCache.get(key);

  if (!blob) {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    if (!r.ok) {
      console.error('[Cloud TTS failed]', await r.text());
      return;
    }

    blob = await r.blob();
    audioCache.set(key, blob);
  }

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
}
