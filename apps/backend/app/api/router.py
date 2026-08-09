from fastapi import APIRouter

from app.api.v1.backtest_routes import router as backtest_router
from app.api.v1.mt5_routes import router as mt5_router
from app.api.v1.routes import router as v1_router

api_router = APIRouter()
api_router.include_router(v1_router, prefix="/api/v1")
api_router.include_router(backtest_router, prefix="/api/v1")
api_router.include_router(mt5_router, prefix="/api/v1/mt5")
