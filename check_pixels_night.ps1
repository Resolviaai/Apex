[Reflection.Assembly]::LoadWithPartialName('System.Drawing')
$bmp = New-Object System.Drawing.Bitmap('c:\CODE\reachresolve\public\night.png')
Write-Host "Width: $($bmp.Width), Height: $($bmp.Height)"
$l = $bmp.GetPixel(100, 100)
Write-Host "Left pixel: R=$($l.R), G=$($l.G), B=$($l.B)"
$r = $bmp.GetPixel(600, 100)
Write-Host "Right pixel: R=$($r.R), G=$($r.G), B=$($r.B)"
$bmp.Dispose()
