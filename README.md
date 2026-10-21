# Doctor Tracker — Backend API

RESTful API backend for the Doctor Tracker system built with Node.js, Express, TypeScript, and MongoDB (Replica Set).

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB 7.0 (with Replica Set `rs0` for Mongoose transactions)
- **Validation**: Zod
- **Authentication**: JWT & HTTP-only Cookies

## Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Docker](https://www.docker.com/) & Docker Compose (required for MongoDB replica set transactions)

## Getting Started

### 1. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
PORT=5001
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27018/doctor_tracker?replicaSet=rs0&directConnection=true
JWT_SECRET=your_jwt_secret_key_here
CLIENT_URL=http://localhost:3000
```

### 2. Start MongoDB Replica Set
Start the local MongoDB replica set using Docker Compose:
```bash
docker compose up -d
```
> **Note**: A replica set is required for ACID transactions across doctors, patients, and visit workflows.

### 3. Install Dependencies
```bash
npm install
```

### 4. Seed Database
Initialize the database with mock doctors, patients, and visits:
```bash
npm run seed
```

### 5. Run the Server
- Development mode (with live reload):
  ```bash
  npm run dev
  ```
- Build & Run production:
  ```bash
  npm run build
  npm start
  ```
