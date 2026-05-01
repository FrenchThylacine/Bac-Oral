$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$listener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
  if ($process -and $process.CommandLine -like "*$root*") {
    Stop-Process -Id $listener.OwningProcess -Force
    Start-Sleep -Milliseconds 600
  }
}

node server.mjs
