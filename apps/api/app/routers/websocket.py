import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List

router = APIRouter(tags=["websocket"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

from datetime import datetime, timezone

manager = ConnectionManager()


async def broadcast_event(event_type: str, payload: dict):
    """Broadcast structured real-time market or order event to all connected UI clients."""
    message = {
        "type": event_type,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await manager.broadcast(message)

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Real-time telemetry stream for:
    - Live GMP & subscription updates
    - SmartAPI order status transitions
    - 09:00:00 AM pre-market sell execution ticks
    """
    await manager.connect(websocket)
    try:
        # Send initial connection handshake
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to Kapitl Real-Time Market Stream",
            "server_time": asyncio.get_event_loop().time(),
        })
        while True:
            data = await websocket.receive_text()
            # Echo or process incoming ping
            await websocket.send_json({"type": "PONG", "payload": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
