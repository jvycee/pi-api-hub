#!/usr/bin/env node

/**
 * Production startup script with better error handling
 */

// Set production environment
process.env.NODE_ENV = 'production';

console.log('🍌 Starting Pi API Hub in production mode...');
console.log('Node version:', process.version);
console.log('Timestamp:', new Date().toISOString());

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
    process.exit(1);
});

try {
    // Check if basic dependencies exist
    console.log('🔍 Checking core dependencies...');
    require('express');
    require('cors');
    
    // Check if Joi is available (needed for new config system)
    try {
        require('joi');
        console.log('✅ All dependencies available');
    } catch (err) {
        console.error('❌ Missing dependency "joi". Please run: npm install joi');
        console.error('This is required for the new configuration system.');
        process.exit(1);
    }
    
    console.log('🚀 Starting application...');
    
    // Start the main application
    require('./app.js');
    
} catch (error) {
    console.error('❌ Failed to start application:', error.message);
    
    if (error.message.includes('Cannot find module')) {
        console.error('💡 Try running: npm install');
    } else if (error.message.includes('environment variables')) {
        console.error('💡 For full functionality, set these environment variables:');
        console.error('   export HUBSPOT_PRIVATE_APP_TOKEN="your_token_here"');
        console.error('   export BANANA_ADMIN_KEY="your_admin_key_here"');
        console.error('💡 The server can still run without these for basic functionality.');
    }
    
    console.error('Stack trace:', error.stack);
    process.exit(1);
}