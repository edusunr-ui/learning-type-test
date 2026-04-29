param(
  [Parameter(Mandatory = $true)][string]$Name,
  [Parameter(Mandatory = $true)][string]$School,
  [Parameter(Mandatory = $true)][string]$Grade,
  [Parameter(Mandatory = $true)][ValidateSet("elementary", "middle", "high")][string]$Level,
  [Parameter(Mandatory = $true)][ValidateSet("ACE", "ACF", "BCE", "BCF", "ADE", "ADF", "BDE", "BDF")][string]$ResultCode,
  [Parameter(Mandatory = $true)][int]$PositiveScore,
  [Parameter(Mandatory = $true)][int]$NegativeScore,
  [Parameter(Mandatory = $true)][int]$InternalScore,
  [Parameter(Mandatory = $true)][int]$ExternalScore,
  [Parameter(Mandatory = $true)][int]$LogicalScore,
  [Parameter(Mandatory = $true)][int]$IntuitiveScore,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$AttemptId = "",
  [string]$CreatedAt = "",
  [string]$RootPath = ""
)

$ErrorActionPreference = "Stop"

function Decode-UnicodeEscaped {
  param([Parameter(Mandatory = $true)][string]$Value)
  return [regex]::Unescape($Value)
}

if (-not $RootPath) {
  $RootPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$edgeCandidates = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

$browserPath = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browserPath) {
  throw (Decode-UnicodeEscaped "Edge \uB610\uB294 Chrome \uC2E4\uD589 \uD30C\uC77C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.")
}

$resultTypeMap = @{
  "ACE" = (Decode-UnicodeEscaped "\uD30C\uC2A4\uCE7C\uD615")
  "ACF" = (Decode-UnicodeEscaped "\uC544\uC778\uC288\uD0C0\uC778\uD615")
  "BCE" = (Decode-UnicodeEscaped "\uB7EC\uC140\uD615")
  "BCF" = (Decode-UnicodeEscaped "\uAC00\uC6B0\uC2A4\uD615")
  "ADE" = (Decode-UnicodeEscaped "\uB274\uD134\uD615")
  "ADF" = (Decode-UnicodeEscaped "\uD53C\uD0C0\uACE0\uB77C\uC2A4\uD615")
  "BDE" = (Decode-UnicodeEscaped "\uB370\uCE74\uB974\uD2B8\uD615")
  "BDF" = (Decode-UnicodeEscaped "\uCE78\uD2B8\uD615")
}

$levelLabelMap = @{
  "elementary" = (Decode-UnicodeEscaped "\uCD08\uB4F1\uBD80")
  "middle" = (Decode-UnicodeEscaped "\uC911\uB4F1\uBD80")
  "high" = (Decode-UnicodeEscaped "\uACE0\uB4F1\uBD80")
}

$maxScoreMap = @{
  "elementary" = 35
  "middle" = 50
  "high" = 50
}

$positiveLabel = Decode-UnicodeEscaped "\uAE0D\uC815\uD615"
$negativeLabel = Decode-UnicodeEscaped "\uBD80\uC815\uD615"
$internalLabel = Decode-UnicodeEscaped "\uB0B4\uC801\uB3D9\uAE30\uD615"
$externalLabel = Decode-UnicodeEscaped "\uC678\uC801\uB3D9\uAE30\uD615"
$logicalLabel = Decode-UnicodeEscaped "\uB17C\uB9AC\uC801 \uC811\uADFC\uD615"
$intuitiveLabel = Decode-UnicodeEscaped "\uC9C1\uAD00\uC801 \uC811\uADFC\uD615"

$pairs = @(
  @{
    label = Decode-UnicodeEscaped "\uAE0D\uC815\uD615 vs \uBD80\uC815\uD615"
    winner = if ($PositiveScore -ge $NegativeScore) { $positiveLabel } else { $negativeLabel }
  },
  @{
    label = Decode-UnicodeEscaped "\uB0B4\uC801\uB3D9\uAE30\uD615 vs \uC678\uC801\uB3D9\uAE30\uD615"
    winner = if ($InternalScore -ge $ExternalScore) { $internalLabel } else { $externalLabel }
  },
  @{
    label = Decode-UnicodeEscaped "\uB17C\uB9AC\uC801 \uC811\uADFC\uD615 vs \uC9C1\uAD00\uC801 \uC811\uADFC\uD615"
    winner = if ($LogicalScore -ge $IntuitiveScore) { $logicalLabel } else { $intuitiveLabel }
  }
)

if (-not $AttemptId) {
  $AttemptId = "teacher-export-" + [guid]::NewGuid().ToString()
}

if (-not $CreatedAt) {
  $CreatedAt = [DateTime]::UtcNow.ToString("o")
}

$payload = @{
  attemptId = $AttemptId
  createdAt = $CreatedAt
  level = $Level
  levelLabel = $levelLabelMap[$Level]
  maxScore = $maxScoreMap[$Level]
  info = @{
    school = $School
    grade = $Grade
    name = $Name
  }
  result = @{
    code = $ResultCode
    type = @{
      name = $resultTypeMap[$ResultCode]
    }
    scores = @(
      @{ key = "positive"; label = $positiveLabel; score = $PositiveScore }
      @{ key = "negative"; label = $negativeLabel; score = $NegativeScore }
      @{ key = "internal"; label = $internalLabel; score = $InternalScore }
      @{ key = "external"; label = $externalLabel; score = $ExternalScore }
      @{ key = "logical"; label = $logicalLabel; score = $LogicalScore }
      @{ key = "intuitive"; label = $intuitiveLabel; score = $IntuitiveScore }
    )
    pairs = $pairs
  }
}

$payloadJson = $payload | ConvertTo-Json -Depth 8 -Compress
$payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
$payloadBase64 = [Convert]::ToBase64String($payloadBytes)

$teacherHtmlPath = Join-Path $RootPath "docs\teacher-result.html"
if (-not (Test-Path $teacherHtmlPath)) {
  throw ((Decode-UnicodeEscaped "teacher-result.html \uD30C\uC77C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4:") + " $teacherHtmlPath")
}

$teacherFileUri = [System.Uri]::new($teacherHtmlPath)
$targetUrl = "$($teacherFileUri.AbsoluteUri)?payload=$([System.Uri]::EscapeDataString($payloadBase64))"

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory -and -not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$arguments = @(
  "--headless=new",
  "--disable-gpu",
  "--allow-file-access-from-files",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=7000",
  "--print-to-pdf=$OutputPath",
  $targetUrl
)

$process = Start-Process -FilePath $browserPath -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
if ($process.ExitCode -ne 0) {
  throw "브라우저 PDF 생성이 실패했습니다. ExitCode=$($process.ExitCode)"
}

if (-not (Test-Path $OutputPath)) {
  throw "PDF 출력 파일이 생성되지 않았습니다: $OutputPath"
}

Write-Output $OutputPath
