# Deploy the compose stack (Windows PowerShell).
# Auto-selects the SSH-tunneled remote Docker daemon or local Docker.
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$DeployArgs
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error "node is required to run deploy.ps1"
    exit 1
}

& node (Join-Path $PSScriptRoot "scripts\deploy.mjs") @DeployArgs
exit $LASTEXITCODE
