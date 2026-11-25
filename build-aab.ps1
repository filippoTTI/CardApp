# Genera l'AAB di produzione su EAS e lo scarica in .\release
# Uso: .\build-aab.ps1            -> build + download AAB
#      .\build-aab.ps1 -Submit    -> build + invio automatico a Play Console (richiede service account in eas.json)
param([switch]$Submit)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

npx eas-cli whoami | Out-Null
if ($LASTEXITCODE -ne 0) { npx eas-cli login }

if ($Submit) {
    npx eas-cli build -p android --profile production --non-interactive --wait --auto-submit
    exit $LASTEXITCODE
}

npx eas-cli build -p android --profile production --non-interactive --wait
if ($LASTEXITCODE -ne 0) { throw "Build fallita" }

$build = (npx eas-cli build:list -p android --profile production --status finished --limit 1 --json --non-interactive | ConvertFrom-Json)[0]
$url = $build.artifacts.buildUrl
if (-not $url) { throw "Artifact non trovato" }

$out = Join-Path $PSScriptRoot "release"
New-Item -ItemType Directory -Force $out | Out-Null
$file = Join-Path $out ("CardApp-" + $build.appVersion + "-" + $build.appBuildVersion + ".aab")
Invoke-WebRequest $url -OutFile $file
Write-Host "AAB pronto: $file"
