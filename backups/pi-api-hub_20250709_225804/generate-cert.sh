#!/bin/bash

# Generate self-signed certificate for local development
echo "🔒 Generating self-signed certificate for local development..."

# Create certs directory if it doesn't exist
mkdir -p certs

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/C=US/ST=Development/L=Local/O=Pi API Hub/CN=localhost"

# Set proper permissions
chmod 600 certs/server.key
chmod 644 certs/server.crt

echo "✅ Self-signed certificate generated successfully!"
echo "📁 Certificate: certs/server.crt"
echo "🔑 Private Key: certs/server.key"
echo ""
echo "⚠️  WARNING: This is a self-signed certificate for development only!"
echo "📝 For production, use a proper certificate from a trusted CA."
echo ""
echo "🚀 To use HTTPS, set these environment variables:"
echo "   SSL_CERT_PATH=./certs/server.crt"
echo "   SSL_KEY_PATH=./certs/server.key"
echo "   ENABLE_HTTPS=true"