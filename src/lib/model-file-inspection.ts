export type ModelFileFormat = 'gguf' | 'safetensors';
export type ModelFileKind = 'model' | 'lora' | 'unknown';

export type ModelInspection = {
  format: ModelFileFormat;
  kind: ModelFileKind;
  tensorCount: number;
  metadata: Record<string, string>;
};

export type ByteSource = {
  size: number;
  read(offset: number, length: number): Uint8Array;
};

const MAX_HEADER_BYTES = 32 * 1024 * 1024;
const MAX_ITEMS = 200_000;
const MAX_STRING_BYTES = 16 * 1024 * 1024;

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
  const dataSize = source.size - 8 - headerLength;
  for (const [name, value] of Object.entries(header)) {
    if (name === '__metadata__') continue;
    if (tensorNames.length >= MAX_ITEMS || !isTensorInfo(value, dataSize)) {
      throw new Error('유효하지 않은 SafeTensors tensor 정보입니다.');
    }
    tensorNames.push(name);
  }
  if (!tensorNames.length) throw new Error('tensor가 없는 SafeTensors 파일입니다.');

  return {
    format: 'safetensors',
    kind: classifyTensorNames(tensorNames),
    tensorCount: tensorNames.length,
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
  for (let index = 0; index < tensorCount; index += 1) {
    tensorNames.push(cursor.string());
    const dimensions = cursor.u32();
    if (dimensions < 1 || dimensions > 8) throw new Error('유효하지 않은 GGUF tensor 차원입니다.');
    for (let dimension = 0; dimension < dimensions; dimension += 1) cursor.u64();
    cursor.u32();
    const offset = cursor.u64();
    if (offset > source.size) throw new Error('유효하지 않은 GGUF tensor offset입니다.');
  }

  const kind = classifyTensorNames(tensorNames, metadata['general.architecture']);
  return { format: 'gguf', kind, tensorCount, metadata };
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
