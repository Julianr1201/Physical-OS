export async function startCameraGaze(signal: AbortSignal, onGaze: (x: number, y: number) => void): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 160, height: 120 },
    audio: false,
  });
  if (signal.aborted) {
    stop(stream);
    return;
  }
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 24;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    stop(stream);
    throw new Error('camera_unavailable');
  }
  let previous: Uint8ClampedArray | null = null;
  let timer = 0;
  const release = () => {
    window.clearTimeout(timer);
    previous = null;
    stop(stream);
    video.srcObject = null;
  };
  const tick = () => {
    if (signal.aborted) return;
    context.drawImage(video, 0, 0, 32, 24);
    const frame = context.getImageData(0, 0, 32, 24).data;
    if (previous) {
      let weightX = 0;
      let weightY = 0;
      let weight = 0;
      for (let y = 0; y < 24; y += 1) {
        for (let x = 0; x < 32; x += 1) {
          const offset = (y * 32 + x) * 4;
          const current = luma(frame, offset);
          const prior = luma(previous, offset);
          const delta = Math.abs(current - prior);
          if (delta < 18) continue;
          weightX += x * delta;
          weightY += y * delta;
          weight += delta;
        }
      }
      if (weight > 80) onGaze(((weightX / weight) / 32 - 0.5) * -1.1, (0.5 - (weightY / weight) / 24) * 0.7);
    }
    previous = new Uint8ClampedArray(frame);
    timer = window.setTimeout(tick, 140);
  };
  signal.addEventListener('abort', release, { once: true });
  timer = window.setTimeout(tick, 140);
}

function luma(data: Uint8ClampedArray, offset: number): number {
  return (data[offset] ?? 0) * 0.3 + (data[offset + 1] ?? 0) * 0.59 + (data[offset + 2] ?? 0) * 0.11;
}

function stop(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
