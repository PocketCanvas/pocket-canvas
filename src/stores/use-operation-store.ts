import { create } from 'zustand';

export type HeavyOperationKind = 'generation' | 'quantization' | 'modelImport';

export type HeavyOperation = {
  id: string;
  kind: HeavyOperationKind;
  label: string;
  startedAt: number;
};

type StartOperationRequest = Pick<HeavyOperation, 'kind' | 'label'>;

type OperationState = {
  activeOperation: HeavyOperation | null;
  tryStartOperation: (request: StartOperationRequest) => HeavyOperation | null;
  finishOperation: (id: string) => void;
};

function createOperationId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const useOperationStore = create<OperationState>((set) => ({
  activeOperation: null,
  tryStartOperation: (request) => {
    let acquired: HeavyOperation | null = null;
    set((state) => {
      if (state.activeOperation) return state;

      acquired = {
        ...request,
        id: createOperationId(),
        startedAt: Date.now(),
      };
      return { activeOperation: acquired };
    });
    return acquired;
  },
  finishOperation: (id) => {
    set((state) => (state.activeOperation?.id === id ? { activeOperation: null } : state));
  },
}));
