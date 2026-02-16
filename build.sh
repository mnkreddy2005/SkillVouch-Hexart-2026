#!/bin/bash

# Build script for deployment platforms
echo "🚀 Starting build process..."

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd Frontend && npm install

# Build frontend
echo "🔨 Building frontend..."
npx vite build

# Return to root
cd ..

echo "✅ Build completed successfully!"
echo "📁 Frontend build is in: Frontend/dist/"
