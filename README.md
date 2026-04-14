# SKI App

A simple project with a dummy backend and a dummy frontend. They don't talk to each other yet.

## Stack

- **Backend**: Python + FastAPI
- **Frontend**: React + TypeScript + Vite

## Running the backend


```bash
cd backend
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --port 8002
```

Runs at http://localhost:8002

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173
