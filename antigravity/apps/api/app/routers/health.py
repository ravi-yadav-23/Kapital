from fastapi import APIRouter

router = APIRouter()

@router.get("")
async def health_check():
    return {"status": "ok", "service": "Antigravity API", "version": "1.0.0"}
