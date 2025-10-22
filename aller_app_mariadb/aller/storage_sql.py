# aller/storage_sql.py
import os
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from typing import Optional
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

_ENGINE: Optional[Engine] = None

def _dsn() -> str:
    dialect = os.getenv("DB_DIALECT", "mysql+pymysql")
    user    = os.getenv("DB_USER", "")
    pw      = os.getenv("DB_PASSWORD", "")
    host    = os.getenv("DB_HOST", "127.0.0.1")
    port    = os.getenv("DB_PORT", "3306")
    name    = os.getenv("DB_NAME", "")

    # ← 반드시 URL 인코딩!
    user_q = quote_plus(user)
    pw_q   = quote_plus(pw)
    name_q = quote_plus(name)

    return f"{dialect}://{user_q}:{pw_q}@{host}:{port}/{name_q}?charset=utf8mb4"

def get_engine() -> Engine:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = create_engine(
            _dsn(),
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            future=True,
        )
    return _ENGINE
