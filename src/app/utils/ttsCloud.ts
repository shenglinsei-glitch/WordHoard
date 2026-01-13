let audio: HTMLAudioElement | null = null;

export function stopCloud() {
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }
}

export function speakViaCloud(text: string) {
  stopCloud();

  const url =
    "https://wordhoard-tts.shenglin-sei.workers.dev/?" +
    "text=" +
    encodeURIComponent(text);

  audio = new Audio(url);
  audio.preload = "auto";
  audio.play();
}
