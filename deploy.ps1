# Deploy the compose stack (Windows PowerShell).
# Auto-selects the SSH-tunneled remote Docker daemon or local Docker.
# Tab completion lists app names from scripts/apps.py.
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [ArgumentCompleter({
        param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
        $flags = @(
            '--local', '--remote', '--no-build', '--build-only', '--down', '--status', '--help'
        )
        $repo = (Get-Location).Path
        $appsPy = Join-Path $repo 'scripts\apps.py'
        if (-not (Test-Path -LiteralPath $appsPy)) {
            $invoked = $commandAst.CommandElements[0].Extent.Text.Trim('"').Trim("'")
            try {
                $scriptPath = (Resolve-Path -LiteralPath $invoked -ErrorAction Stop).Path
                $appsPy = Join-Path (Split-Path -Parent $scriptPath) 'scripts\apps.py'
            } catch {
                $appsPy = $null
            }
        }
        $apps = @()
        if ($appsPy -and (Test-Path -LiteralPath $appsPy)) {
            $apps = @(python -- $appsPy --complete 2>$null)
        }
        $prior = @($commandAst.CommandElements | Select-Object -Skip 1)
        if ($prior.Count -gt 1) { $prior = $prior[0..($prior.Count - 2)] } else { $prior = @() }
        $used = @($prior | ForEach-Object { $_.Extent.Text })
        foreach ($item in @($flags + $apps)) {
            if ($item -and ($item -like "$wordToComplete*") -and ($used -notcontains $item)) {
                [System.Management.Automation.CompletionResult]::new($item, $item, 'ParameterValue', $item)
            }
        }
    })]
    [string[]]$DeployArgs
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Error "python is required to run deploy.ps1"
    exit 1
}

& python (Join-Path $PSScriptRoot "scripts\deploy.py") @DeployArgs
exit $LASTEXITCODE
