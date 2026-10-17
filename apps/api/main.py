import sys
from pathlib import Path

# Ensure the root of api service is on sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# Expose FastAPI instance for Vercel ASGI runner
from app.main import app
