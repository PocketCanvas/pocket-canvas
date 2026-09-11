import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

export const INFERENCE_BACKENDS = ['vulkan', 'cpu'] as const;

export type InferenceBackend = (typeof INFERENCE_BACKENDS)[number];

type InferenceBackendState = {
  inferenceBackend: InferenceBackend;
  setInferenceBackend: (backend: InferenceBackend) => void;
};

export function isInferenceBackend(value: unknown): value is InferenceBackend {
  return value === 'vulkan' || value === 'cpu';
}

export const inferenceBackendStore = createStore<InferenceBackendState>()(
  persist(
    (set) => ({
      inferenceBackend: 'vulkan',
      setInferenceBackend: (inferenceBackend) => set({ inferenceBackend }),
    }),
    {
      name: 'pocket-canvas-inference-backend',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
