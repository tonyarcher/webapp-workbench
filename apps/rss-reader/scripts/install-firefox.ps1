# Creates a desktop shortcut that opens the app in Firefox. Desktop Firefox
# does not support installing web apps like Chrome/Edge do, so this is the
# closest equivalent: a normal desktop icon that opens the app in its own
# window, free of the current tab clutter.
#
# Usage: powershell -File scripts/install-firefox.ps1
#        powershell -File scripts/install-firefox.ps1 -Url http://localhost:4173
param(
    [string]$Url = 'http://localhost:4173',
    [string]$Name = 'RSS Reader (Firefox)'
)

# Only allow absolute http(s) targets so a bad URL can't inject extra
# Firefox command-line arguments.
try {
    $uri = [Uri]$Url
    if (-not $uri.IsAbsoluteUri -or ($uri.Scheme -ne 'http' -and $uri.Scheme -ne 'https')) {
        throw "scheme $($uri.Scheme)"
    }
} catch {
    Write-Error "Invalid -Url '$Url' - must be an absolute http(s) URL."
    exit 1
}

$firefox = $null
$cmd = Get-Command firefox -ErrorAction SilentlyContinue
if ($cmd) {
    $firefox = $cmd.Source
} else {
    foreach ($path in @(
            'C:\Program Files\Mozilla Firefox\firefox.exe',
            'C:\Program Files (x86)\Mozilla Firefox\firefox.exe'
        )) {
        if (Test-Path -LiteralPath $path) {
            $firefox = $path
            break
        }
    }
}
if (-not $firefox) {
    Write-Error "Firefox not found. Install it from https://www.mozilla.org/firefox, or pass -Url to fix the URL."
    exit 1
}

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) "$Name.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $firefox
$shortcut.Arguments = "-new-window `"$($uri.AbsoluteUri)`""
$shortcut.IconLocation = "$firefox,0"
$shortcut.Description = 'Open RSS Reader in a dedicated Firefox window'
$shortcut.Save()

Write-Host "Created $shortcutPath"
