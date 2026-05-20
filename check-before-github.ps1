# Run:  cd C:\CODE\reachresolve
#       .\check-before-github.ps1
$ErrorActionPreference = "Continue"
$fail = 0

function Ok($msg)   { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow; $script:fail++ }
function Bad($msg)  { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:fail++ }

Write-Host "`n=== 1. Project folder ===" -ForegroundColor Cyan
if (-not (Test-Path "package.json")) { Bad "Not in project root (no package.json)"; exit 1 }
Ok "In project: $(Get-Location)"

Write-Host "`n=== 2. Git ===" -ForegroundColor Cyan
if (git rev-parse --is-inside-work-tree 2>$null) { Ok "Git repo initialized" } else { Bad "Not a git repo — run: git init" }

$remote = @(git remote -v 2>$null)
if ($remote.Count -gt 0) { Ok ("Remote configured:`n" + ($remote -join "`n")) } else { Warn "No GitHub remote — commits stay local until you add origin and push" }

$branch = git branch --show-current 2>$null
Ok "Branch: $(if ($branch) { $branch } else { '(none)' })"

$name  = git config user.name
$email = git config user.email
if ($name -and $email) { Ok "Git author: $name <$email>" } else { Warn "Set git user: git config user.name / user.email" }

$commitCount = (git rev-list --count HEAD 2>$null)
if ($commitCount -and [int]$commitCount -gt 0) { Ok "Has $commitCount commit(s)" } else { Warn "No commits yet — make first commit before push" }

Write-Host "`n=== 3. Secrets ===" -ForegroundColor Cyan
if (Test-Path ".env") {
  $ignoreLine = git check-ignore -v .env 2>$null
  if ($LASTEXITCODE -eq 0 -and $ignoreLine) { Ok ".env exists and is gitignored ($ignoreLine)" }
  else { Bad ".env is NOT ignored — fix .gitignore before committing!" }

  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
      $k = $matches[1]
      $v = ($_.Split('=', 2)[1]).Trim().Trim('"')
      if ([string]::IsNullOrWhiteSpace($v) -or $v -match 'YOUR_|MY_') { Warn "$k is empty or placeholder" }
      else { Ok "$k is set" }
    }
  }
} else {
  Warn ".env missing — copy from .env.example for local dev"
}

$trackedEnv = git ls-files --cached .env 2>$null
if ($trackedEnv) { Bad ".env is tracked by git — run: git rm --cached .env" } else { Ok ".env not in git index" }

Write-Host "`n=== 4. GitHub CLI ===" -ForegroundColor Cyan
if (Get-Command gh -ErrorAction SilentlyContinue) {
  gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "GitHub CLI logged in" } else { Warn "Run: gh auth login" }

  gh repo view 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "This folder is linked to a GitHub repo (remote + gh repo view)" }
  else { Warn "Not linked to GitHub yet (no remote or repo not created)" }
} else {
  Warn "gh not installed (optional)"
}

Write-Host "`n=== 5. Build ===" -ForegroundColor Cyan
npm run lint 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Ok "TypeScript (lint) passed" } else { Bad "lint failed" }
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Ok "Production build passed" } else { Bad "build failed" }

Write-Host "`n=== 6. Site name (Apex) ===" -ForegroundColor Cyan
if (Select-String -Path "index.html" -Pattern "Apex" -Quiet) { Ok "index.html uses Apex" } else { Warn "index.html may not say Apex" }
if (Select-String -Path "src\App.tsx" -Pattern "Resolvia" -Quiet) { Warn "src\App.tsx still contains Resolvia" } else { Ok "App.tsx brand updated" }

Write-Host "`n=== 7. Git status ===" -ForegroundColor Cyan
git status -sb

Write-Host "`n=== Result ===" -ForegroundColor Cyan
if ($fail -eq 0) {
  Write-Host "All checks passed (or only optional warnings)." -ForegroundColor Green
} else {
  Write-Host "$fail issue(s) to review before first push." -ForegroundColor Yellow
}
