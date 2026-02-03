# Native Messaging Host Installation Script for Windows
#
# This script installs the Agent Browser Native Messaging Host
# for Chrome/Chromium-based browsers on Windows.
#
# Usage:
#   .\install-windows.ps1 [-ExtensionId <id>]
#
# Run as Administrator if you want system-wide installation.

param(
    [Parameter(Mandatory=$false)]
    [string]$ExtensionId = "EXTENSION_ID_PLACEHOLDER"
)

# Colors for output
function Write-Info { Write-Host "[INFO] " -ForegroundColor Green -NoNewline; Write-Host $args }
function Write-Warn { Write-Host "[WARN] " -ForegroundColor Yellow -NoNewline; Write-Host $args }
function Write-Err { Write-Host "[ERROR] " -ForegroundColor Red -NoNewline; Write-Host $args }

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HostPath = Join-Path $ScriptDir "host.js"

# Native Messaging Host name
$HostName = "com.agent_browser.host"

# Registry paths for different browsers
$RegistryPaths = @{
    "Google Chrome" = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
    "Google Chrome Beta" = "HKCU:\Software\Google\Chrome Beta\NativeMessagingHosts\$HostName"
    "Chromium" = "HKCU:\Software\Chromium\NativeMessagingHosts\$HostName"
    "Microsoft Edge" = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
    "Brave Browser" = "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$HostName"
}

# Check if Node.js is available
$NodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodePath) {
    Write-Err "Node.js is not installed. Please install Node.js first."
    Write-Err "Download from: https://nodejs.org/"
    exit 1
}

Write-Info "Found Node.js at: $($NodePath.Source)"

# Check if host.js exists
if (-not (Test-Path $HostPath)) {
    Write-Err "host.js not found at: $HostPath"
    exit 1
}

# Create wrapper batch file for Windows
$BatchPath = Join-Path $ScriptDir "host.bat"
$BatchContent = @"
@echo off
node "$HostPath" %*
"@
Set-Content -Path $BatchPath -Value $BatchContent -Encoding ASCII
Write-Info "Created wrapper script: $BatchPath"

# Create manifest directory
$ManifestDir = Join-Path $ScriptDir "manifests"
if (-not (Test-Path $ManifestDir)) {
    New-Item -ItemType Directory -Path $ManifestDir | Out-Null
}

# Create manifest file
$ManifestPath = Join-Path $ManifestDir "$HostName.json"
$Manifest = @{
    name = $HostName
    description = "Agent Browser Native Messaging Host - Bridges Chrome extension with MCP Server"
    path = $BatchPath
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
}
$Manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $ManifestPath -Encoding UTF8
Write-Info "Created manifest: $ManifestPath"

# Install for each browser
$InstalledCount = 0

foreach ($Browser in $RegistryPaths.Keys) {
    $RegPath = $RegistryPaths[$Browser]
    $ParentPath = Split-Path -Parent $RegPath

    # Check if parent registry path exists (indicates browser is installed)
    $BrowserRegPath = "HKCU:\Software\" + ($RegPath -replace "HKCU:\\Software\\", "" -replace "\\NativeMessagingHosts\\.*", "")

    try {
        # Create the registry key and set the manifest path
        if (-not (Test-Path (Split-Path -Parent $RegPath))) {
            New-Item -Path (Split-Path -Parent $RegPath) -Force | Out-Null
        }
        New-Item -Path $RegPath -Force | Out-Null
        Set-ItemProperty -Path $RegPath -Name "(Default)" -Value $ManifestPath

        Write-Info "Installed for $Browser"
        $InstalledCount++
    }
    catch {
        # Silently skip browsers that aren't installed
    }
}

if ($InstalledCount -eq 0) {
    Write-Warn "No supported browsers found in registry."
    Write-Warn "You may need to manually add the registry key."
}

Write-Host ""
Write-Info "Installation complete!"
Write-Host ""

if ($ExtensionId -eq "EXTENSION_ID_PLACEHOLDER") {
    Write-Warn "Extension ID not provided. You need to update the manifest with your actual extension ID."
    Write-Host ""
    Write-Host "To get your extension ID:"
    Write-Host "  1. Open chrome://extensions in your browser"
    Write-Host "  2. Enable 'Developer mode'"
    Write-Host "  3. Find your extension and copy the ID"
    Write-Host ""
    Write-Host "Then run this script again with the extension ID:"
    Write-Host "  .\install-windows.ps1 -ExtensionId YOUR_EXTENSION_ID"
}

Write-Host ""
Write-Host "Files installed:"
Write-Host "  Host script: $HostPath"
Write-Host "  Wrapper: $BatchPath"
Write-Host "  Manifest: $ManifestPath"
Write-Host ""
Write-Host "Registry keys added to HKCU:\Software\<Browser>\NativeMessagingHosts\$HostName"
Write-Host ""
Write-Host "To verify installation, restart your browser and check the extension."
