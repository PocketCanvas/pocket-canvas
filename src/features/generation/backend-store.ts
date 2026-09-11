import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { DEFAULT_INFERENCE_BACKEND, parseInferenceBackend, type InferenceBackend } from './backend';

type InferenceBackendState = {
  backend: InferenceBackend;
  setBackend: (backend: InferenceBackend) => void;
};

export const inferenceBackendStore = createStore<InferenceBackendState>()(
  persist(
    (set) => ({
      backend: DEFAULT_INFERENCE_BACKEND,
      setBackend: (backend) => set({ backend: parseInferenceBackend(backend) }),
    }),
    {
      name: 'pocket-canvas-inference-backend',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ backend: state.backend }),
      merge: (persisted, current) => ({
        ...current,
        backend: parseInferenceBackend(
          persisted && typeof persisted === 'object'
            ? (persisted as { backend?: unknown }).backend
            : current.backend,
        ),
      }),
    },
  ),
);
