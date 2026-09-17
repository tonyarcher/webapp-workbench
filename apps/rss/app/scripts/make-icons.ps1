# Regenerates the PWA icons public/icon-192.png and public/icon-512.png.
# The glyph geometry and colors mirror public/favicon.svg (RSS arcs + dot on
# an accent-blue rounded square) - edit the hardcoded values here if the
# favicon design changes. Run with: powershell -File scripts/make-icons.ps1
param([int[]]$Sizes = @(192, 512))

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$bg = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)  # --accent

function Draw-RssIcon {
    param([int]$Size, [string]$OutPath)

    $bmp = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # rounded-square background (padded ~4% so the maskable safe zone is clear)
    $m = $Size * 0.04
    $r = $Size * 0.22
    $rect = [System.Drawing.RectangleF]::new($m, $m, $Size - 2 * $m, $Size - 2 * $m)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $d = 2 * $r
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath([System.Drawing.SolidBrush]::new($bg), $path)

    # RSS glyph, normalized from the 24x24 viewBox of public/favicon.svg:
    # dot at (6,18) r=2; outer arc centered (4,20) r=16; inner arc centered (4,11) r=9
    $penWidth = [Math]::Max(1, $Size * 2 / 24)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, $penWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $dotR = $Size * 2 / 24
    $g.FillEllipse(
        [System.Drawing.Brushes]::White,
        $Size * 6 / 24 - $dotR,
        $Size * 18 / 24 - $dotR,
        2 * $dotR,
        2 * $dotR
    )

    # arcs open toward the bottom-left (bowl shape): from 12 o'clock to 3 o'clock
    $g.DrawArc($pen, -$Size * 12 / 24, $Size * 4 / 24, $Size * 32 / 24, $Size * 32 / 24, 270, 90)
    $g.DrawArc($pen, -$Size * 5 / 24, $Size * 2 / 24, $Size * 18 / 24, $Size * 18 / 24, 270, 90)

    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

foreach ($size in $Sizes) {
    $out = Join-Path $outDir "icon-$size.png"
    Draw-RssIcon -Size $size -OutPath $out
    Write-Host "wrote $out"
}
