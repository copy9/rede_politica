# Rede Politica - inicia o app e mantem tudo sincronizado com o GitHub.
# - Baixa as alteracoes a cada 30 segundos
# - Quando entra biblioteca nova, roda "npm install" e reinicia o app sozinho
# Feche esta janela para parar tudo.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$Host.UI.RawUI.WindowTitle = 'Rede Politica - sincronizando (nao feche)'
$hashFile = Join-Path $root '.deps-hash'

function Log($msg, $color = 'Gray') {
  Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) -ForegroundColor $color
}

function Get-DepsHash {
  if (Test-Path 'package-lock.json') { return (Get-FileHash 'package-lock.json').Hash }
  return ''
}

function Get-SavedHash {
  if (Test-Path $hashFile) { return ([string](Get-Content $hashFile -Raw)).Trim() }
  return ''
}

function Test-NeedsInstall {
  return (-not (Test-Path 'node_modules')) -or ((Get-DepsHash) -ne (Get-SavedHash))
}

function Install-Deps {
  $current = Get-DepsHash
  Log 'Instalando bibliotecas (npm install)... pode levar alguns minutos.' 'Yellow'
  npm install | Out-Host
  if ($LASTEXITCODE -eq 0) {
    Set-Content -Path $hashFile -Value $current
    Log 'Bibliotecas instaladas.' 'Green'
  } else {
    Log 'O npm install deu erro. Mande um print desta janela.' 'Red'
  }
}

function Start-App {
  Log 'Abrindo o app (janela do QR Code)...' 'Cyan'
  return Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'title Rede Politica - App (QR Code) && npx expo start' -WorkingDirectory $root -PassThru
}

function Stop-App($proc) {
  if ($proc -and -not $proc.HasExited) {
    Log 'Fechando o app para reiniciar...' 'Yellow'
    taskkill /PID $proc.Id /T /F | Out-Null
    Start-Sleep -Seconds 2
  }
}

Log 'Buscando atualizacoes do GitHub...' 'Cyan'
git pull --ff-only | Out-Host
if (Test-NeedsInstall) { Install-Deps }
$app = Start-App

while ($true) {
  Start-Sleep -Seconds 30
  $before = git rev-parse HEAD
  git pull --ff-only -q
  $after = git rev-parse HEAD

  if ($before -ne $after) {
    Log 'Alteracoes novas baixadas.' 'Green'
    git --no-pager log --oneline "$before..$after" | Out-Host
    $needsRestart = $false
    if (Test-NeedsInstall) {
      Stop-App $app
      Install-Deps
      $needsRestart = $true
    }
    if ($needsRestart -or $app.HasExited) {
      $app = Start-App
      Log 'App reiniciado. No celular, abra o Expo Go e escaneie o QR Code de novo se precisar.' 'Green'
    } else {
      Log 'O app no celular recarrega sozinho.' 'Green'
    }
  } elseif ($app.HasExited) {
    Log 'A janela do app foi fechada. Abrindo de novo...' 'Yellow'
    $app = Start-App
  }
}
