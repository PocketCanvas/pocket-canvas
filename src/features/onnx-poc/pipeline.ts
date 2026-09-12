export const ONNX_POC_DIRECTORY_NAME = 'poc-chilloutmix';

export const ONNX_POC_PROMPT =
  'RAW photo, photorealistic, a fluffy ginger tabby cat climbing a thick tree trunk, looking up, paws gripping bark, sunlit forest, dappled light through leaves, shallow depth of field, 85mm, f/1.8, natural lighting, sharp focus, masterpiece, best quality, ultra detailed';
export const ONNX_POC_NEGATIVE_PROMPT =
  'worst quality, low quality, blurry, deformed, cartoon, anime, illustration, painting, extra legs, extra tails, watermark, text';
export const ONNX_POC_WIDTH = 512;
export const ONNX_POC_HEIGHT = 512;
export const ONNX_POC_STEPS = 20;
export const ONNX_POC_CFG = 7;
export const ONNX_POC_SEED = 42;

export const ONNX_POC_SESSION_FILES = [
  { role: 'text_encoder', relativePath: 'text_encoder/model.ort' },
  { role: 'unet', relativePath: 'unet/model.ort' },
  { role: 'vae_decoder', relativePath: 'vae_decoder/model.ort' },
] as const;

export const ONNX_POC_TOKENIZER_FILES = [
  'tokenizer/vocab.json',
  'tokenizer/merges.txt',
  'tokenizer/tokenizer_config.json',
] as const;

export const ONNX_POC_REQUIRED_FILES = [
  ...ONNX_POC_SESSION_FILES.map((file) => file.relativePath),
  ...ONNX_POC_TOKENIZER_FILES,
] as const;

export type OnnxPocSessionRole = (typeof ONNX_POC_SESSION_FILES)[number]['role'];

export type OnnxTensorInfo = {
  name: string;
  type: string;
  shape: number[];
};

export type OnnxPocSessionInspection = {
  role: OnnxPocSessionRole;
  relativePath: string;
  inputs: OnnxTensorInfo[];
  outputs: OnnxTensorInfo[];
};

export type OnnxPocGeneration =
  | {
      ok: true;
      outputPath: string;
      width: number;
      height: number;
      steps: number;
      elapsedMs: number;
    }
  | {
      ok: false;
      error: string;
    };

export type OnnxPocInspection =
  | {
      ok: true;
      rootPath: string;
      sessions: OnnxPocSessionInspection[];
    }
  | {
      ok: false;
      rootPath: string | null;
      missing: string[];
      error?: string;
    };

export function isOnnxPocSessionRole(value: string): value is OnnxPocSessionRole {
  return ONNX_POC_SESSION_FILES.some((file) => file.role === value);
}

export function parseOnnxPocInspection(value: unknown): OnnxPocInspection {
  if (!value || typeof value !== 'object') {
    return { ok: false, rootPath: null, missing: [], error: '검사 결과가 없습니다.' };
  }
  const record = value as Record<string, unknown>;
  const rootPath = typeof record.rootPath === 'string' ? record.rootPath : null;
  if (record.ok === true) {
    if (!rootPath) {
      return { ok: false, rootPath: null, missing: [], error: '모델 경로가 없습니다.' };
    }
    const sessions = parseSessions(record.sessions);
    if (!sessions) {
      return { ok: false, rootPath, missing: [], error: '세션 정보를 읽지 못했습니다.' };
    }
    return { ok: true, rootPath, sessions };
  }
  const missing = Array.isArray(record.missing)
    ? record.missing.filter((item): item is string => typeof item === 'string')
    : [];
  const error = typeof record.error === 'string' ? record.error : undefined;
  return { ok: false, rootPath, missing, error };
}

export function parseOnnxPocGeneration(value: unknown): OnnxPocGeneration {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: '생성 결과가 없습니다.' };
  }
  const record = value as Record<string, unknown>;
  if (record.ok === true) {
    if (typeof record.outputPath !== 'string' || record.outputPath.length === 0) {
      return { ok: false, error: '출력 경로가 없습니다.' };
    }
    return {
      ok: true,
      outputPath: record.outputPath,
      width: numberOrZero(record.width),
      height: numberOrZero(record.height),
      steps: numberOrZero(record.steps),
      elapsedMs: numberOrZero(record.elapsedMs),
    };
  }
  return {
    ok: false,
    error: typeof record.error === 'string' ? record.error : 'ONNX 생성에 실패했습니다.',
  };
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseSessions(value: unknown): OnnxPocSessionInspection[] | null {
  if (!Array.isArray(value)) return null;
  const sessions: OnnxPocSessionInspection[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    if (typeof record.role !== 'string' || !isOnnxPocSessionRole(record.role)) return null;
    if (typeof record.relativePath !== 'string') return null;
    const inputs = parseTensors(record.inputs);
    const outputs = parseTensors(record.outputs);
    if (!inputs || !outputs) return null;
    sessions.push({
      role: record.role,
      relativePath: record.relativePath,
      inputs,
      outputs,
    });
  }
  return sessions;
}

function parseTensors(value: unknown): OnnxTensorInfo[] | null {
  if (!Array.isArray(value)) return null;
  const tensors: OnnxTensorInfo[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    if (typeof record.name !== 'string' || typeof record.type !== 'string') return null;
    if (!Array.isArray(record.shape) || record.shape.some((dim) => typeof dim !== 'number')) {
      return null;
    }
    tensors.push({
      name: record.name,
      type: record.type,
      shape: record.shape as number[],
    });
  }
  return tensors;
}
