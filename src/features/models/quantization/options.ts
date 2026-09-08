import type { QuantizationType } from 'stable-diffusion';

export type { QuantizationType } from 'stable-diffusion';

export type QuantizationOption = {
  value: QuantizationType;
  label: string;
  description: string;
};

export const QUANTIZATION_OPTIONS: readonly QuantizationOption[] = [
  { value: 'q8_0', label: 'Q8_0', description: '가장 높은 품질, 가장 큰 파일' },
  { value: 'q5_0', label: 'Q5_0', description: '품질과 크기의 균형' },
  { value: 'q5_1', label: 'Q5_1', description: 'Q5_0보다 정밀한 5비트 방식' },
  { value: 'q4_0', label: 'Q4_0', description: '작은 파일을 위한 4비트 방식' },
  { value: 'q4_1', label: 'Q4_1', description: 'Q4_0보다 정밀한 4비트 방식' },
  { value: 'q4_K', label: 'Q4_K', description: '실기기 생성이 검증된 권장 방식' },
];

export function isQuantizationType(value: unknown): value is QuantizationType {
  return QUANTIZATION_OPTIONS.some((option) => option.value === value);
}
