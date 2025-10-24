# aller/components/config.py
import os
from dotenv import load_dotenv
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-large")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "3072"))

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV = os.getenv("PINECONE_ENV", "us-east-1-aws")
PINECONE_INDEX_PRODUCTS = os.getenv("PINECONE_INDEX_PRODUCTS", "rag-product")
PINECONE_HOST = os.getenv("PINECONE_HOST")
NAMESPACE = os.getenv("NAMESPACE") or None
TOP_K = int(os.getenv("TOP_K", "8"))

DB_URI = os.getenv("DB_URI")

def validate_config():
    missing = []
    for k in ["OPENAI_API_KEY","PINECONE_API_KEY","PINECONE_INDEX_PRODUCTS","DB_URI"]:
        if not globals().get(k):
            missing.append(k)
    if missing:
        raise RuntimeError(f"환경변수 누락: {', '.join(missing)}")
