#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd -- "${script_dir}/.." && pwd)"
output_directory="${1:-artifacts/android}"

if [[ "${output_directory}" = /* ]]; then
  resolved_output="${output_directory}"
else
  resolved_output="${project_root}/${output_directory}"
fi

mkdir -p -- "${resolved_output}"

docker build \
  --file "${project_root}/Dockerfile.android" \
  --target artifact \
  --output "type=local,dest=${resolved_output}" \
  "${project_root}"

apk_path="${resolved_output}/pocket-canvas-release.apk"
if [[ ! -f "${apk_path}" ]]; then
  echo "Release APK was not created: ${apk_path}" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  apk_hash="$(sha256sum -- "${apk_path}" | awk '{print $1}')"
else
  apk_hash="$(shasum -a 256 -- "${apk_path}" | awk '{print $1}')"
fi

apk_size="$(wc -c < "${apk_path}" | tr -d '[:space:]')"
printf 'Release APK: %s\nSize: %s bytes\nSHA-256: %s\n' \
  "${apk_path}" "${apk_size}" "${apk_hash}"
