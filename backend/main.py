"""
Vydalitics AI — FastAPI backend for the agentic AI system.
Provides chat (streaming SSE), knowledge management, and health endpoints.
"""

import os
import json
import shutil
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vydalitics")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
VIDALYTICS_API_TOKEN = os.getenv("VIDALYTICS_API_TOKEN", "")
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="Vydalitics AI Agent",
    version="1.0.0",
    description="Agentic AI backend powered by Claude for Vidalytics analytics",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []
    vidalytics_token: str | None = None


# ── Health ────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "anthropic_configured": bool(ANTHROPIC_API_KEY and ANTHROPIC_API_KEY != "your-anthropic-api-key-here"),
        "vidalytics_configured": bool(VIDALYTICS_API_TOKEN),
    }


# ── Chat (SSE streaming) ─────────────────────────────────────────────


@app.post("/chat")
async def chat(req: ChatRequest):
    api_key = ANTHROPIC_API_KEY
    if not api_key or api_key == "your-anthropic-api-key-here":
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata nel backend/.env")

    vid_token = req.vidalytics_token or VIDALYTICS_API_TOKEN
    if not vid_token:
        raise HTTPException(status_code=400, detail="Token Vidalytics non configurato")

    from agent.core import run_agent_stream

    async def event_generator():
        chunk_count = 0
        try:
            async for chunk in run_agent_stream(
                anthropic_api_key=api_key,
                vidalytics_token=vid_token,
                message=req.message,
                conversation_history=req.conversation_history,
            ):
                chunk_count += 1
                yield {"event": "message", "data": json.dumps({"text": chunk})}
            logger.info("Chat completed: %d chunks streamed for message '%s'", chunk_count, req.message[:60])
            yield {"event": "done", "data": json.dumps({"finished": True})}
        except Exception as e:
            logger.error("Chat error for message '%s': %s", req.message[:60], e, exc_info=True)
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_generator())


@app.post("/chat/sync")
async def chat_sync(req: ChatRequest):
    """Non-streaming chat endpoint for simpler integrations."""
    api_key = ANTHROPIC_API_KEY
    if not api_key or api_key == "your-anthropic-api-key-here":
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata nel backend/.env")

    vid_token = req.vidalytics_token or VIDALYTICS_API_TOKEN
    if not vid_token:
        raise HTTPException(status_code=400, detail="Token Vidalytics non configurato")

    from agent.core import run_agent

    try:
        response = await run_agent(
            anthropic_api_key=api_key,
            vidalytics_token=vid_token,
            message=req.message,
            conversation_history=req.conversation_history,
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Knowledge Management ─────────────────────────────────────────────


@app.post("/knowledge/upload")
async def upload_knowledge(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nessun file fornito")

    ext = Path(file.filename).suffix.lower()
    allowed = {".pdf", ".txt", ".md", ".csv", ".json"}
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Formato non supportato: {ext}. Supportati: {', '.join(allowed)}",
        )

    dest = UPLOADS_DIR / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    from agent.knowledge import ingest_file

    try:
        meta = await ingest_file(str(dest), file.filename)
        return JSONResponse(content=meta)
    except Exception as e:
        if dest.exists():
            dest.unlink()
        raise HTTPException(status_code=500, detail=f"Errore indicizzazione: {str(e)}")


@app.get("/knowledge")
async def list_knowledge():
    from agent.knowledge import list_documents
    return list_documents()


@app.delete("/knowledge/{doc_id}")
async def delete_knowledge(doc_id: str):
    from agent.knowledge import delete_document
    success = delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    return {"success": True}


# ── Run ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100, log_level="info")
