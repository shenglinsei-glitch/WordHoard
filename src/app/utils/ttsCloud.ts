let audio: HTMLAudioElement | null = null;

export async function speakViaCloud(text: string) {
  stopCloud();

  const res = await fetch('https://wordhoard-tts.shenglin-sei.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error('Cloud TTS failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  audio = new Audio(url);
  audio.playsInline = true;
  audio.preload = 'auto';
  await audio.play();
}

export function stopCloud() {
  if (audio) {
    audio.pause();
    audio.src = '';
    audio = null;
  }
}
