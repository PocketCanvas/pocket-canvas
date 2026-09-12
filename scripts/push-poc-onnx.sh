#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$root/Chilloutmix"
package="com.anonymous.pocketcanvas"
destination="/sdcard/Android/data/${package}/files/poc-chilloutmix"

if [ ! -f "$source_dir/unet/model.ort" ]; then
  echo "Chilloutmix/unet/model.ort 가 없습니다. Hugging Face 묶음을 프로젝트 루트 Chilloutmix/ 에 두세요." >&2
  exit 1
fi

adb shell mkdir -p "$destination"
adb push --sync "$source_dir/." "$destination"
echo "ONNX PoC 파일을 ${destination} 에 복사했습니다."
