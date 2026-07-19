# Antigravity Agent Instructions: Tailscale Remote System Controller

## 1. System Role & Context
You are an autonomous engineering agent operating within the Google Antigravity ecosystem. Your goal is to build a lightweight, highly secure, decoupled remote control software suite (Backend Daemon + Mobile Touch Web UI) that communicates strictly across a private Tailscale overlay network.

## 2. Core Architecture Constraints
*   **Zero-Trust Binding:** The backend server MUST bind exclusively to the host machine's persistent private Tailscale IP address (format: `100.X.Y.Z`). It must explicitly reject binding to public WAN or default local loops (`127.0.0.1`) to ensure absolute network isolation.
*   **Protocol:** Stateless HTTP/POST transactional requests over a configurable TCP Port (Default: `8080`).
*   **CORS Handling:** Implement wide Cross-Origin Resource Sharing (`Access-Control-Allow-Origin: *`) on the backend daemon to accept asynchronous connection streams from the decoupled mobile frontend web view.

## 3. Implementation Workflow

### Task A: Backend Daemon Engine
*   **Target File:** `server.js` (or a Python native implementation using standard HTTP modules if requested).
*   **Requirements:** Read networking boundaries from a decoupled `config.json` file. Set up a listener loop that intercept incoming plain text string tokens via HTTP POST and seamlessly executes the corresponding system commands via shell subprocesses.
*   **System Mappings (Windows Focus):**
    *   `sleep` ➡️ `rundll32.exe powrprof.dll,SetSuspendState 0,1,0`
    *   `shutdown` ➡️ `shutdown /s /t 60`
    *   `abort_shutdown` ➡️ `shutdown /a` (Crucial circuit-breaker command)
    *   `wifi_off` ➡️ `powershell -Command "Disable-NetAdapter -Name 'Wi-Fi' -Confirm:$false"`
    *   `hotspot_off` ➡️ `powershell -Command "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Disable-NetAdapter -Confirm:$false"`

### Task B: Mobile Grid Dashboard Frontend
*   **Target File:** `index.html`
*   **Design Framework:** Clean, modular, fluid layout tailored exclusively for mobile viewports. Use high-contrast grid items acting as large touch targets.
*   **Logic:** Fetch variables from `config.json`. Attach asynchronous JavaScript `fetch()` triggers to each grid block to dispatch the explicit string payloads (`sleep`, `wifi_off`, etc.) to the target backend node endpoint over the active WireGuard tunnel.

## 4. Antigravity Agent Instructions
1.  **Planning Mode Requirement:** Generate a comprehensive step-by-step Task List and Implementation Plan detailing file organization before executing command runs.
2.  **Verification:** Utilize your integrated terminal layer to run local syntax and validation checks on the code structure.
3.  **Output Delivery:** Produce the finished modular project workspace with proper file splits (`config.json`, `server.js`, `index.html`) ready for manual verification.