param(
  [string]$Profile = 'desktop'
)

$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$profileRoot = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"
$pluginsRoot = Join-Path $profileRoot 'local-plugins'
$target = Join-Path $pluginsRoot 'dsh-usage-statistics'
$patch = Join-Path $profileRoot 'cordis.patch.yml'

if (-not (Test-Path $profileRoot)) {
  throw "DSH profile not found: $profileRoot"
}

New-Item -ItemType Directory -Force -Path $pluginsRoot | Out-Null
if (Test-Path $target) {
  Remove-Item -Recurse -Force $target
}
Copy-Item -Recurse -Force $source $target

if (-not (Test-Path $patch)) {
  New-Item -ItemType File -Path $patch | Out-Null
}
$text = [System.IO.File]::ReadAllText($patch)
if ($text -notmatch 'usage-statistics') {
  $entry = @"

- insert:
    - id: usage-statistics
      name: './local-plugins/dsh-usage-compass/src/index.js'
      config:
        refreshSeconds: 5
        balanceSeconds: 30
        requestsLimit: 5000
"@
  [System.IO.File]::AppendAllText($patch, $entry, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Registered usage-statistics in $patch"
} else {
  Write-Host "usage-statistics is already registered in $patch"
}

Write-Host ""
Write-Host "Installed to $target"
Write-Host "Restart DeepSeek Harness, then open Settings -> 用量统计."
Write-Host "Balance keys: OPENCODE_GO_API_KEY / DEEPSEEK_API_KEY (DSH credential store or environment)."
