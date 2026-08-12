import json
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from core.database import get_db
from core.websocket_manager import manager
from routes.deps import get_current_user_from_ws

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    db: Session = Depends(get_db),
):
    user = await get_current_user_from_ws(websocket, db)
    if not user:
        return
    # Resolve tenant organization ID from authenticated JWT session
    resolved_org = user.get("organization_id")
    await manager.connect(websocket, resolved_org)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                obj = json.loads(data)
                event_type = (obj.get("type") or "").lower()
                if event_type == "typing":
                    await manager.broadcast(
                        {
                            "type": "typing",
                            "conversation_id": obj.get("conversation_id"),
                        },
                        exclude=websocket,
                    )
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, resolved_org)
