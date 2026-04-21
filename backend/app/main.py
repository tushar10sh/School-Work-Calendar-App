import logging
from contextlib import asynccontextmanager
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.database import init_db, AsyncSessionLocal
from app.config import get_settings
from app.routers import planner, events, todos, test_alerts, config_router
from app.routers import auth, children, whatsapp, sync

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _scheduled_sync_all():
    from app.models.child import Child
    from app.services import sync_service

    settings = get_settings()
    if not settings.sync.auto_sync:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Child).where(
                Child.auto_sync == True,
                Child.whatsapp_group_id != None,
            )
        )
        children = result.scalars().all()

        now = datetime.utcnow()
        for child in children:
            due_minutes = child.sync_interval_minutes
            if child.last_synced_at:
                elapsed = (now - child.last_synced_at).total_seconds() / 60
                if elapsed < due_minutes:
                    continue
            logger.info("Auto-syncing child %d (%s)", child.id, child.name)
            try:
                await sync_service.sync_child(child, db)
            except Exception as e:
                logger.error("Auto-sync failed for child %d: %s", child.id, e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database ready.")
    scheduler.add_job(_scheduled_sync_all, "interval", minutes=1, id="auto_sync")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="School Planner API",
    description="Manage your child's schoolwork, homework, events, and tests",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(children.router, prefix="/api/children", tags=["children"])
app.include_router(planner.router, prefix="/api/planner", tags=["planner"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(todos.router, prefix="/api/todos", tags=["todos"])
app.include_router(test_alerts.router, prefix="/api/test-alerts", tags=["test-alerts"])
app.include_router(whatsapp.router, prefix="/api/whatsapp", tags=["whatsapp"])
app.include_router(sync.router, prefix="/api/sync", tags=["sync"])
app.include_router(config_router.router, prefix="/api/config", tags=["config"])


@app.get("/health")
async def health():
    return {"status": "ok"}
