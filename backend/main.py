
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware



from backend.api import grade

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount grading API
app.include_router(grade.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Hello World"}


# Health check endpoint
@app.get("/health")
def health():
    return {"status": "ok"}
