# Production-build workspaces (Windows PowerShell).
# Usage: .\build.ps1 [app...]
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$BuildArgs
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Error "python is required to run build.ps1"
    exit 1
}

& python (Join-Path $PSScriptRoot "scripts\build.py") @BuildArgs
exit $LASTEXITCODE
