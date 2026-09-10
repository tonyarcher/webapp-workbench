# Deploy the compose stack (Windows PowerShell).
# Auto-selects the SSH-tunneled remote Docker daemon or local Docker.
# Tab completion lists app names from scripts/apps.mjs.
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [ArgumentCompleter({
        param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
        $flags = @(
            '--local', '--remote', '--no-build', '--build-only', '--down', '--status', '--help'
        )
        $repo = (Get-Location).Path
        $appsJs = Join-Path $repo 'scripts\apps.mjs'
        if (-not (Test-Path -LiteralPath $appsJs)) {
            $invoked = $commandAst.CommandElements[0].Extent.Text.Trim('"').Trim("'")
            try {
                $scriptPath = (Resolve-Path -LiteralPath $invoked -ErrorAction Stop).Path
                $appsJs = Join-Path (Split-Path -Parent $scriptPath) 'scripts\apps.mjs'
            } catch {
                $appsJs = $null
            }
        }
        $apps = @()
        if ($appsJs -and (Test-Path -LiteralPath $appsJs)) {
            $apps = @(node -- $appsJs --complete 2>$null)
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

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error "node is required to run deploy.ps1"
    exit 1
}

& node (Join-Path $PSScriptRoot "scripts\deploy.mjs") @DeployArgs
exit $LASTEXITCODE
