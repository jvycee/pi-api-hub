#!/usr/bin/env node
// Minimal dashboard with basic HTML
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head><title>Pi Dashboard</title></head>
<body style="background:#000;color:#0f0;font-family:monospace;padding:20px;">
    <h1>🎯 Pi API Hub Dashboard</h1>
    <div id="status">Loading...</div>
    <button onclick="test()">Test API</button>
    <script>
        async function update() {
            try {
                const health = await fetch('http://localhost:3000/health').then(r => r.json());
                document.getElementById('status').innerHTML = 
                    'Status: ' + health.status + '<br>' +
                    'Uptime: ' + health.uptime + 's<br>' + 
                    'Requests: ' + health.requests;
            } catch(e) {
                document.getElementById('status').innerHTML = 'API not reachable';
            }
        }
        function test() { update(); }
        update();
        setInterval(update, 5000);
    </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log(`Minimal dashboard: http://localhost:${PORT}`));