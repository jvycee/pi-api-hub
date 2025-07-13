#!/bin/bash

# 🍌 BANANA-POWERED DEPLOYMENT SCRIPT 🍌
# Auto-deployment script for Pi API Hub
# Handles graceful stop, pull, and restart

set -e  # Exit on any error

# Configuration
PROJECT_NAME="pi-api-hub"
SERVICE_NAME="pi-api-hub"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy.log"
HEALTH_CHECK_URL="http://localhost:3000/health"
HEALTH_CHECK_TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    echo "[ERROR] $1" >> "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
    echo "[SUCCESS] $1" >> "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
    echo "[WARNING] $1" >> "$LOG_FILE"
}

# Function to check if service is running
is_service_running() {
    if command -v pm2 &> /dev/null; then
        pm2 describe "$SERVICE_NAME" > /dev/null 2>&1
    elif command -v docker &> /dev/null; then
        docker ps --format "table {{.Names}}" | grep -q "^$SERVICE_NAME$"
    else
        pgrep -f "node.*app.js" > /dev/null 2>&1
    fi
}

# Function to stop service
stop_service() {
    log "🛑 Stopping $SERVICE_NAME..."
    
    if command -v pm2 &> /dev/null; then
        if pm2 describe "$SERVICE_NAME" > /dev/null 2>&1; then
            pm2 stop "$SERVICE_NAME"
            success "PM2 service stopped"
        else
            warning "PM2 service not found"
        fi
    elif command -v docker &> /dev/null; then
        if docker ps --format "table {{.Names}}" | grep -q "^$SERVICE_NAME$"; then
            docker stop "$SERVICE_NAME"
            docker rm "$SERVICE_NAME"
            success "Docker container stopped and removed"
        else
            warning "Docker container not found"
        fi
    else
        # Kill Node.js processes
        if pgrep -f "node.*app.js" > /dev/null 2>&1; then
            pkill -f "node.*app.js"
            success "Node.js processes terminated"
        else
            warning "No Node.js processes found"
        fi
    fi
}

# Function to create backup
create_backup() {
    log "📦 Creating backup..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Create backup with timestamp
    BACKUP_NAME="${PROJECT_NAME}_$(date +%Y%m%d_%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    # Copy current state (excluding node_modules and logs)
    rsync -av --exclude='node_modules' --exclude='logs' --exclude='.git' --exclude='backups' . "$BACKUP_PATH/"
    
    success "Backup created: $BACKUP_PATH"
    
    # Keep only last 5 backups
    ls -t "$BACKUP_DIR" | tail -n +6 | xargs -r -I {} rm -rf "$BACKUP_DIR/{}"
}

# Function to pull latest code
pull_code() {
    log "📥 Pulling latest code from GitHub..."
    
    # Stash any local changes
    if git diff --quiet; then
        log "No local changes to stash"
    else
        git stash
        warning "Local changes stashed"
    fi
    
    # Pull latest code
    git fetch origin main
    git reset --hard origin/main
    
    success "Code updated to latest version"
}

# Function to install dependencies
install_dependencies() {
    log "📦 Installing dependencies..."
    
    # Check if package.json was updated
    if git diff HEAD~1 --name-only | grep -q "package.json"; then
        log "package.json changed, running npm install..."
        npm install --production
        success "Dependencies installed"
    else
        log "No package.json changes, skipping npm install"
    fi
}

# Function to start service
start_service() {
    log "🚀 Starting $SERVICE_NAME..."
    
    if command -v pm2 &> /dev/null; then
        # PM2 deployment
        if [ -f "ecosystem.config.js" ]; then
            pm2 start ecosystem.config.js --env production
        else
            pm2 start app.js --name "$SERVICE_NAME" --env production
        fi
        success "Service started with PM2"
    elif command -v docker &> /dev/null && [ -f "Dockerfile" ]; then
        # Docker deployment
        docker build -t "$SERVICE_NAME" .
        docker run -d --name "$SERVICE_NAME" -p 3000:3000 --env-file .env "$SERVICE_NAME"
        success "Service started with Docker"
    else
        # Direct Node.js start
        nohup node app.js > logs/app.log 2>&1 &
        success "Service started with Node.js"
    fi
}

# Function to health check
health_check() {
    log "🏥 Performing health check..."
    
    local attempts=0
    local max_attempts=$(($HEALTH_CHECK_TIMEOUT / 2))
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            success "Health check passed!"
            return 0
        fi
        
        attempts=$((attempts + 1))
        log "Health check attempt $attempts/$max_attempts failed, retrying in 2 seconds..."
        sleep 2
    done
    
    error "Health check failed after $max_attempts attempts"
    return 1
}

# Function to rollback
rollback() {
    error "🔄 Deployment failed, attempting rollback..."
    
    # Stop current service
    stop_service
    
    # Find latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | head -n 1)
    
    if [ -n "$LATEST_BACKUP" ]; then
        log "Rolling back to: $LATEST_BACKUP"
        
        # Restore from backup
        rsync -av "$BACKUP_DIR/$LATEST_BACKUP/" .
        
        # Start service
        start_service
        
        if health_check; then
            success "Rollback successful!"
        else
            error "Rollback failed!"
        fi
    else
        error "No backup found for rollback!"
    fi
}

# Main deployment function
deploy() {
    log "🍌 Starting BANANA-POWERED deployment..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        error "package.json not found. Are you in the right directory?"
        exit 1
    fi
    
    # Create backup before deployment
    create_backup
    
    # Stop service if running
    if is_service_running; then
        stop_service
    else
        log "Service is not running, skipping stop"
    fi
    
    # Pull latest code
    pull_code
    
    # Install dependencies
    install_dependencies
    
    # Start service
    start_service
    
    # Health check
    if health_check; then
        success "🍌 BANANA-POWERED DEPLOYMENT SUCCESSFUL! 🍌"
        log "🚀 Pi API Hub is now running the latest code!"
    else
        error "Deployment failed health check"
        rollback
        exit 1
    fi
}

# Handle script interruption
trap 'error "Deployment interrupted!"; rollback; exit 1' INT TERM

# Create logs directory if it doesn't exist
mkdir -p logs

# Run deployment
deploy