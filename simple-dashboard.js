#!/usr/bin/env node
// 🎯 SIMPLE DASHBOARD: Works with existing app.js
// "Just add monitoring to what already works"

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3001;
const API_URL = 'http://localhost:3000'; // Your main API

// Simple HTML dashboard
const dashboardHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>🎯 Pi API Hub - Simple Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font: 14px Monaco, monospace; background: #000; color: #0f0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .card { background: #111; border: 1px solid #333; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .status { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
        .online { background: #0f0; }
        .offline { background: #f00; }
        h1 { color: #0ff; margin-bottom: 20px; text-align: center; }
        h2 { color: #ff0; margin-bottom: 10px; }
        .metric { margin: 5px 0; }
        .value { color: #0ff; font-weight: bold; }
        button { background: #333; color: #0f0; border: 1px solid #555; padding: 8px 16px; margin: 5px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 PI API HUB - DASHBOARD</h1>
        
        <div class="card">
            <h2>🏥 System Health</h2>
            <div class="metric">
                <span class="status" id="system-status"></span>
                Status: <span class="value" id="system-text">Loading...</span>
            </div>
            <div class="metric">Uptime: <span class="value" id="uptime">-</span></div>
            <div class="metric">Requests: <span class="value" id="requests">-</span></div>
        </div>

        <div class="card">
            <h2>🤖 AI Services</h2>
            <div class="metric">Ollama: <span class="value" id="ollama">-</span></div>
            <div class="metric">Anthropic: <span class="value" id="anthropic">-</span></div>
            <div class="metric">Total AI Requests: <span class="value" id="ai-requests">-</span></div>
        </div>

        <div class="card">
            <h2>⚡ Quick Test</h2>
            <button onclick="testAPI()">Test API Health</button>
            <button onclick="testMark()">Test Mark</button>
            <div style="margin-top: 10px;">
                <span>Last Test: </span><span class="value" id="last-test">-</span>
            </div>
        </div>
    </div>

    <script>
        async function updateDashboard() {
            try {
                const [health, stats] = await Promise.all([
                    fetch('${API_URL}/health').then(r => r.json()),
                    fetch('${API_URL}/stats').then(r => r.json()).catch(() => ({}))
                ]);

                document.getElementById('system-status').className = 'status ' + (health.status === 'ok' ? 'online' : 'offline');
                document.getElementById('system-text').textContent = health.status?.toUpperCase() || 'UNKNOWN';
                document.getElementById('uptime').textContent = formatUptime(health.uptime);
                document.getElementById('requests').textContent = health.requests || 0;

                document.getElementById('ollama').textContent = stats.ollamaHealthy ? 'ONLINE' : 'OFFLINE';
                document.getElementById('anthropic').textContent = stats.anthropicConfigured ? 'CONFIGURED' : 'NOT CONFIGURED';
                document.getElementById('ai-requests').textContent = stats.total || 0;

            } catch (error) {
                document.getElementById('system-text').textContent = 'ERROR';
                console.error('Dashboard update failed:', error);
            }
        }

        function formatUptime(seconds) {
            if (!seconds) return '-';
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return hours + 'h ' + mins + 'm';
        }

        async function testAPI() {
            try {
                const response = await fetch('${API_URL}/health');
                const result = await response.json();
                document.getElementById('last-test').textContent = 'API: ' + (response.ok ? 'OK' : 'FAILED');
            } catch (e) {
                document.getElementById('last-test').textContent = 'API: FAILED';
            }
        }

        async function testMark() {
            try {
                const response = await fetch('${API_URL}/api/mark/status');
                const result = await response.json();
                document.getElementById('last-test').textContent = 'Mark: ' + (response.ok ? 'OK' : 'FAILED');
            } catch (e) {
                document.getElementById('last-test').textContent = 'Mark: FAILED';
            }
        }

        // Auto-refresh every 5 seconds
        updateDashboard();
        setInterval(updateDashboard, 5000);
    </script>
</body>
</html>`;

// Serve dashboard
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
});

app.get('/dashboard', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
});

// Proxy health check to main API
app.get('/health', async (req, res) => {
    try {
        const response = await axios.get(\`\${API_URL}/health\`, { timeout: 5000 });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Main API unreachable' });
    }
});

app.listen(PORT, () => {
    console.log(\`
🎯 SIMPLE DASHBOARD RUNNING
==========================
Dashboard: http://localhost:\${PORT}
Main API:  \${API_URL}

This dashboard monitors your existing app.js
Start your main API with: NODE_ENV=production node app.js
\`);
});