#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd -- "${script_dir}/.." && pwd)"
source_dir="${project_root}/Chilloutmix"
package="com.anonymous.pocketcanvas"
destination="/sdcard/Android/data/${package}/files/poc-chilloutmix"

if [[ ! -f "${source_dir}/unet/model.ort" ]]; then
  echo "Chilloutmix/unet/model.ort 가 없습니다. Hugging Face 묶음을 프로젝트 루트 Chilloutmix/ 에 두세요." >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb 를 PATH 에서 찾지 못했습니다." >&2
  exit 1
fi

if ! adb get-state >/dev/null 2>&1; then
  echo "연결된 Android 기기가 없습니다. USB 디버깅을 켜고 앱을 한 번 설치하세요." >&2
  exit 1
fi

# Git Bash의 /c/Users/... 경로는 Windows adb가 읽지 못합니다.
if command -v cygpath >/dev/null 2>&1; then
  local_source="$(cygpath -w "${source_dir}")"
else
  local_source="${source_dir}"
fi

adb shell mkdir -p -- "${destination}"
adb push --sync "${local_source}/." "${destination}"
echo "ONNX PoC 파일을 ${destination} 에 복사했습니다."
