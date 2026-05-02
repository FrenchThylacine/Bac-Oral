# scripts/ocr_image.ps1
# Windows OCR via Windows.Media.Ocr — French language support
# Usage: powershell -File ocr_image.ps1 -Path "C:\path\to\image.jpg"
param(
    [Parameter(Mandatory=$true)]
    [string]$Path
)

try {
    # Load required assemblies
    Add-Type -AssemblyName System.Runtime.WindowsRuntime

    $null = [Windows.Storage.StorageFile,          Windows.Storage,   ContentType=WindowsRuntime]
    $null = [Windows.Media.Ocr.OcrEngine,          Windows.Foundation,ContentType=WindowsRuntime]
    $null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics, ContentType=WindowsRuntime]
    $null = [Windows.Globalization.Language,        Windows.Foundation,ContentType=WindowsRuntime]

    # Helper to await WinRT async operations
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

    function Await($WinRtTask, $ResultType) {
        $asTaskSpecialized = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTaskSpecialized.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        $netTask.Result
    }

    # Resolve absolute path
    $absolutePath = [System.IO.Path]::GetFullPath($Path)
    if (-not [System.IO.File]::Exists($absolutePath)) {
        Write-Error "File not found: $absolutePath"
        exit 1
    }

    # Load image file
    $file = Await `
        ([Windows.Storage.StorageFile]::GetFileFromPathAsync($absolutePath)) `
        ([Windows.Storage.StorageFile])

    $stream = Await `
        ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) `
        ([Windows.Storage.Streams.IRandomAccessStream])

    $decoder = Await `
        ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) `
        ([Windows.Graphics.Imaging.BitmapDecoder])

    $bitmap = Await `
        ($decoder.GetSoftwareBitmapAsync()) `
        ([Windows.Graphics.Imaging.SoftwareBitmap])

    # Try French first, fall back to user language
    $engine = $null
    try {
        $lang = [Windows.Globalization.Language]::new('fr')
        if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($lang)) {
            $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
        }
    } catch {}

    if (-not $engine) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    }

    if (-not $engine) {
        Write-Error "No OCR engine available"
        exit 1
    }

    # Run OCR
    $result = Await `
        ($engine.RecognizeAsync($bitmap)) `
        ([Windows.Media.Ocr.OcrResult])

    # Output each line
    foreach ($line in $result.Lines) {
        Write-Output $line.Text
    }

    exit 0

} catch {
    Write-Error "OCR Error: $_"
    exit 1
}
