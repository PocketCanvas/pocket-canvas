$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'Chilloutmix'
$package = 'com.anonymous.pocketcanvas'
$destination = "/sdcard/Android/data/$package/files/poc-chilloutmix"

if (-not (Test-Path -LiteralPath (Join-Path $source 'unet\model.ort'))) {
  throw "Chilloutmix/unet/model.ort 가 없습니다. Hugging Face 묶음을 프로젝트 루트 Chilloutmix/ 에 두세요."
}

adb shell mkdir -p $destination
if ($LASTEXITCODE -ne 0) { throw 'adb mkdir 실패. 기기가 연결되어 있고 앱이 한 번 설치되어 있어야 합니다.' }

adb push --sync "$source/." $destination
if ($LASTEXITCODE -ne 0) { throw 'adb push 실패' }

Write-Host "ONNX PoC 파일을 $destination 에 복사했습니다."
