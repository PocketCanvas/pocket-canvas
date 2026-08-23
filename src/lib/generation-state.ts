import type { GenerationProgressEvent } from 'stable-diffusion';

export type GenerationRunState =
  | { status: 'idle'; imageUri: string | null }
  | {
      status: 'running';
      previousImageUri: string | null;
      progress: GenerationProgressEvent;
    }
  | { status: 'succeeded'; imageUri: string; warning: string | null }
  | { status: 'failed'; previousImageUri: string | null; error: string };

export type GenerationRunAction =
  | { type: 'started' }
  | { type: 'progressed'; progress: GenerationProgressEvent }
  | { type: 'succeeded'; imageUri: string; warning?: string }
  | { type: 'failed'; error: string };

export function createInitialGenerationRunState(
  imageUri: string | null = null,
): GenerationRunState {
  return { status: 'idle', imageUri };
}

export function visibleGenerationImageUri(state: GenerationRunState): string | null {
  return state.status === 'idle' || state.status === 'succeeded'
    ? state.imageUri
    : state.previousImageUri;
}

export function generationRunReducer(
  state: GenerationRunState,
  action: GenerationRunAction,
): GenerationRunState {
  switch (action.type) {
    case 'started':
      return {
        status: 'running',
        previousImageUri: visibleGenerationImageUri(state),
        progress: { stage: 'loading' },
      };
    case 'progressed':
      return state.status === 'running' ? { ...state, progress: action.progress } : state;
    case 'succeeded':
      return {
        status: 'succeeded',
        imageUri: action.imageUri,
        warning: action.warning ?? null,
      };
    case 'failed':
      return {
        status: 'failed',
        previousImageUri: visibleGenerationImageUri(state),
        error: action.error,
      };
  }
}
