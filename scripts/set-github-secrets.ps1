# PowerShell Script to Set GitHub Secrets
# Run this script from the repository root
# Prerequisites: GitHub CLI (gh) installed and authenticated

param(
    [string]$EnvFile = ".env",
    [switch]$FromEnv
)

# Color output
$green = @{ ForegroundColor = "Green" }
$red = @{ ForegroundColor = "Red" }
$yellow = @{ ForegroundColor = "Yellow" }
$cyan = @{ ForegroundColor = "Cyan" }

Write-Host "======================================" @cyan
Write-Host "GitHub Secrets Configuration" @cyan
Write-Host "======================================" @cyan

# Check if gh CLI is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: GitHub CLI is not installed." @red
    Write-Host "   Install from: https://cli.github.com/" @yellow
    exit 1
}

# Check authentication
try {
    $auth = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Not authenticated with GitHub." @red
        Write-Host "   Run: gh auth login" @yellow
        exit 1
    }
} catch {
    Write-Host "ERROR: Failed to check GitHub authentication." @red
    exit 1
}

Write-Host "`nOK: GitHub CLI authenticated" @green

function Is-PlaceholderValue {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $true }
    $trimmed = $Value.Trim()
    return ($trimmed -match '^your_') -or ($trimmed -match '^replace_') -or ($trimmed -match '^example')
}

function Set-SecretValue {
    param(
        [string]$Name,
        [string]$Value
    )

    if (Is-PlaceholderValue -Value $Value) {
        Write-Host "Skipping $Name (empty or placeholder value)." @yellow
        return
    }

    Write-Host "Setting $Name..." -NoNewline
    $Value | gh secret set $Name 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" @green
    } else {
        Write-Host " FAILED" @red
        throw "Failed to set $Name"
    }
}

if ($FromEnv) {
    if (-not (Test-Path -Path $EnvFile)) {
        Write-Host "ERROR: Env file not found: $EnvFile" @red
        exit 1
    }

    Write-Host "`nLoading secrets from $EnvFile" @cyan

    $envMap = @{}
    Get-Content -Path $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) { return }
        if ($line -notmatch "=") { return }
        $parts = $line -split "=", 2
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if (-not [string]::IsNullOrWhiteSpace($key)) {
            $envMap[$key] = $value
        }
    }

    if ($envMap.Count -eq 0) {
        Write-Host "ERROR: No key/value pairs found in $EnvFile" @red
        exit 1
    }

    Write-Host "`nSetting GitHub secrets from env file..." @cyan

    try {
        foreach ($item in $envMap.GetEnumerator()) {
            Set-SecretValue -Name $item.Key -Value $item.Value
        }

        Write-Host "`n=====================================" @green
        Write-Host "All eligible secrets configured." @green
        Write-Host "=====================================" @green
        gh secret list
        exit 0
    } catch {
        Write-Host "`nERROR: Failed while setting env-based secrets." @red
        Write-Host $_.Exception.Message @red
        exit 1
    }
}

# Prompt for secrets
Write-Host "`n" @cyan
Write-Host "Enter your AWS credentials (these will be set as GitHub secrets):" @cyan
Write-Host "---" @cyan

$AWS_ACCESS_KEY = Read-Host "AWS_ACCESS_KEY_ID"
if ([string]::IsNullOrWhiteSpace($AWS_ACCESS_KEY)) {
    Write-Host "ERROR: AWS_ACCESS_KEY_ID cannot be empty." @red
    exit 1
}

$AWS_SECRET_KEY = Read-Host "AWS_SECRET_ACCESS_KEY" -AsSecureString
$AWS_SECRET_KEY_PLAIN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($AWS_SECRET_KEY))

if ([string]::IsNullOrWhiteSpace($AWS_SECRET_KEY_PLAIN)) {
    Write-Host "ERROR: AWS_SECRET_ACCESS_KEY cannot be empty." @red
    exit 1
}

Write-Host "`nDo you want to set SLACK_WEBHOOK_URL? (y/n)" @cyan
$slack_choice = Read-Host
$SLACK_WEBHOOK = ""

if ($slack_choice -eq "y" -or $slack_choice -eq "Y") {
    $SLACK_WEBHOOK = Read-Host "SLACK_WEBHOOK_URL"
}

# Set secrets using GitHub CLI
Write-Host "`n" @cyan
Write-Host "Setting GitHub secrets..." @cyan
Write-Host "---" @cyan

try {
    # AWS_ACCESS_KEY_ID
    Set-SecretValue -Name "AWS_ACCESS_KEY_ID" -Value $AWS_ACCESS_KEY

    # AWS_SECRET_ACCESS_KEY
    Set-SecretValue -Name "AWS_SECRET_ACCESS_KEY" -Value $AWS_SECRET_KEY_PLAIN

    # AWS_REGION
    $AWS_REGION = Read-Host "AWS_REGION (default: ap-south-1)"
    if ([string]::IsNullOrWhiteSpace($AWS_REGION)) {
        $AWS_REGION = "ap-south-1"
    }
    Set-SecretValue -Name "AWS_REGION" -Value $AWS_REGION

    # SLACK_WEBHOOK_URL (optional)
    if (-not [string]::IsNullOrWhiteSpace($SLACK_WEBHOOK)) {
        Set-SecretValue -Name "SLACK_WEBHOOK_URL" -Value $SLACK_WEBHOOK
    }

    Write-Host "`n" @green
    Write-Host "=====================================" @green
    Write-Host "All secrets configured successfully." @green
    Write-Host "=====================================" @green

    Write-Host "`nRunning verification..." @cyan
    gh secret list

    Write-Host "`n" @green
    Write-Host "Next steps:" @cyan
    Write-Host "1. Update .env file with your AWS credentials" @yellow
    Write-Host "2. Update terraform/terraform.tfvars with your AWS credentials" @yellow
    Write-Host "3. Push to main branch to trigger CI/CD pipeline" @yellow
    Write-Host "`nDocumentation: .github/CI_CD_SETUP.md" @cyan

} catch {
    Write-Host "`nERROR: Failed setting secrets." @red
    Write-Host $_.Exception.Message @red
    exit 1
}
