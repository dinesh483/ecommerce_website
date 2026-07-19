from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth_routes, products, categories, orders, users

# Creates all tables in MySQL if they don't already exist.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Ecommerce Backend API",
    description="A complete FastAPI + MySQL backend for an ecommerce website "
    "with products, categories, users, auth, and orders.",
    version="1.0.0",
)

# Allow your frontend (React, Vue, etc.) to call this API.
# For production, replace "*" with your actual frontend domain(s).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(users.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Ecommerce backend is running"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
