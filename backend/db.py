import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
from urllib.parse import quote_plus
from pinecone import Pinecone
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from urllib.parse import quote_plus
from typing import Generator

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

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EMBED_MODEL = "text-embedding-3-large"
llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY,)# llm 변동성 옵션 temperature=0.7(기본값)

# ── Pinecone ──
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
pinecone_client = Pinecone(api_key=PINECONE_API_KEY)
EMBEDDING_MODEL = "text-embedding-3-large"
#index
RAG_PRODUCT_INDEX_NAME = "rag-product"
INGREDIENT_INDEX_NAME = "cosmetic-ingredients"
PRODUCT_NAME_INDEX= "product-name"
INGREDIENT_NAME_INDEX = "ingredients-name"
BRAND_NAME_INDEX = "brand-name"

embeddings_model = OpenAIEmbeddings(
    model=EMBEDDING_MODEL,
    openai_api_key=OPENAI_API_KEY
)