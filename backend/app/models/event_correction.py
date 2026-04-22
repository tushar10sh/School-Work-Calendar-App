from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class EventCorrection(Base):
    __tablename__ = "event_corrections"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True
    )
    child_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("children.id"), nullable=False, index=True
    )
    source_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    corrected_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    original_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    corrected_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    corrected_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
