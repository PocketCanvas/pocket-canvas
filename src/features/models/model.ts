import type { QuantizationType } from 'stable-diffusion';

import type { ModelFileFormat, ModelFileKind } from '@/features/models/inspection';

export type StoredModel = {
  id: string;
  fileName: string;
  storedFileName: string;
  alias: string;
  kind: ModelFileKind;
  detectedKind: ModelFileKind;
  format: ModelFileFormat;
  sizeBytes: number;
  description: string;
  createdAt: string;
  quantization?: QuantizationType;
  sourceModelId?: string;
};
