import type { GenerationProgressEvent } from 'stable-diffusion';

export function formatElapsedTime(elapsedSeconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function generationProgressDetail(
  progress: GenerationProgressEvent,
  elapsedSeconds: number,
): string {
  const elapsed = formatElapsedTime(elapsedSeconds);
  if (progress.stage !== 'sampling') return elapsed;

  return `Steps ${progress.step ?? 0}/${progress.steps ?? 0} · ${elapsed}`;
}
