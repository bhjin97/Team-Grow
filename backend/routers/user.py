# --- Imports ---
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session, declarative_base
from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, DateTime, Enum, SmallInteger, BigInteger
from db import get_db 
from typing import Optional
import datetime # [★] 타임스탬프 생성을 위해 사용
import json 

# --- SQLAlchemy Models (기존과 동일) ---
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(BigInteger, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255)) 
    status = Column(Enum('active', 'blocked'), server_default='active')
    last_login_at = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime) 

class UserProfile(Base):
    __tablename__ = "user_profiles"
    user_id = Column(BigInteger, ForeignKey("users.id"), primary_key=True)
    name = Column(String(255))  # [★] 이름 추가 (중복 저장)
    nickname = Column(String(255))
    birth_date = Column(Date)  # [★] birth_year → birth_date (DATE 타입)
    gender = Column(Enum('female', 'male', 'other', 'na')) 
    skin_type_code = Column(String(4)) 
    skin_axes_json = Column(Text) 
    preferences_json = Column(Text)
    allergies_json = Column(Text)
    last_quiz_at = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

# --- Pydantic Models (수정) ---
class UserProfileUpdate(BaseModel):
    name: str 
    email: EmailStr
    nickname: Optional[str] = None
    birthDate: Optional[str] = None  # [★] birthYear → birthDate (YYYY-MM-DD 형식)
    gender: Optional[str] = None
    skinTypeCode: Optional[str] = None

class UserProfileResponse(BaseModel):
    id: int
    name: Optional[str] = None 
    nickname: Optional[str] = None
    email: EmailStr
    birthDate: Optional[str] = None  # [★] birthYear → birthDate
    gender: Optional[str] = None
    skinType: Optional[str] = None 
    class Config:
        orm_mode = True

# --- API Router (기존과 동일) ---
router = APIRouter(
    prefix="/api/user_card",
    tags=["user_card"] 
)

# --- Helper (기존과 동일) ---
def get_skin_type_from_db(profile: Optional[UserProfile]) -> Optional[str]:
    if not profile: return None 
    if profile.skin_type_code: return profile.skin_type_code
    if not profile.skin_axes_json: return None
    try: 
        axes = json.loads(profile.skin_axes_json)
        code = (axes.get('OD', {}).get('letter', 'O') +
                axes.get('SR', {}).get('letter', 'R') +
                axes.get('PN', {}).get('letter', 'N') +
                axes.get('WT', {}).get('letter', 'T'))
        return code
    except Exception:
        return None

# --- GET API (수정) ---
@router.get("/{user_id}", response_model=UserProfileResponse)
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    try:
        result = db.query(User, UserProfile).join(
            UserProfile, User.id == UserProfile.user_id, isouter=True
        ).filter(User.id == user_id).first()
        
        if not result:
            user_only = db.query(User).filter(User.id == user_id).first()
            if user_only:
                 return UserProfileResponse(
                    id=user_only.id,
                    name=user_only.name,
                    email=user_only.email,
                )
            raise HTTPException(status_code=404, detail="사용자를 'users' 테이블에서 찾을 수 없습니다.")

        user, profile = result 
        skin_type = get_skin_type_from_db(profile)
        
        # [★] birth_date를 문자열로 변환 (YYYY-MM-DD)
        birth_date_str = None
        if profile and profile.birth_date:
            birth_date_str = profile.birth_date.strftime('%Y-%m-%d')
        
        return UserProfileResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            nickname=profile.nickname if profile else None,
            birthDate=birth_date_str,  # [★] birthYear → birthDate
            gender=profile.gender if profile else None,
            skinType=skin_type
        )
    except Exception as e:
        print(f"❌ /api/user_card/{user_id} GET 오류: {e}")
        raise HTTPException(status_code=500, detail=f"서버 오류: {e}")

# --- [★★★ PUT API 수정 ★★★] ---
@router.put("/{user_id}", response_model=UserProfileResponse)
def update_user_profile(user_id: int, profile_data: UserProfileUpdate, db: Session = Depends(get_db)):
    """
    사용자 프로필 정보 업데이트 (수정) (UPSERT 로직)
    """
    try:
        # 1. 'users' 테이블 업데이트
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="업데이트할 사용자를 'users' 테이블에서 찾을 수 없습니다.")
        
        user.name = profile_data.name
        user.email = profile_data.email
        user.updated_at = datetime.datetime.now(datetime.timezone.utc) # [★] users.updated_at도 갱신
        
        # 2. 'user_profiles' 테이블 'UPSERT'
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        
        # [★] 현재 UTC 시간 정의
        current_time_utc = datetime.datetime.now(datetime.timezone.utc)
        
        # [★] birthDate 문자열을 date 객체로 변환
        birth_date_obj = None
        if profile_data.birthDate:
            try:
                birth_date_obj = datetime.datetime.strptime(profile_data.birthDate, '%Y-%m-%d').date()
            except ValueError:
                raise HTTPException(status_code=400, detail="생년월일 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 사용하세요.")
        
        # [★] nickname이 없으면 name을 기본값으로 설정
        nickname_value = profile_data.nickname if profile_data.nickname else profile_data.name
        
        if not profile:
            # INSERT
            print(f"ℹ️ 사용자 {user_id}의 프로필이 없어 새로 생성합니다.")
            profile = UserProfile(
                user_id=user_id,
                name=profile_data.name,  # [★] 이름도 저장
                nickname=nickname_value,  # [★] nickname 없으면 name 사용
                birth_date=birth_date_obj,  # [★] birth_year → birth_date
                gender=profile_data.gender,
                skin_type_code=profile_data.skinTypeCode,
                created_at=current_time_utc, # [★] created_at 값 추가
                updated_at=current_time_utc  # [★] updated_at 값 추가
            )
            db.add(profile)
        else:
            # UPDATE
            profile.name = profile_data.name  # [★] 이름도 업데이트
            profile.nickname = nickname_value  # [★] nickname 없으면 name 사용
            profile.birth_date = birth_date_obj  # [★] birth_year → birth_date
            profile.gender = profile_data.gender
            profile.skin_type_code = profile_data.skinTypeCode
            profile.updated_at = current_time_utc # [★] updated_at 값 갱신
        
        db.commit() 
        db.refresh(user)
        db.refresh(profile)
        
        print(f"✅ 사용자 {user_id} 프로필 업데이트 성공")
        
        # [★] birth_date를 문자열로 변환하여 반환
        birth_date_str = None
        if profile.birth_date:
            birth_date_str = profile.birth_date.strftime('%Y-%m-%d')
        
        return UserProfileResponse(
            id=user.id,
            name=user.name,
            nickname=profile.nickname,
            email=user.email,
            birthDate=birth_date_str,  # [★] birthYear → birthDate
            gender=profile.gender,
            skinType=profile.skin_type_code
        )
        
    except Exception as e:
        db.rollback()
        print(f"❌ /api/user_card/{user_id} PUT 오류: {e}")
        if "Duplicate entry" in str(e):
            raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
        raise HTTPException(status_code=500, detail=f"서버 오류: {e}")