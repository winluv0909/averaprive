# Run from the Avera Prive project after copying this package into its root.
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$packagePath = Join-Path $projectRoot 'package.json'
if (-not (Test-Path -LiteralPath $packagePath)) { throw 'Copy this update into your existing project root first.' }
$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
if ($package.name -ne 'agency-prive-platform') { throw 'This is not the expected Avera Prive project.' }
$entries = Get-Content -LiteralPath (Join-Path $projectRoot 'ARCHIVED-DOCUMENTS.json') -Raw | ConvertFrom-Json
foreach ($entry in $entries) {
    $original = Join-Path $projectRoot $entry.original
    $archived = Join-Path $projectRoot $entry.archived
    if (-not (Test-Path -LiteralPath $original)) { continue }
    if (-not (Test-Path -LiteralPath $archived)) { throw "Archived copy missing: $($entry.archived)" }
    $sourceHash = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash
    $archiveHash = (Get-FileHash -LiteralPath $archived -Algorithm SHA256).Hash
    if ($sourceHash -ne $entry.sha256 -or $archiveHash -ne $entry.sha256) {
        Write-Warning "Preserved modified historical document: $($entry.original)"
        continue
    }
    # Remove only the identical duplicate; its verified archived copy stays in the repository.
    Remove-Item -LiteralPath $original
    Write-Host "Archived: $($entry.original)"
}
Write-Host 'Historical documents archived. No database or environment files were changed by this script.'
Write-Host 'Next: npm ci; then npm run verify.'
