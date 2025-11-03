import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
from urllib.parse import quote_plus
from openai import OpenAI
from pinecone import Pinecone

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = quote_plus(os.getenv("DB_PASSWORD"))  # 특수문자 안전하게 인코딩
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

DB_NAME = os.getenv("DB_NAME")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
def get_engine():
    return engine

# ── OpenAI ──
oai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")

# ── Pinecone ──
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
INDEX_PRODUCT = os.getenv("PINECONE_INDEX", "rag-product")

# backend/db.py 맨 위쪽 (임시 디버그)
import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(".env", raise_error_if_not_found=False) or ".env")
print("[dotenv] OPENAI?", bool(os.getenv("OPENAI_API_KEY")))
print("[dotenv] PINECONE?", bool(os.getenv("PINECONE_API_KEY")))