param (
    [string]$action
)

# Function to enable SeShutdownPrivilege and sleep
function Suspend-System {
    $definition = @"
    using System;
    using System.Runtime.InteropServices;
    using System.Diagnostics;

    public class PowerHelper {
        [DllImport("advapi32.dll", ExactSpelling = true, SetLastError = true)]
        internal static extern bool AdjustTokenPrivileges(IntPtr htok, bool disall, ref TokPriv1Luid newst, int len, IntPtr prev, IntPtr relen);

        [DllImport("advapi32.dll", ExactSpelling = true, SetLastError = true)]
        internal static extern bool OpenProcessToken(IntPtr h, int acc, ref IntPtr phtok);

        [DllImport("advapi32.dll", ExactSpelling = true, SetLastError = true)]
        internal static extern bool LookupPrivilegeValue(string host, string name, ref long pluid);

        [DllImport("powrprof.dll", SetLastError = true)]
        internal static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);

        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        internal struct TokPriv1Luid {
            public int Count;
            public long Luid;
            public int Attr;
        }

        public static bool Sleep() {
            try {
                IntPtr htok = IntPtr.Zero;
                if (OpenProcessToken(Process.GetCurrentProcess().Handle, 0x0020 | 0x0008, ref htok)) {
                    TokPriv1Luid tp;
                    tp.Count = 1;
                    tp.Luid = 0;
                    tp.Attr = 2; // SE_PRIVILEGE_ENABLED
                    if (LookupPrivilegeValue(null, "SeShutdownPrivilege", ref tp.Luid)) {
                        AdjustTokenPrivileges(htok, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
                    }
                }
            } catch {}
            return SetSuspendState(false, false, false);
        }
    }
"@
    Add-Type -TypeDefinition $definition
    [PowerHelper]::Sleep()
}

# Function to get the hotspot manager safely
function Get-HotspotManager {
    $p = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType=WindowsRuntime]::GetInternetConnectionProfile()
    if (-not $p) {
        $profiles = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType=WindowsRuntime]::GetConnectionProfiles()
        if ($profiles.Count -gt 0) {
            $p = $profiles[0]
        }
    }
    if ($p) {
        return [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType=WindowsRuntime]::CreateFromConnectionProfile($p)
    }
    return $null
}

switch ($action) {
    "sleep" {
        Suspend-System
    }
    "wifi_on" {
        Enable-NetAdapter -Name 'Wi-Fi' -Confirm:$false
    }
    "wifi_off" {
        Disable-NetAdapter -Name 'Wi-Fi' -Confirm:$false
    }
    "hotspot_on" {
        $mgr = Get-HotspotManager
        if ($mgr) {
            $mgr.StartTetheringAsync() | Out-Null
            Start-Sleep -Seconds 1
        }
    }
    "hotspot_off" {
        $mgr = Get-HotspotManager
        if ($mgr) {
            $mgr.StopTetheringAsync() | Out-Null
            Start-Sleep -Seconds 1
        }
    }
    "status" {
        $wifi = (Get-NetAdapter -Name 'Wi-Fi' -ErrorAction SilentlyContinue).Status
        if (-not $wifi) { $wifi = 'Disabled' }
        
        $hotspot = 'Off'
        $mgr = Get-HotspotManager
        if ($mgr) {
            $hotspot = $mgr.TetheringOperationalState.ToString()
        }
        Write-Host "$wifi,$hotspot"
    }
}
