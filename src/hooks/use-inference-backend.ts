import { useStore } from 'zustand';

import { inferenceBackendStore } from '@/features/generation/backend-store';

export function useInferenceBackend() {
  const backend = useStore(inferenceBackendStore, (state) => state.backend);
  const setBackend = useStore(inferenceBackendStore, (state) => state.setBackend);
  return { backend, setBackend };
}
