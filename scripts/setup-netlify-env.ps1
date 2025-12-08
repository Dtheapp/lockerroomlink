# =============================================================================
# NETLIFY ENVIRONMENT VARIABLES SETUP SCRIPT
# This script sets up the required environment variables for the OSYS Credits System
# =============================================================================
# 
# BEFORE RUNNING:
# 1. Install Netlify CLI: npm install -g netlify-cli
# 2. Login to Netlify: netlify login
# 3. Link your site: netlify link (if not already linked)
#
# REQUIRED: You need to fill in your actual values below before running!
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OSYS Credits System - Netlify Env Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Netlify CLI is installed
$netlifyInstalled = Get-Command netlify -ErrorAction SilentlyContinue
if (-not $netlifyInstalled) {
    Write-Host "ERROR: Netlify CLI not installed. Run: npm install -g netlify-cli" -ForegroundColor Red
    exit 1
}

# =============================================================================
# CONFIGURATION - FILL IN YOUR VALUES HERE
# =============================================================================

# PayPal Configuration
# Get these from: https://developer.paypal.com/dashboard/applications
$PAYPAL_CLIENT_ID = "YOUR_PAYPAL_CLIENT_ID_HERE"
$PAYPAL_CLIENT_SECRET = "YOUR_PAYPAL_CLIENT_SECRET_HERE"
$PAYPAL_MODE = "sandbox"  # Change to "live" for production

# Firebase Configuration
$FIREBASE_PROJECT_ID = "gridironhub-3131"

# Firebase Service Account JSON
# Get this from: Firebase Console > Project Settings > Service Accounts > Generate New Private Key
# IMPORTANT: Paste the ENTIRE JSON content between the @" and "@ below
$FIREBASE_SERVICE_ACCOUNT = @"
{
  "type": "service_account",
  "project_id": "gridironhub-3131",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@gridironhub-3131.iam.gserviceaccount.com",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40gridironhub-3131.iam.gserviceaccount.com"
}
"@

# =============================================================================
# VALIDATION - Check if values have been filled in
# =============================================================================

$hasErrors = $false

if ($PAYPAL_CLIENT_ID -eq "YOUR_PAYPAL_CLIENT_ID_HERE") {
    Write-Host "ERROR: Please fill in PAYPAL_CLIENT_ID" -ForegroundColor Red
    $hasErrors = $true
}

if ($PAYPAL_CLIENT_SECRET -eq "YOUR_PAYPAL_CLIENT_SECRET_HERE") {
    Write-Host "ERROR: Please fill in PAYPAL_CLIENT_SECRET" -ForegroundColor Red
    $hasErrors = $true
}

if ($FIREBASE_SERVICE_ACCOUNT -match "YOUR_PRIVATE_KEY_HERE") {
    Write-Host "ERROR: Please fill in FIREBASE_SERVICE_ACCOUNT with your actual service account JSON" -ForegroundColor Red
    $hasErrors = $true
}

if ($hasErrors) {
    Write-Host ""
    Write-Host "Please edit this script and fill in the required values before running." -ForegroundColor Yellow
    Write-Host "Script location: scripts/setup-netlify-env.ps1" -ForegroundColor Yellow
    exit 1
}

# =============================================================================
# CONFIRMATION
# =============================================================================

Write-Host ""
Write-Host "The following environment variables will be set:" -ForegroundColor Yellow
Write-Host "  - PAYPAL_CLIENT_ID: $($PAYPAL_CLIENT_ID.Substring(0, [Math]::Min(10, $PAYPAL_CLIENT_ID.Length)))..." -ForegroundColor Gray
Write-Host "  - PAYPAL_CLIENT_SECRET: ********" -ForegroundColor Gray
Write-Host "  - PAYPAL_MODE: $PAYPAL_MODE" -ForegroundColor Gray
Write-Host "  - FIREBASE_PROJECT_ID: $FIREBASE_PROJECT_ID" -ForegroundColor Gray
Write-Host "  - FIREBASE_SERVICE_ACCOUNT: [JSON - $(($FIREBASE_SERVICE_ACCOUNT).Length) chars]" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "Do you want to proceed? (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# =============================================================================
# SET ENVIRONMENT VARIABLES
# =============================================================================

Write-Host ""
Write-Host "Setting environment variables..." -ForegroundColor Cyan

try {
    # Set PayPal variables
    Write-Host "Setting PAYPAL_CLIENT_ID..." -ForegroundColor Gray
    netlify env:set PAYPAL_CLIENT_ID "$PAYPAL_CLIENT_ID" --context production
    
    Write-Host "Setting PAYPAL_CLIENT_SECRET..." -ForegroundColor Gray
    netlify env:set PAYPAL_CLIENT_SECRET "$PAYPAL_CLIENT_SECRET" --context production
    
    Write-Host "Setting PAYPAL_MODE..." -ForegroundColor Gray
    netlify env:set PAYPAL_MODE "$PAYPAL_MODE" --context production
    
    # Set Firebase variables
    Write-Host "Setting FIREBASE_PROJECT_ID..." -ForegroundColor Gray
    netlify env:set FIREBASE_PROJECT_ID "$FIREBASE_PROJECT_ID" --context production
    
    Write-Host "Setting FIREBASE_SERVICE_ACCOUNT..." -ForegroundColor Gray
    netlify env:set FIREBASE_SERVICE_ACCOUNT "$FIREBASE_SERVICE_ACCOUNT" --context production
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! All environment variables set." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can verify by running: netlify env:list" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Deploy to Netlify: netlify deploy --prod" -ForegroundColor Gray
    Write-Host "2. Test credit purchase flow in sandbox mode" -ForegroundColor Gray
    Write-Host "3. When ready for production, change PAYPAL_MODE to 'live'" -ForegroundColor Gray
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to set environment variables" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
