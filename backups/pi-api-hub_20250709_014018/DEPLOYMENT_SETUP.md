# 🍌 BANANA-POWERED AUTO-DEPLOYMENT SETUP 🍌

## **Pi Setup Guide for Auto-Deployment**

### **Step 1: SSH Key Generation & Setup**

#### **On your Mac mini (development machine):**

```bash
# Generate SSH key pair for deployment
ssh-keygen -t ed25519 -C "pi-api-hub-deployment" -f ~/.ssh/pi_deployment_key

# This creates:
# ~/.ssh/pi_deployment_key (private key - keep secret!)
# ~/.ssh/pi_deployment_key.pub (public key - safe to share)
```

#### **On your Pi (production server):**

```bash
# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key to authorized_keys
# Copy the contents of ~/.ssh/pi_deployment_key.pub from your Mac
# and paste into ~/.ssh/authorized_keys on the Pi

nano ~/.ssh/authorized_keys
# Paste the public key content here

# Set proper permissions
chmod 600 ~/.ssh/authorized_keys
```

### **Step 2: GitHub Secrets Configuration**

Go to your GitHub repository → Settings → Secrets and Variables → Actions

Add these secrets:

```
SSH_PRIVATE_KEY: [Contents of ~/.ssh/pi_deployment_key from Mac]
SSH_USER: pi (or your Pi username)
SERVER_HOST: [Your Pi's IP address, e.g., 10.0.0.218]
SERVER_PORT: 3000
PROJECT_PATH: /home/pi/pi-api-hub (or wherever you clone the repo)
```

### **Step 3: Pi Server Preparation**

#### **Install required software on Pi:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Git (if not already installed)
sudo apt install git -y

# Clone your repository
cd ~
git clone https://github.com/yourusername/pi-api-hub.git
cd pi-api-hub

# Install dependencies
npm install

# Create logs directory
mkdir -p logs

# Set up PM2 to start on boot
pm2 startup
# Follow the instructions it gives you

# Create environment file
cp .env.example .env
nano .env
# Add your environment variables
```

### **Step 4: Test SSH Connection**

From your Mac, test the SSH connection:

```bash
# Test SSH connection
ssh -i ~/.ssh/pi_deployment_key pi@YOUR_PI_IP

# Test deployment script
cd /home/pi/pi-api-hub
./deploy.sh
```

### **Step 5: GitHub Actions Workflow**

The workflow is already created in `.github/workflows/deploy.yml`. It will:

1. **Trigger** on every push to `main` branch
2. **Connect** to your Pi via SSH
3. **Run** the deployment script
4. **Perform** health check
5. **Notify** about deployment status

### **Step 6: Environment Variables on Pi**

Create `/home/pi/pi-api-hub/.env` with:

```bash
# API Keys
HUBSPOT_API_KEY=your_hubspot_key
ANTHROPIC_API_KEY=your_anthropic_key

# Server Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Pi-specific optimizations
MAX_CONCURRENT_REQUESTS=25
MEMORY_WARNING_THRESHOLD=7516192768  # 7GB
MEMORY_CRITICAL_THRESHOLD=8053063680 # 7.5GB

# Security
ADMIN_API_KEY=your_secure_admin_key
CORS_ORIGINS=https://your-domain.com

# Ollama configuration
OLLAMA_BASE_URL=http://localhost:11434
```

### **Step 7: PM2 Configuration**

The `ecosystem.config.js` is already configured for Pi 5:

- **4 cluster instances** (one per core)
- **Memory limits** appropriate for Pi
- **Automatic restarts** on crashes
- **Log rotation** to prevent disk fill

### **Step 8: Testing the Pipeline**

1. **Make a change** to your code locally
2. **Commit and push** to main branch:
   ```bash
   git add .
   git commit -m "Test auto-deployment 🍌"
   git push origin main
   ```
3. **Watch GitHub Actions** tab for deployment progress
4. **Check Pi** to verify deployment worked

### **Step 9: Troubleshooting**

#### **Common Issues:**

**SSH Connection Failed:**
```bash
# Check SSH service on Pi
sudo systemctl status ssh

# Check firewall
sudo ufw status

# Test SSH key
ssh -i ~/.ssh/pi_deployment_key -vvv pi@YOUR_PI_IP
```

**Deployment Script Failed:**
```bash
# Check logs on Pi
tail -f /home/pi/pi-api-hub/logs/deploy.log

# Check PM2 status
pm2 status
pm2 logs pi-api-hub
```

**Health Check Failed:**
```bash
# Check if service is running
curl http://localhost:3000/health

# Check PM2 status
pm2 monit
```

### **Step 10: Security Best Practices**

1. **Firewall Configuration:**
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 3000
   sudo ufw enable
   ```

2. **SSH Security:**
   ```bash
   # Edit SSH config
   sudo nano /etc/ssh/sshd_config
   
   # Add these lines:
   PermitRootLogin no
   PasswordAuthentication no
   PubkeyAuthentication yes
   
   # Restart SSH
   sudo systemctl restart ssh
   ```

3. **Regular Updates:**
   ```bash
   # Set up automatic security updates
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

---

## **Workflow Overview**

```
Mac Mini (Development) → GitHub → Pi (Production)
     ↓                      ↓           ↓
   Code Changes         Actions        Auto-Deploy
   git push            Triggered       deploy.sh
                      SSH Deploy      PM2 Restart
                     Health Check    Service Ready
```

## **Expected Deployment Time**

- **Total deployment time**: 30-60 seconds
- **Service downtime**: 5-10 seconds
- **Health check timeout**: 30 seconds
- **Rollback time** (if needed): 15-30 seconds

---

🍌 **Ready for MAXIMUM BANANA AUTO-DEPLOYMENT!** 🍌