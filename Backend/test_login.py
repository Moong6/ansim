"""백엔드 로그인 직접 테스트"""
import sys
sys.path.insert(0, ".")

from app.db.session import SessionLocal
from app.models.models import AppUser
from app.core.security import verify_password, create_access_token
from sqlalchemy import select

db = SessionLocal()
try:
    user = db.scalars(
        select(AppUser).where(AppUser.email == "boram@family.kr").where(AppUser.deleted_at.is_(None))
    ).first()
    
    if user is None:
        print("ERROR: user not found")
    else:
        print(f"User found: id={user.id}, name={user.name}, role={user.role}")
        print(f"Hash: {user.password_hash[:30]}...")
        
        try:
            result = verify_password("test1234", user.password_hash)
            print(f"Password verify: {result}")
        except Exception as e:
            print(f"Password verify ERROR: {e}")
        
        try:
            # Check facility relationship
            print(f"Facility: {user.facility}")
            print(f"Facility id: {user.facility_id}")
        except Exception as e:
            print(f"Facility ERROR: {e}")
            
        try:
            token = create_access_token(user.id)
            print(f"Token created: {token[:30]}...")
        except Exception as e:
            print(f"Token ERROR: {e}")

except Exception as e:
    print(f"GENERAL ERROR: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
