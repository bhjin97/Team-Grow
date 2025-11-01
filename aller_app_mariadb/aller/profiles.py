from sqlalchemy import text
from .storage_sql import get_engine

def upsert_profile(user_id: int, nickname=None, birth_date=None,
                   gender="na", skin_type_code=None,
                   skin_axes_json=None, preferences_json=None,
                   allergies_json=None):
    q = text("""
    INSERT INTO user_profiles
      (user_id, nickname, birth_date, gender,
       skin_type_code, skin_axes_json, preferences_json, allergies_json, last_quiz_at)
    VALUES
      (:uid, :nickname, :byear, :gender,
       :code, :axes, :prefs, :allergies, NOW())
    ON DUPLICATE KEY UPDATE
      nickname=VALUES(nickname),
      birth_date=VALUES(birth_date),
      gender=VALUES(gender),
      skin_type_code=VALUES(skin_type_code),
      skin_axes_json=VALUES(skin_axes_json),
      preferences_json=VALUES(preferences_json),
      allergies_json=VALUES(allergies_json),
      last_quiz_at=VALUES(last_quiz_at),
      updated_at=CURRENT_TIMESTAMP
    """)
    with get_engine().begin() as conn:
        conn.execute(q, {
            "uid": user_id, "nickname": nickname, "byear": birth_date, "gender": gender,
            "code": skin_type_code, "axes": skin_axes_json,
            "prefs": preferences_json, "allergies": allergies_json
        })

def get_profile(user_id: int):
    with get_engine().connect() as conn:
        return conn.execute(text("""
            SELECT user_id, nickname, birth_date, gender,
                   skin_type_code, skin_axes_json, preferences_json, allergies_json, last_quiz_at
            FROM user_profiles WHERE user_id = :uid
        """), {"uid": user_id}).mappings().fetchone()
