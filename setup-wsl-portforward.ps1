<#
.SYNOPSIS
    Sets up Windows Firewall and Port Forwarding into WSL 2 for SSH.
.DESCRIPTION
    Self-elevates to Administrator, detects the current WSL 2 IP,
    creates/updates Windows Firewall rules, and configures netsh portproxy.
#>

# 1. Auto-elevate script to Administrator if not already elevated
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Elevating permissions to Administrator..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList ("-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"") -Verb RunAs
    exit
}

$ErrorActionPreference = "Stop"

$sshPort = 48222
$ruleName = "WSL-SSH-$sshPort"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   WSL 2 SSH Port Forwarding & Firewall Setup     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 2. Check WSL Status and fetch WSL IP
Write-Host "`n[1/3] Detecting WSL IP address..." -ForegroundColor Green
try {
    $rawIp = wsl hostname -I
    if ([string]::IsNullOrWhiteSpace($rawIp)) {
        throw "WSL returned an empty IP. Is your WSL distribution running?"
    }
    $wslIp = $rawIp.Trim().Split(" ")[0]
    Write-Host "  -> Found WSL IP: $wslIp" -ForegroundColor Gray
} catch {
    Write-Host "  [Error] Failed to detect WSL IP: $_" -ForegroundColor Red
    Write-Host "  Please start WSL (type 'wsl' in a terminal) and try again." -ForegroundColor Yellow
    Read-Host "`nPress Enter to exit..."
    exit 1
}

# 3. Configure Windows Firewall
Write-Host "`n[2/3] Configuring Windows Firewall for Port $sshPort..." -ForegroundColor Green
try {
    # Remove old rule if it already exists to avoid duplicates
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($existingRule) {
        Remove-NetFirewallRule -DisplayName $ruleName
        Write-Host "  -> Removed existing firewall rule: $ruleName" -ForegroundColor Gray
    }

    New-NetFirewallRule -DisplayName $ruleName `
                        -Direction Inbound `
                        -LocalPort $sshPort `
                        -Protocol TCP `
                        -Action Allow | Out-Null
    Write-Host "  -> Inbound Firewall rule '$ruleName' created successfully." -ForegroundColor Gray
} catch {
    Write-Host "  [Error] Failed to create firewall rule: $_" -ForegroundColor Red
    Read-Host "`nPress Enter to exit..."
    exit 1
}

# 4. Configure netsh portproxy
Write-Host "`n[3/3] Setting up Port Forwarding (0.0.0.0:$sshPort -> $wslIp`:$sshPort)..." -ForegroundColor Green
try {
    # Remove any existing portproxy rule for this port
    netsh interface portproxy delete v4tov4 listenport=$sshPort listenaddress=0.0.0.0 2>$null | Out-Null

    # Add the new portproxy rule
    netsh interface portproxy add v4tov4 listenport=$sshPort listenaddress=0.0.0.0 connectport=$sshPort connectaddress=$wslIp
    Write-Host "  -> Port forwarding rule added successfully!" -ForegroundColor Gray
} catch {
    Write-Host "  [Error] Failed to set up portproxy: $_" -ForegroundColor Red
    Read-Host "`nPress Enter to exit..."
    exit 1
}

# 5. Display Current Portproxy Table
Write-Host "`n================ Current Port Forwarding Table ================" -ForegroundColor Cyan
netsh interface portproxy show v4tov4
Write-Host "==============================================================" -ForegroundColor Cyan

Write-Host "`n[SUCCESS] Setup complete! Outside devices can now reach WSL SSH on port $sshPort." -ForegroundColor Green
Write-Host "Tip: When Windows reboots, WSL gets a fresh IP. Just re-run this script whenever you restart." -ForegroundColor Yellow

Read-Host "`nPress Enter to close this window..."
