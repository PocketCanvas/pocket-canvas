[CmdletBinding()]
param(
  [string]$OutputDirectory = "artifacts/android"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedOutput = Join-Path $projectRoot $OutputDirectory

New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$dockerArguments = @(
  "build"
  "--file"
  (Join-Path $projectRoot "Dockerfile.android")
  "--target"
  "artifact"
  "--output"
  "type=local,dest=$resolvedOutput"
  $projectRoot
)

& docker @dockerArguments

if ($LASTEXITCODE -ne 0) {
  throw "Docker release build failed with exit code $LASTEXITCODE."
}

$apkPath = Join-Path $resolvedOutput "pocket-canvas-release.apk"
if (-not (Test-Path -LiteralPath $apkPath -PathType Leaf)) {
  throw "Release APK was not created: $apkPath"
}

$apk = Get-Item -LiteralPath $apkPath
$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $apkPath
Write-Host "Release APK: $($apk.FullName)"
Write-Host "Size: $($apk.Length) bytes"
Write-Host "SHA-256: $($hash.Hash)"
