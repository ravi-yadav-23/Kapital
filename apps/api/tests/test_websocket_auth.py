"""F24: the live event stream carries account names and amounts; only a signed-in admin may listen."""
import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.config import settings
from app.main import app
from app.middleware.auth import create_access_token, create_temp_2fa_token

ADMIN = create_access_token({"sub": "admin-1", "role": "ADMIN", "is_guest": False})
GUEST = create_access_token({"sub": "g", "role": "GUEST", "is_guest": True})
PENDING = create_temp_2fa_token({"email": "a@b.c"})


@pytest.fixture(params=["development", "production"])
def env(request, monkeypatch):
    monkeypatch.setattr(settings, "environment", request.param)


def _connect(path):
    client = TestClient(app)  # no lifespan: do not touch the real database
    return client.websocket_connect(path)


@pytest.mark.parametrize("path", ["/ws", "/ws?token=not.a.jwt", f"/ws?token={GUEST}", f"/ws?token={PENDING}"])
def test_non_admins_are_refused(env, path):
    with pytest.raises(WebSocketDisconnect):
        with _connect(path) as ws:
            ws.receive_json()


def test_admin_is_accepted(env):
    with _connect(f"/ws?token={ADMIN}") as ws:
        assert ws.receive_json()["type"] == "CONNECTION_ESTABLISHED"
