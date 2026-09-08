export type ModelFileFormat = 'gguf' | 'safetensors';
export type ModelFileKind = 'model' | 'lora' | 'unknown';
export type DiffusionModelFamily = 'sd1' | 'sdxl' | 'anima' | 'unknown';
export type ModelComponent = 'diffusion' | 'textEncoder' | 'vae' | 'other';
export type DominantStorage =
  'f32' | 'f16' | 'bf16' | 'f8' | 'q4' | 'q5' | 'q8' | 'mixed' | 'unknown';

export type ComponentStorage = {
  class: 'float' | 'quantized' | 'mixed' | 'unknown';
  dominantType: DominantStorage;
  tensorCount: number;
  estimatedBytes: number;
  histogram: Record<string, { tensorCount: number; estimatedBytes: number }>;
};

export type ModelDescriptor = {
  schemaVersion: 1;
  family: {
    value: DiffusionModelFamily;
    evidence: 'tensor-signature' | 'insufficient';
  };
  variant: {
    value: 'turbo' | 'unknown';
    evidence:
      'gguf-metadata' | 'safetensors-metadata' | 'original-file-name' | 'alias' | 'insufficient';
  };
  storage: Record<ModelComponent, ComponentStorage>;
};

export type ModelInspection = {
  format: ModelFileFormat;
  kind: ModelFileKind;
  family: DiffusionModelFamily;
  tensorCount: number;
  tensorTypes: Record<string, number>;
  tensorShapes: Record<string, number[]>;
  storage: Record<ModelComponent, ComponentStorage>;
  metadata: Record<string, string>;
};

type QuantizedStorageType = 'q8_0' | 'q5_0' | 'q5_1' | 'q4_0' | 'q4_1' | 'q4_K' | 'other';

export type QuantizationAvailability =
  | { type: 'available'; sourcePrecision: 'f32' | 'f16' | 'bf16' | 'f8' | 'mixed' }
  | {
      type: 'alreadyQuantized';
      primaryType: QuantizedStorageType | 'mixed';
    }
  | { type: 'unsupported'; reason: string };

export type ByteSource = {
  size: number;
  read(offset: number, length: number): Uint8Array;
};

const MAX_HEADER_BYTES = 32 * 1024 * 1024;
const MAX_ITEMS = 200_000;
const MAX_STRING_BYTES = 16 * 1024 * 1024;

type StorageAccumulator = Record<
  ModelComponent,
  {
    tensorCount: number;
    estimatedBytes: number;
    histogram: Record<string, { tensorCount: number; estimatedBytes: number }>;
  }
>;

function createStorageAccumulator(): StorageAccumulator {
  const component = () => ({ tensorCount: 0, estimatedBytes: 0, histogram: {} });
  return {
    diffusion: component(),
    textEncoder: component(),
    vae: component(),
    other: component(),
  };
}

function modelComponent(name: string): ModelComponent {
  if (
    name.startsWith('model.diffusion_model.') ||
    name.startsWith('unet.') ||
    name.startsWith('net.')
  ) {
    return 'diffusion';
  }
  if (name.startsWith('first_stage_model.') || name.startsWith('vae.')) return 'vae';
  if (
    name.startsWith('conditioner.') ||
    name.startsWith('cond_stage_model.') ||
    name.startsWith('te.') ||
    name.startsWith('text_model.') ||
    name.startsWith('llm_adapter.')
  ) {
    return 'textEncoder';
  }
  return 'other';
}

function addStorage(
  accumulator: StorageAccumulator,
  name: string,
  storageType: string,
  estimatedBytes: number,
): void {
  const target = accumulator[modelComponent(name)];
  target.tensorCount += 1;
  target.estimatedBytes += estimatedBytes;
  const type = target.histogram[storageType] ?? { tensorCount: 0, estimatedBytes: 0 };
  type.tensorCount += 1;
  type.estimatedBytes += estimatedBytes;
  target.histogram[storageType] = type;
}

function finishStorage(accumulator: StorageAccumulator): Record<ModelComponent, ComponentStorage> {
  return Object.fromEntries(
    Object.entries(accumulator).map(([component, value]) => {
      const types = Object.keys(value.histogram);
      const quantized = new Set(
        types.flatMap((type) => {
          if (type.startsWith('q4')) return ['q4' as const];
          if (type.startsWith('q5')) return ['q5' as const];
          if (type.startsWith('q8')) return ['q8' as const];
          if (type.startsWith('q') || type === 'other' || type.startsWith('ggml_')) {
            return ['mixed' as const];
          }
          return [];
        }),
      );
      const floats = new Set(
        types.flatMap((type) => {
          if (type === 'f16') return ['f16' as const];
          if (type === 'f32' || type === 'f64') return ['f32' as const];
          if (type === 'bf16') return ['bf16' as const];
          if (type.startsWith('f8')) return ['f8' as const];
          return [];
        }),
      );
      let storageClass: ComponentStorage['class'] = 'unknown';
      let dominantType: DominantStorage = 'unknown';
      if (quantized.size === 1 && !quantized.has('mixed')) {
        storageClass = 'quantized';
        dominantType = [...quantized][0];
      } else if (quantized.size > 0) {
        storageClass = 'mixed';
        dominantType = 'mixed';
      } else if (floats.size === 1) {
        storageClass = 'float';
        dominantType = [...floats][0];
      } else if (floats.size > 1) {
        storageClass = 'float';
        dominantType = 'mixed';
      }
      return [component, { ...value, class: storageClass, dominantType }];
    }),
  ) as Record<ModelComponent, ComponentStorage>;
}

export function supportedModelExtension(fileName: string): '.gguf' | '.safetensors' | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.safetensors')) return '.safetensors';
  if (lowerName.endsWith('.gguf')) return '.gguf';
  return null;
}

export function inspectModelBytes(bytes: Uint8Array): ModelInspection {
  return inspectModelFile({
    size: bytes.byteLength,
    read: (offset, length) => bytes.slice(offset, offset + length),
  });
}

export function inspectModelFile(source: ByteSource): ModelInspection {
  if (source.size < 8) throw new Error('지원하지 않는 파일 형식입니다.');
  const prefix = source.read(0, 8);
  return String.fromCharCode(...prefix.slice(0, 4)) === 'GGUF'
    ? inspectGguf(source)
    : inspectSafetensors(source, prefix);
}

function inspectSafetensors(source: ByteSource, prefix: Uint8Array): ModelInspection {
  const headerLength = safeNumber(
    new DataView(prefix.buffer, prefix.byteOffset, 8).getBigUint64(0, true),
  );
  if (headerLength < 2 || headerLength > MAX_HEADER_BYTES || headerLength > source.size - 8) {
    throw new Error('지원하지 않는 파일 형식입니다.');
  }

  const rawHeader = exactRead(source, 8, headerLength);
  if (rawHeader[0] !== 0x7b) throw new Error('유효하지 않은 SafeTensors 헤더입니다.');

  let header: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawHeader));
  } catch {
    throw new Error('유효하지 않은 SafeTensors 헤더입니다.');
  }
  if (!header || Array.isArray(header) || typeof header !== 'object') {
    throw new Error('유효하지 않은 SafeTensors 헤더입니다.');
  }

  const tensorNames: string[] = [];
  const tensorTypes: Record<string, number> = {};
  const tensorShapes: Record<string, number[]> = {};
  const storage = createStorageAccumulator();
  const dataSize = source.size - 8 - headerLength;
  for (const [name, value] of Object.entries(header)) {
    if (name === '__metadata__') continue;
    if (tensorNames.length >= MAX_ITEMS || !isTensorInfo(value, dataSize)) {
      throw new Error('유효하지 않은 SafeTensors tensor 정보입니다.');
    }
    tensorNames.push(name);
    const tensor = value as Record<string, unknown>;
    const dtype = tensor.dtype as string;
    const shape = (tensor.shape as number[]).map(Number);
    const offsets = tensor.data_offsets as number[];
    tensorTypes[dtype] = (tensorTypes[dtype] ?? 0) + 1;
    tensorShapes[name] = shape;
    addStorage(storage, name, safetensorsStorageName(dtype), offsets[1] - offsets[0]);
  }
  if (!tensorNames.length) throw new Error('tensor가 없는 SafeTensors 파일입니다.');

  return {
    format: 'safetensors',
    kind: classifyTensorNames(tensorNames),
    family: classifyModelFamily(tensorNames, tensorShapes),
    tensorCount: tensorNames.length,
    tensorTypes,
    tensorShapes,
    storage: finishStorage(storage),
    metadata: stringMetadata(header.__metadata__),
  };
}

function inspectGguf(source: ByteSource): ModelInspection {
  const cursor = new Cursor(source, 4, Math.min(source.size, MAX_HEADER_BYTES));
  const version = cursor.u32();
  if (version < 2 || version > 3) throw new Error(`지원하지 않는 GGUF 버전입니다: ${version}`);

  const tensorCount = cursor.count();
  const metadataCount = cursor.count();
  if (!tensorCount) throw new Error('tensor가 없는 GGUF 파일입니다.');

  const metadata: Record<string, string> = {};
  for (let index = 0; index < metadataCount; index += 1) {
    const key = cursor.string();
    const type = cursor.u32();
    if (type === 8 && ['general.architecture', 'general.name'].includes(key)) {
      metadata[key] = cursor.string();
    } else {
      cursor.skipValue(type);
    }
  }

  const tensorNames: string[] = [];
  const tensorTypes: Record<string, number> = {};
  const tensorShapes: Record<string, number[]> = {};
  const storage = createStorageAccumulator();
  for (let index = 0; index < tensorCount; index += 1) {
    const name = cursor.string();
    tensorNames.push(name);
    const dimensions = cursor.u32();
    if (dimensions < 1 || dimensions > 8) throw new Error('유효하지 않은 GGUF tensor 차원입니다.');
    const ggmlShape: number[] = [];
    for (let dimension = 0; dimension < dimensions; dimension += 1) {
      ggmlShape.push(cursor.u64());
    }
    const tensorType = cursor.u32();
    tensorTypes[tensorType] = (tensorTypes[tensorType] ?? 0) + 1;
    tensorShapes[name] = ggmlShape.toReversed();
    addStorage(
      storage,
      name,
      ggufStorageName(tensorType),
      estimateGgufTensorBytes(ggmlShape, tensorType),
    );
    const offset = cursor.u64();
    if (offset > source.size) throw new Error('유효하지 않은 GGUF tensor offset입니다.');
  }

  const kind = classifyTensorNames(tensorNames, metadata['general.architecture']);
  return {
    format: 'gguf',
    kind,
    family: classifyModelFamily(tensorNames, tensorShapes),
    tensorCount,
    tensorTypes,
    tensorShapes,
    storage: finishStorage(storage),
    metadata,
  };
}

export function describeModel(
  inspection: ModelInspection,
  identifiers: { originalFileName: string; alias: string },
): ModelDescriptor {
  const metadataName = inspection.metadata['general.name'];
  let variant: ModelDescriptor['variant'] = { value: 'unknown', evidence: 'insufficient' };
  if (metadataName && TURBO_TOKEN.test(metadataName)) {
    variant = {
      value: 'turbo',
      evidence: inspection.format === 'gguf' ? 'gguf-metadata' : 'safetensors-metadata',
    };
  } else if (TURBO_TOKEN.test(identifiers.originalFileName)) {
    variant = { value: 'turbo', evidence: 'original-file-name' };
  } else if (TURBO_TOKEN.test(identifiers.alias)) {
    variant = { value: 'turbo', evidence: 'alias' };
  }
  return {
    schemaVersion: 1,
    family: {
      value: inspection.family,
      evidence: inspection.family === 'unknown' ? 'insufficient' : 'tensor-signature',
    },
    variant,
    storage: inspection.storage,
  };
}

const TURBO_TOKEN = /(^|[^a-z0-9])turbo([^a-z0-9]|$)/i;

function classifyModelFamily(
  tensorNames: string[],
  tensorShapes: Record<string, number[]>,
): DiffusionModelFamily {
  const hasUnet = tensorNames.some(
    (name) =>
      name.includes('model.diffusion_model.input_blocks.') || name.includes('unet.down_blocks.'),
  );
  const hasSecondTextEncoder = tensorNames.some(
    (name) =>
      name.includes('conditioner.embedders.1') ||
      name.includes('cond_stage_model.1') ||
      name.includes('te.1'),
  );
  if (hasUnet && hasSecondTextEncoder) return 'sdxl';
  if (!hasUnet) return 'unknown';

  const tokenEmbeddingNames = [
    'cond_stage_model.transformer.text_model.embeddings.token_embedding.weight',
    'cond_stage_model.model.token_embedding.weight',
    'text_model.embeddings.token_embedding.weight',
    'te.text_model.embeddings.token_embedding.weight',
    'conditioner.embedders.0.model.token_embedding.weight',
    'conditioner.embedders.0.transformer.text_model.embeddings.token_embedding.weight',
  ];
  const tokenEmbeddingShape = tokenEmbeddingNames.map((name) => tensorShapes[name]).find(Boolean);
  return tokenEmbeddingShape?.at(-1) === 768 ? 'sd1' : 'unknown';
}

export function inspectQuantizationAvailability(
  inspection: ModelInspection,
): QuantizationAvailability {
  return inspection.format === 'gguf'
    ? inspectGgufQuantizationAvailability(inspection.tensorTypes)
    : inspectSafetensorsQuantizationAvailability(inspection.tensorTypes);
}

const GGUF_FLOAT_TYPES = new Map<number, 'f32' | 'f16' | 'bf16'>([
  [0, 'f32'],
  [1, 'f16'],
  [30, 'bf16'],
] as const);
const GGUF_AUXILIARY_TYPES = new Set([24, 25, 26, 27, 28]);
const GGUF_QUANTIZED_TYPES = new Map<number, QuantizedStorageType>([
  [2, 'q4_0'],
  [3, 'q4_1'],
  [6, 'q5_0'],
  [7, 'q5_1'],
  [8, 'q8_0'],
  [9, 'other'],
  [10, 'other'],
  [11, 'other'],
  [12, 'q4_K'],
  [13, 'other'],
  [14, 'other'],
  [15, 'other'],
  [16, 'other'],
  [17, 'other'],
  [18, 'other'],
  [19, 'other'],
  [20, 'other'],
  [21, 'other'],
  [22, 'other'],
  [23, 'other'],
  [29, 'other'],
  [34, 'other'],
  [35, 'other'],
  [39, 'other'],
  [40, 'other'],
  [41, 'other'],
]);

function safetensorsStorageName(dtype: string): string {
  if (dtype === 'F16') return 'f16';
  if (dtype === 'F32' || dtype === 'F64') return dtype.toLowerCase();
  if (dtype === 'BF16') return 'bf16';
  if (dtype.startsWith('F8')) return 'f8';
  return dtype.toLowerCase();
}

function ggufStorageName(type: number): string {
  if (GGUF_AUXILIARY_TYPES.has(type)) return 'aux';
  return GGUF_FLOAT_TYPES.get(type) ?? GGUF_QUANTIZED_TYPES.get(type) ?? `ggml_${type}`;
}

const GGUF_TYPE_LAYOUT = new Map<number, { blockElements: number; blockBytes: number }>([
  [0, { blockElements: 1, blockBytes: 4 }],
  [1, { blockElements: 1, blockBytes: 2 }],
  [2, { blockElements: 32, blockBytes: 18 }],
  [3, { blockElements: 32, blockBytes: 20 }],
  [6, { blockElements: 32, blockBytes: 22 }],
  [7, { blockElements: 32, blockBytes: 24 }],
  [8, { blockElements: 32, blockBytes: 34 }],
  [12, { blockElements: 256, blockBytes: 144 }],
  [13, { blockElements: 256, blockBytes: 176 }],
  [14, { blockElements: 256, blockBytes: 210 }],
  [15, { blockElements: 256, blockBytes: 292 }],
  [30, { blockElements: 1, blockBytes: 2 }],
]);

function estimateGgufTensorBytes(shape: number[], type: number): number {
  const layout = GGUF_TYPE_LAYOUT.get(type);
  if (!layout) return 0;
  const elements = shape.reduce((product, size) => product * size, 1);
  return Math.ceil(elements / layout.blockElements) * layout.blockBytes;
}

function inspectGgufQuantizationAvailability(
  tensorTypes: Record<string, number>,
): QuantizationAvailability {
  const numericTypes = Object.keys(tensorTypes).map(Number);
  const unknownTypes = numericTypes.filter(
    (type) =>
      !GGUF_FLOAT_TYPES.has(type) &&
      !GGUF_AUXILIARY_TYPES.has(type) &&
      !GGUF_QUANTIZED_TYPES.has(type),
  );
  if (unknownTypes.length) {
    return {
      type: 'unsupported',
      reason: `지원하지 않는 GGUF tensor 저장 타입이 포함되어 있습니다: ${unknownTypes.join(', ')}`,
    };
  }

  const quantizedTypes = numericTypes.filter((type) => GGUF_QUANTIZED_TYPES.has(type));
  if (quantizedTypes.length) {
    const detected = new Set(quantizedTypes.map((type) => GGUF_QUANTIZED_TYPES.get(type)!));
    return {
      type: 'alreadyQuantized',
      primaryType: detected.size === 1 ? [...detected][0] : 'mixed',
    };
  }

  const precisions = new Set(
    numericTypes.flatMap((type) => {
      const precision = GGUF_FLOAT_TYPES.get(type);
      return precision ? [precision] : [];
    }),
  );
  if (!precisions.size) {
    return { type: 'unsupported', reason: '양자화할 부동소수점 tensor를 찾지 못했습니다.' };
  }
  return {
    type: 'available',
    sourcePrecision: precisions.size === 1 ? [...precisions][0] : 'mixed',
  };
}

function inspectSafetensorsQuantizationAvailability(
  tensorTypes: Record<string, number>,
): QuantizationAvailability {
  const supported = new Set([
    'F16',
    'F32',
    'BF16',
    'F64',
    'F8_E4M3',
    'F8_E5M2',
    'I32',
    'I64',
    'U8',
  ]);
  const unknownTypes = Object.keys(tensorTypes).filter((type) => !supported.has(type));
  if (unknownTypes.length) {
    return {
      type: 'unsupported',
      reason: `지원하지 않는 SafeTensors dtype이 포함되어 있습니다: ${unknownTypes.join(', ')}`,
    };
  }

  const precisions = new Set(
    Object.keys(tensorTypes).flatMap((type) => {
      if (type === 'F16') return ['f16' as const];
      if (type === 'F32' || type === 'F64') return ['f32' as const];
      if (type === 'BF16') return ['bf16' as const];
      if (type === 'F8_E4M3' || type === 'F8_E5M2') return ['f8' as const];
      return [];
    }),
  );
  if (!precisions.size) {
    return { type: 'unsupported', reason: '양자화할 부동소수점 tensor를 찾지 못했습니다.' };
  }
  return {
    type: 'available',
    sourcePrecision: precisions.size === 1 ? [...precisions][0] : 'mixed',
  };
}

export function classifyTensorNames(names: string[], architecture?: string): ModelFileKind {
  const pairs = new Map<string, Set<string>>();
  for (const name of names) {
    const match = name.toLowerCase().match(/^(.*?)[._]lora[._](down|up|a|b)(?:\.weight)?$/);
    if (!match) continue;
    const sides = pairs.get(match[1]) ?? new Set<string>();
    sides.add(match[2]);
    pairs.set(match[1], sides);
  }
  if (
    [...pairs.values()].some(
      (sides) => (sides.has('down') && sides.has('up')) || (sides.has('a') && sides.has('b')),
    )
  ) {
    return 'lora';
  }

  if (
    architecture ||
    names.some((name) =>
      /(^|\.)(diffusion_model|model\.diffusion_model|input_blocks|double_blocks|transformer_blocks)\./i.test(
        name,
      ),
    )
  ) {
    return 'model';
  }
  return 'unknown';
}

function isTensorInfo(value: unknown, dataSize: number): boolean {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const tensor = value as Record<string, unknown>;
  const offsets = tensor.data_offsets;
  return (
    typeof tensor.dtype === 'string' &&
    Array.isArray(tensor.shape) &&
    tensor.shape.every((size) => Number.isSafeInteger(size) && Number(size) >= 0) &&
    Array.isArray(offsets) &&
    offsets.length === 2 &&
    offsets.every(Number.isSafeInteger) &&
    Number(offsets[0]) >= 0 &&
    Number(offsets[0]) <= Number(offsets[1]) &&
    Number(offsets[1]) <= dataSize
  );
}

function stringMetadata(value: unknown): Record<string, string> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function exactRead(source: ByteSource, offset: number, length: number): Uint8Array {
  const bytes = source.read(offset, length);
  if (bytes.byteLength !== length) throw new Error('파일이 예상보다 일찍 끝났습니다.');
  return bytes;
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('파일 헤더 값이 너무 큽니다.');
  return Number(value);
}

class Cursor {
  private readonly source: ByteSource;
  private readonly limit: number;
  private offset: number;

  constructor(source: ByteSource, offset = 0, limit = source.size) {
    this.source = source;
    this.offset = offset;
    this.limit = limit;
  }

  u32(): number {
    const bytes = this.take(4);
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
  }

  u64(): number {
    const bytes = this.take(8);
    return safeNumber(
      new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(0, true),
    );
  }

  count(): number {
    const value = this.u64();
    if (value > MAX_ITEMS) throw new Error('파일 헤더 항목이 너무 많습니다.');
    return value;
  }

  string(): string {
    const length = this.u64();
    if (length > MAX_STRING_BYTES) throw new Error('파일 헤더 문자열이 너무 큽니다.');
    return new TextDecoder('utf-8', { fatal: true }).decode(this.take(length));
  }

  skipValue(type: number, depth = 0): void {
    if (depth > 4) throw new Error('GGUF metadata 배열이 너무 깊습니다.');
    const sizes = [1, 1, 2, 2, 4, 4, 4, 1, 0, 0, 8, 8, 8];
    if (type < 0 || type >= sizes.length) throw new Error('알 수 없는 GGUF metadata 형식입니다.');
    if (type === 8) {
      this.string();
    } else if (type === 9) {
      const itemType = this.u32();
      const count = this.count();
      for (let index = 0; index < count; index += 1) this.skipValue(itemType, depth + 1);
    } else {
      this.take(sizes[type]);
    }
  }

  private take(length: number): Uint8Array {
    if (length < 0 || this.offset + length > this.limit) {
      throw new Error('파일 헤더가 파일 범위를 벗어났습니다.');
    }
    const bytes = exactRead(this.source, this.offset, length);
    this.offset += length;
    return bytes;
  }
}
