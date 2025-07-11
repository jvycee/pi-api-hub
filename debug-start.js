#!/usr/bin/env node

/**
 * Debug startup script to identify issues
 */

console.log('🍌 Starting debug script...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Working directory:', process.cwd());

try {
    console.log('🔍 Checking dependencies...');
    
    // Check core dependencies
    require('express');
    console.log('✅ express');
    
    require('cors');
    console.log('✅ cors');
    
    try {
        require('joi');
        console.log('✅ joi');
    } catch (err) {
        console.log('❌ joi missing:', err.message);
        process.exit(1);
    }
    
    console.log('🔍 Checking shared modules...');
    
    try {
        const logger = require('./shared/logger');
        console.log('✅ logger');
    } catch (err) {
        console.log('❌ logger error:', err.message);
        process.exit(1);
    }
    
    try {
        const { getConfigManager } = require('./shared/config-manager');
        console.log('✅ config-manager module loaded');
        
        const config = getConfigManager();
        console.log('✅ config manager initialized');
        
        config.validateConfiguration();
        console.log('✅ configuration validated');
        
    } catch (err) {
        console.log('❌ config-manager error:', err.message);
        console.log('Stack:', err.stack);
        process.exit(1);
    }
    
    try {
        const { getErrorHandler } = require('./shared/error-handler');
        console.log('✅ error-handler loaded');
    } catch (err) {
        console.log('❌ error-handler error:', err.message);
        process.exit(1);
    }
    
    console.log('🔍 All dependencies checked, starting main app...');
    
    // If we get here, try to load the main app
    require('./app.js');
    
} catch (error) {
    console.error('❌ Fatal error during startup:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}