from datetime import date, datetime
from sqlalchemy import String, Date, DateTime, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("children.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False, default="OTHER")
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#10b981")
    source_message: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    source_timestamp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_sender: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
