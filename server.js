const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Redirect console output to a log file for diagnostics
const LOG_PATH = path.join(__dirname, 'server.log');
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const msg = args.join(' ');
  originalLog.apply(console, args);
  try {
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] [INFO] ${msg}\n`);
  } catch (err) {}
};

console.error = function(...args) {
  const msg = args.join(' ');
  originalError.apply(console, args);
  try {
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] [ERROR] ${msg}\n`);
  } catch (err) {}
};


// Path to configuration file
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Read config.json
let config = { ip: '100.X.Y.Z', port: 8080 };
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const rawData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    config = JSON.parse(rawData);
    console.log(`[Config] Loaded networking parameters: IP=${config.ip}, Port=${config.port}`);
  } else {
    console.warn(`[Config] config.json not found. Using defaults: IP=${config.ip}, Port=${config.port}`);
  }
} catch (err) {
  console.error('[Config] Error reading config.json:', err.message);
  process.exit(1);
}

// Security Boundary: Force IP to be a Tailscale IP (starts with 100.)
if (!config.ip || !config.ip.startsWith('100.')) {
  console.error('\n=============================================================');
  console.error('CRITICAL SECURITY VIOLATION: Zero-Trust Binding Constraint Fail!');
  console.error(`Attempted to bind to: "${config.ip}"`);
  console.error('The backend daemon MUST bind exclusively to the host machine\'s');
  console.error('persistent private Tailscale IP address (100.X.Y.Z).');
  console.error('=============================================================\n');
  process.exit(1);
}

// Windows command mapping using the unified control.ps1 script
const COMMAND_MAPPING = {
  'sleep': `powershell -ExecutionPolicy Bypass -File "${path.join(__dirname, 'control.ps1')}" sleep`,
  'shutdown': 'shutdown /s /t 60',
  'abort_shutdown': 'shutdown /a',
  'wifi_on': `powershell -ExecutionPolicy Bypass -File "${path.join(__dirname, 'control.ps1')}" wifi_on`,
  'wifi_off': `powershell -ExecutionPolicy Bypass -File "${path.join(__dirname, 'control.ps1')}" wifi_off`,
  'hotspot_on': `powershell -ExecutionPolicy Bypass -File "${path.join(__dirname, 'control.ps1')}" hotspot_on`,
  'hotspot_off': `powershell -ExecutionPolicy Bypass -File "${path.join(__dirname, 'control.ps1')}" hotspot_off`
};

// CORS configuration headers for decoupled clients
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

// Helper to check if the target Tailscale IP exists on any local network interface
function verifyNetworkInterface(targetIp) {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && net.address === targetIp) {
        return true;
      }
    }
  }
  return false;
}

// Retry settings for binding to network interface
const RETRY_INTERVAL_MS = 1000;
let retryCount = 0;

// Create the HTTP server
const server = http.createServer((req, res) => {
  // CORS Preflight request handling
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // GET /status endpoint to return hardware status dynamically
  if (req.method === 'GET' && req.url === '/status') {
    const statusCmd = `powershell -ExecutionPolicy Bypass -File "${path.join(__dirname, 'control.ps1')}" status`;
    exec(statusCmd, (err, stdout) => {
      let wifiStatus = 'on';
      let hotspotStatus = 'off';
      if (!err && stdout) {
        const parts = stdout.trim().split(',');
        const wifiAdapterStatus = parts[0] ? parts[0].trim() : '';
        wifiStatus = (wifiAdapterStatus === 'Disabled' || !wifiAdapterStatus) ? 'off' : 'on';
        const rawHotspot = parts[1] ? parts[1].trim() : 'Off';
        hotspotStatus = (rawHotspot.toLowerCase() === 'on') ? 'on' : 'off';
      }
      
      res.writeHead(200, CORS_HEADERS);
      res.end(JSON.stringify({
        success: true,
        wifi: wifiStatus,
        hotspot: hotspotStatus
      }));
    });
    return;
  }

  // API Command endpoint
  if (req.method === 'POST' && (req.url === '/command' || req.url === '/')) {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      let commandToken = '';

      try {
        if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
          const parsed = JSON.parse(body);
          commandToken = parsed.command || parsed.action || '';
        } else {
          commandToken = body.trim();
        }
      } catch (err) {
        commandToken = body.trim();
      }

      if (!commandToken) {
        res.writeHead(400, CORS_HEADERS);
        res.end(JSON.stringify({ success: false, error: 'Empty command token received' }));
        return;
      }

      // STRICT VALIDATION: Check if command matches predefined mappings
      const systemCommand = COMMAND_MAPPING[commandToken];
      if (!systemCommand) {
        console.warn(`[Security Alert] Blocked attempt to execute unauthorized command token: "${commandToken}"`);
        res.writeHead(403, CORS_HEADERS);
        res.end(JSON.stringify({ success: false, error: 'Unauthorized command token' }));
        return;
      }

      console.log(`[Executing] Token: "${commandToken}" -> command: "${systemCommand}"`);

      // Execute command via shell subprocess
      exec(systemCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Error] Failed to execute command: ${error.message}`);
          res.writeHead(500, CORS_HEADERS);
          res.end(JSON.stringify({
            success: false,
            error: error.message,
            stderr: stderr.trim()
          }));
          return;
        }

        console.log(`[Success] Command executed successfully. Stdout: ${stdout.trim()}`);
        res.writeHead(200, CORS_HEADERS);
        res.end(JSON.stringify({
          success: true,
          message: `Command '${commandToken}' dispatched successfully`,
          stdout: stdout.trim()
        }));
      });
    });
    return;
  }

  // Serve static files (dashboard / config)
  if (req.method === 'GET') {
    let filePath = '';
    let contentType = 'text/plain';

    if (req.url === '/' || req.url === '/index.html') {
      filePath = path.join(__dirname, 'index.html');
      contentType = 'text/html';
    } else if (req.url === '/config.json') {
      filePath = path.join(__dirname, 'config.json');
      contentType = 'application/json';
    }

    if (filePath && fs.existsSync(filePath)) {
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
      });
      return;
    }
  }

  // Default Route
  res.writeHead(404, CORS_HEADERS);
  res.end(JSON.stringify({ success: false, error: 'Endpoint Not Found' }));
});

// Helper to safely trigger the server start
function startServer() {
  if (!verifyNetworkInterface(config.ip)) {
    retryCount++;
    console.warn(`[Network] Retry #${retryCount}: Tailscale IP ${config.ip} is not active on local network interfaces. Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
    setTimeout(startServer, RETRY_INTERVAL_MS);
    return;
  }

  console.log(`[Network] Tailscale IP ${config.ip} detected on local network interfaces. Attempting to bind...`);
  try {
    server.listen(config.port, config.ip, () => {
      retryCount = 0; // Reset retry count on success
      console.log('=============================================================');
      console.log('      Tailscale Remote System Controller Backend Online      ');
      console.log(`  IP Binding : ${config.ip} (Tailscale Only)`);
      console.log(`  TCP Port   : ${config.port}`);
      console.log('=============================================================');
      console.log('Server is running and listening for commands...');
    });
  } catch (err) {
    console.error(`[Error] Failed to listen: ${err.message}. Retrying...`);
    setTimeout(startServer, RETRY_INTERVAL_MS);
  }
}

// Start the server (handles retries automatically if Tailscale is offline or starting up)
startServer();

// Graceful error handling for bind failure
server.on('error', (err) => {
  if (err.code === 'EADDRNOTAVAIL') {
    retryCount++;
    console.error(`\nCRITICAL BIND ERROR: Cannot bind to the specified IP address: ${config.ip}`);
    console.error(`Tailscale might be offline or initializing. Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
    setTimeout(startServer, RETRY_INTERVAL_MS);
  } else if (err.code === 'EADDRINUSE') {
    console.error(`\nFATAL BIND ERROR: Port ${config.port} is already in use.`);
    console.error('Another instance of the server or another application is using this port.');
    process.exit(1);
  } else {
    console.error(`\nServer Error: ${err.message}\n`);
    process.exit(1);
  }
});
