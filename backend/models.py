# backend/models.py
from sqlalchemy import Column, BigInteger, Integer, String, Date, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255))
    status = Column(Enum('active', 'blocked'), server_default='active')
    last_login_at = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    profile = relationship("UserProfile", back_populates="user", uselist=False)

class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(BigInteger, ForeignKey("users.id"), primary_key=True)
    name = Column(String(255))
    nickname = Column(String(255))
    birth_date = Column(Date)
    gender = Column(Enum('female', 'male', 'other', 'na'))
    skin_type_code = Column(String(4))
    skin_axes_json = Column(Text)
    preferences_json = Column(Text)
    allergies_json = Column(Text)
    last_quiz_at = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    user = relationship("User", back_populates="profile")

class UserFavoriteProduct(Base):
    __tablename__ = "user_favorite_products"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    
class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    korean_name = Column(String(255), nullable=False)
    english_name = Column(String(255))
    description = Column(Text)
    caution_grade = Column(String(50)) # 안전 / 주의 / 위험 / NULL
