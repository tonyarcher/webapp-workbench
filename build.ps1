# Production-build workspaces (Windows PowerShell).
# Usage: .\build.ps1 [app...]
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$BuildArgs
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error "node is required to run build.ps1"
    exit 1
}

& node (Join-Path $PSScriptRoot "scripts\build.mjs") @BuildArgs
exit $LASTEXITCODE
