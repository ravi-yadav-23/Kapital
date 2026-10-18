import sys
import traceback
from pathlib import Path

# Ensure the root of api service is on sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

try:
    from app.main import app
except Exception as e:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    err_msg = str(e)
    tb_str = traceback.format_exc()
    print(f"[FATAL_STARTUP_ERROR] {err_msg}\n{tb_str}", file=sys.stderr)

    app = FastAPI(title="Kapitl API - Startup Error")

    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    async def error_fallback(full_path: str):
        return JSONResponse(
            status_code=500,
            content={
                "status": "startup_failed",
                "error": err_msg,
                "type": type(e).__name__,
                "traceback": tb_str.split("\n"),
            },
            headers={"Access-Control-Allow-Origin": "*"}
        )
