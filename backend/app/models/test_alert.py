from datetime import date, datetime
from sqlalchemy import String, Date, DateTime, Text, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TestAlert(Base):
    __tablename__ = "test_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("children.id"), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(20), nullable=False)
    subject_name: Mapped[str] = mapped_column(String(100), nullable=False)
    test_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    topics: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array string
    test_type: Mapped[str] = mapped_column(String(20), nullable=False, default="UNIT_TEST")
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
