from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class WaMessage(Base):
    __tablename__ = "whatsapp_messages"
    __table_args__ = (
        UniqueConstraint("child_id", "wa_msg_id", name="uq_child_wa_msg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("children.id"), nullable=False, index=True)
    wa_msg_id: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    timestamp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sender: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
