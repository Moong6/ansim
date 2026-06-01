"""
식단표 & 앨범 사진 삽입 스크립트
- 생성된 이미지를 uploads 디렉토리에 복사
- DB의 meal_log, album 레코드에 사진 URL 업데이트
- 5/30~6/2 날짜의 빠진 식단도 INSERT
"""

import shutil
import os
from pathlib import Path
from datetime import date, datetime, timezone

# ─── 경로 설정 ────────────────────────────────────────────────────────────────
ARTIFACT_DIR = Path(r"C:\Users\yms713\.gemini\antigravity\brain\b95a0b4c-10f9-48c2-b4fe-c60a34dfc6f3")
UPLOADS_DIR = Path(r"c:\ansim\Backend\uploads")
MEALS_DIR = UPLOADS_DIR / "meals" / "2026" / "05"
ALBUMS_DIR = UPLOADS_DIR / "albums" / "2026" / "05"

# ─── 이미지 파일 매핑 ─────────────────────────────────────────────────────────
# artifact 디렉토리에서 생성된 이미지 파일 찾기
def find_image(prefix):
    """artifact 디렉토리에서 prefix로 시작하는 이미지 파일 찾기"""
    for f in ARTIFACT_DIR.iterdir():
        if f.name.startswith(prefix) and f.suffix == ".png":
            return f
    return None

MEAL_IMAGES = {
    "breakfast_1": find_image("meal_breakfast_1"),
    "breakfast_2": find_image("meal_breakfast_2"),
    "lunch_1": find_image("meal_lunch_1"),
    "lunch_2": find_image("meal_lunch_2"),
    "dinner_1": find_image("meal_dinner_1"),
    "dinner_2": find_image("meal_dinner_2"),
    "snack_1": find_image("meal_snack_1"),
    "snack_2": find_image("meal_snack_2"),
}

ALBUM_IMAGES = {
    "exercise": find_image("album_exercise"),
    "art": find_image("album_art"),
    "music": find_image("album_music"),
    "garden": find_image("album_garden"),
    "birthday": find_image("album_birthday"),
    "craft": find_image("album_craft"),
}

# ─── 1단계: 이미지 파일 복사 ──────────────────────────────────────────────────
print("=" * 60)
print("1단계: 이미지 파일 복사")
print("=" * 60)

MEALS_DIR.mkdir(parents=True, exist_ok=True)
ALBUMS_DIR.mkdir(parents=True, exist_ok=True)

# 식단 이미지 복사
meal_file_map = {}
for key, src in MEAL_IMAGES.items():
    if src and src.exists():
        dest_name = f"meal_{key}.png"
        dest = MEALS_DIR / dest_name
        shutil.copy2(src, dest)
        # URL은 /static/meals/2026/05/meal_xxx.png 형태
        url = f"/static/meals/2026/05/{dest_name}"
        meal_file_map[key] = url
        print(f"  [OK] {key} -> {dest}")
    else:
        print(f"  [FAIL] {key}: 소스 파일 없음")

# 앨범 이미지 복사
album_file_map = {}
for key, src in ALBUM_IMAGES.items():
    if src and src.exists():
        dest_name = f"album_{key}.png"
        dest = ALBUMS_DIR / dest_name
        shutil.copy2(src, dest)
        url = f"/static/albums/2026/05/{dest_name}"
        album_file_map[key] = url
        print(f"  [OK] {key} -> {dest}")
    else:
        print(f"  [FAIL] {key}: source not found")

print(f"\n식단 이미지: {len(meal_file_map)}장, 앨범 이미지: {len(album_file_map)}장")

# ─── 2단계: DB 업데이트 SQL 생성 ──────────────────────────────────────────────
print("\n" + "=" * 60)
print("2단계: DB 업데이트 SQL 생성")
print("=" * 60)

now_iso = datetime.now(tz=timezone.utc).isoformat()

# 날짜별 식단 사진 배분 (홀짝으로 이미지 1/2 번갈아 사용)
# 5/23~5/29 기존 데이터 업데이트 + 5/30~6/2 새 데이터 INSERT
sql_statements = []

# === 기존 식단 사진 UPDATE (5/23 ~ 5/29) ===
existing_dates = []
d = date(2026, 5, 23)
end = date(2026, 5, 30)
while d < end:
    existing_dates.append(d)
    d = d.replace(day=d.day + 1)

for i, dt in enumerate(existing_dates):
    ds = dt.isoformat()
    # 홀짝으로 이미지 번호 결정
    img_idx = "1" if i % 2 == 0 else "2"

    bf_url = meal_file_map.get(f"breakfast_{img_idx}", "")
    lu_url = meal_file_map.get(f"lunch_{img_idx}", "")
    di_url = meal_file_map.get(f"dinner_{img_idx}", "")
    sn_url = meal_file_map.get(f"snack_{img_idx}", "")

    for meal_type, url in [("BREAKFAST", bf_url), ("LUNCH", lu_url), ("DINNER", di_url), ("SNACK", sn_url)]:
        if url:
            photos_json = f'[{{"url":"{url}","uploadedAt":"{now_iso}"}}]'
            sql = f"UPDATE meal_log SET photos = '{photos_json}'::jsonb WHERE meal_date = '{ds}' AND meal_type = '{meal_type}' AND deleted_at IS NULL;"
            sql_statements.append(sql)

# === 새 식단 INSERT (5/30 ~ 6/2) ===
new_meals_data = [
    # (날짜, meal_type, menu_text, img_key)
    ("2026-05-30", "BREAKFAST", "현미잡곡밥\n시원한 북어국\n고소한 두부부침\n김자반볶음\n배추김치", "breakfast_1"),
    ("2026-05-30", "LUNCH", "현미잡곡밥\n맑은 소갈비탕\n적어 구이\n무청 시래기 조림\n총각김치", "lunch_1"),
    ("2026-05-30", "DINNER", "잡곡밥\n비지찌개\n삼치 엿장구이\n청경채무침\n깍두기", "dinner_1"),
    ("2026-05-30", "SNACK", "생바나나\n마시는 요거트", "snack_1"),

    ("2026-05-31", "BREAKFAST", "흰쌀밥\n맑은 아욱국\n부드러운 계란찜\n시금치나물\n깍두기", "breakfast_2"),
    ("2026-05-31", "LUNCH", "흰쌀밥\n소고기 미역국\n고등어 구이\n애호박 나물볶음\n겉절이 김치", "lunch_2"),
    ("2026-05-31", "DINNER", "보리잡곡밥\n순두부 백탕\n돈육 감자조림\n참나물무침\n배추김치", "dinner_2"),
    ("2026-05-31", "SNACK", "달콤한 단호박죽\n따뜻한 우유", "snack_2"),

    ("2026-06-01", "BREAKFAST", "영양 야채죽\n계란국\n연두부 양념장\n숙주나물무침\n백김치", "breakfast_1"),
    ("2026-06-01", "LUNCH", "영양 곤드레밥\n구수한 배추된장국\n단호박 돼지갈비찜\n콩나물무침\n배추김치", "lunch_1"),
    ("2026-06-01", "DINNER", "흰쌀밥\n버섯 들깨탕\n야채 버섯불고기\n도라지나물볶음\n배추김치", "dinner_1"),
    ("2026-06-01", "SNACK", "노란 군고구마\n새콤달콤 매실차", "snack_1"),

    ("2026-06-02", "BREAKFAST", "현미잡곡밥\n시원한 북어국\n고소한 두부부침\n김자반볶음\n배추김치", "breakfast_2"),
    ("2026-06-02", "LUNCH", "현미잡곡밥\n맑은 소갈비탕\n적어 구이\n무청 시래기 조림\n총각김치", "lunch_2"),
    ("2026-06-02", "DINNER", "잡곡밥\n비지찌개\n삼치 엿장구이\n청경채무침\n깍두기", "dinner_2"),
    ("2026-06-02", "SNACK", "생바나나\n마시는 요거트", "snack_2"),
]

for meal_date, meal_type, menu_text, img_key in new_meals_data:
    url = meal_file_map.get(img_key, "")
    photos_json = f'[{{"url":"{url}","uploadedAt":"{now_iso}"}}]' if url else "[]"
    # Escape newlines and single quotes in menu_text for SQL
    menu_escaped = menu_text.replace("'", "''")
    sql = (
        f"INSERT INTO meal_log (facility_id, author_id, meal_date, meal_type, menu_text, photos, created_at, updated_at) "
        f"VALUES (1, 2, '{meal_date}', '{meal_type}', E'{menu_escaped}', "
        f"'{photos_json}'::jsonb, '{now_iso}', '{now_iso}') "
        f"ON CONFLICT DO NOTHING;"
    )
    sql_statements.append(sql)

# === 앨범 업데이트 + 새 앨범 INSERT ===
# 기존 앨범 (id=4, 5월 생일 축하) 사진 업데이트
if "birthday" in album_file_map:
    birthday_url = album_file_map["birthday"]
    craft_url = album_file_map.get("craft", "")
    photos_json = f'[{{"url":"{birthday_url}","uploadedAt":"{now_iso}"}},{{"url":"{craft_url}","uploadedAt":"{now_iso}"}}]'
    sql_statements.append(f"UPDATE album SET photos = '{photos_json}'::jsonb WHERE id = 4;")

# 새 앨범 INSERT
new_albums = [
    ("2026-05-23", "봄 나들이 산책", "따뜻한 봄날, 어르신들과 함께 시설 정원을 산책했습니다.", ["garden"]),
    ("2026-05-26", "실버 체조 교실", "전문 강사와 함께 어르신 맞춤 스트레칭 프로그램을 진행했습니다.", ["exercise"]),
    ("2026-05-28", "미술 치료 활동", "수채화 꽃 그리기로 어르신들의 감성을 자극하는 시간을 가졌습니다.", ["art", "craft"]),
    ("2026-05-30", "음악 치료 시간", "익숙한 노래를 함께 부르며 즐거운 음악 치료 시간을 보냈습니다.", ["music"]),
    ("2026-06-01", "6월 맞이 정원 산책", "6월 첫날을 맞아 어르신들과 정원에서 신선한 공기를 마셨습니다.", ["garden", "exercise"]),
]

for a_date, a_title, a_desc, a_img_keys in new_albums:
    photos_arr = []
    for k in a_img_keys:
        if k in album_file_map:
            photos_arr.append(f'{{"url":"{album_file_map[k]}","uploadedAt":"{now_iso}"}}')
    photos_json = "[" + ",".join(photos_arr) + "]"
    a_desc_escaped = a_desc.replace("'", "''")
    a_title_escaped = a_title.replace("'", "''")
    sql = (
        f"INSERT INTO album (facility_id, author_id, activity_date, title, description, photos, created_at, updated_at) "
        f"VALUES (1, 2, '{a_date}', '{a_title_escaped}', '{a_desc_escaped}', "
        f"'{photos_json}'::jsonb, '{now_iso}', '{now_iso}');"
    )
    sql_statements.append(sql)

# 앨범-어르신 연결 (album_resident) - 새 앨범에 어르신 배정
# 마지막 5개 INSERT된 앨범의 ID를 알기 위해 subquery 사용
# 간단하게: 모든 어르신(1,2,3)을 새 앨범에 연결
album_resident_sql = """
INSERT INTO album_resident (album_id, resident_id)
SELECT a.id, r.id
FROM album a
CROSS JOIN resident r
WHERE r.facility_id = 1
  AND r.deleted_at IS NULL
  AND a.facility_id = 1
  AND a.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM album_resident ar WHERE ar.album_id = a.id AND ar.resident_id = r.id)
ON CONFLICT DO NOTHING;
"""
sql_statements.append(album_resident_sql)

# ─── 3단계: SQL 파일 저장 & 실행 ──────────────────────────────────────────────
sql_path = Path(r"c:\ansim\Backend\insert_photos.sql")
with open(sql_path, "w", encoding="utf-8") as f:
    for stmt in sql_statements:
        f.write(stmt + "\n")

print(f"\nSQL 파일 저장: {sql_path}")
print(f"총 SQL 문: {len(sql_statements)}개")
print("\n다음 명령어로 DB에 적용하세요:")
print(f'docker exec -i care-postgres psql -U postgres -d care_notice < "{sql_path}"')
