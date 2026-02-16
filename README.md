# SkillVouch AI - MySQL Version

A skill-sharing and learning platform powered by AI, featuring MySQL database integration.

## Project Structure

```
SkillVouch-MySQL/
├── Frontend/          # React + Vite frontend application
├── Backend/           # Node.js + Express backend server
├── package.json       # Root package.json with orchestration scripts
└── README.md
```

## Prerequisites

- Node.js (v20+ recommended)
- MySQL database
- MistralAI API key (for AI functionality)

## Setup and Installation

1. **Install root dependencies:**
   ```bash
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd Frontend && npm install
   ```

3. **Install backend dependencies:**
   ```bash
   cd Backend && npm install
   ```

4. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Set your MistralAI API key: `VITE_MISTRAL_API_KEY=your-key-here`
   - Configure database connection if needed

## Running the Application

### Development Mode (Both Frontend + Backend)
```bash
npm run dev
```
This starts:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

### Individual Services

**Frontend only:**
```bash
npm run dev:frontend
```

**Backend only:**
```bash
npm run dev:backend
```

## Deployment

### Frontend Deployment
```bash
npm run build
```
The built files will be in `Frontend/dist/`

### Backend Deployment
```bash
npm start
```
The backend runs on port 3000 by default (configurable via PORT env var)

## Environment Variables

**Frontend (.env):**
- `VITE_MISTRAL_API_KEY` - Your MistralAI API key

**Backend (.env):**
- `MISTRAL_API_KEY` - Your MistralAI API key
- `MISTRAL_MODEL` - Model to use (default: mistral-large-latest)
- Database configuration (if using MySQL)

## Features

- AI-powered quiz generation
- Skill matching and recommendations
- User profiles and messaging
- Real-time chat functionality
- MySQL database integration
- Powered by MistralAI
