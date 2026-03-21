"""
app/models/schedule.py
Modelo de agendamento de backup.
Importa Base do models.py existente.
"""

import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text

from app.models.models import Base


class ScheduleRecord(Base):
    __tablename__ = "schedules"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    label      = Column(String, nullable=False)
    cron_type  = Column(String, nullable=False)  # "hourly" | "twice_daily" | "daily_20h" | "on_boot"
    enabled    = Column(Boolean, default=True)
    paths_json = Column(Text, nullable=False, default="[]")  # JSON array de caminhos
    channel_id = Column(Integer, nullable=True)
    last_run   = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def paths(self) -> list[str]:
        try:
            return json.loads(self.paths_json)
        except (json.JSONDecodeError, TypeError):
            return []

    @paths.setter
    def paths(self, val: list[str]):
        self.paths_json = json.dumps(val)
