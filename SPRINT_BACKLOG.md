# Pi API Hub Sprint Backlog

## Between Sprints - Repo Sync & Infrastructure Tasks

### 🐐 Ollama & Mark Status Monitoring
**Priority:** Medium  
**Effort:** 1-2 hours  
**Status:** Pending

**Issue:**
The dashboard currently shows Mark as "OFFLINE" because the Pi is running from its own separate repo, which doesn't have the new `/monitoring/ollama-status` endpoint. The dashboard falls back to "ASSUMED HEALTHY" based on Pi health, but proper Ollama monitoring would be better.

**Tasks:**
- [ ] Sync the Pi's repo with latest changes to get the new `/monitoring/ollama-status` endpoint
- [ ] Test Ollama status endpoint on Pi: `curl http://localhost:11434/api/tags`
- [ ] Verify dashboard shows real Ollama health instead of "ASSUMED HEALTHY"
- [ ] Test Mark availability detection (should show actual model info)

**Files to sync:**
- `app.js` (lines 844-889) - New Ollama status endpoint
- `public/dashboard.html` - Updated Ollama monitoring logic

**Benefits:**
- Real-time Ollama health monitoring
- Accurate Mark availability status
- Show actual loaded models (llama3.2:latest, etc.)
- Better debugging when Mark has issues

**Current Workaround:**
Dashboard assumes Mark is healthy when Pi API Hub is operational (which works since Mark actually is available).

---

## Future Sprint Ideas

### 🍌 Dashboard Enhancements
- [ ] Add Mark chat history/activity metrics
- [ ] Real-time WebSocket updates instead of polling
- [ ] Mobile-responsive dashboard layout

### 🛡️ Security Features
- [ ] Rate limiting alerts/notifications
- [ ] Security event log persistence
- [ ] Threat detection rule customization

### 🔧 Infrastructure
- [ ] Redis integration for production caching
- [ ] Automated Pi repo sync workflow
- [ ] Health check monitoring alerts

---

*Last updated: 2025-07-11*