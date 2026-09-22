from sqlalchemy import Column, String, JSON
from app.models.base import BaseModel


class SystemSetting(BaseModel):
    __tablename__ = "system_settings"

    key = Column(String(50), unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False)
