# Thin FastAPI router mounting P1 and P2 routers
from fastapi import FastAPI
from backend.risk_engine.router import router as risk_router
from backend.adapty_engine.router import router as adapty_router

app = FastAPI(
    title="Adapty Predictive Win-Back Engine",
    version="0.1.0",
    description="Belgrade Hackathon 2026 — churn prediction & paywall generation API",
)

app.include_router(risk_router)
app.include_router(adapty_router)


@app.get("/health", tags=["Meta"])
def health() -> dict:
    return {"status": "ok"}
