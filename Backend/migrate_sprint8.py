"""8차 스프린트 DB 마이그레이션"""
import psycopg

conn = psycopg.connect('host=localhost dbname=care_notice user=postgres password=devpass')
conn.autocommit = True
cur = conn.cursor()

# 1) enum 확장 (autocommit=True 상태에서 실행)
try:
    cur.execute("ALTER TYPE inquiry_status ADD VALUE 'ANSWERED'")
    print('OK: inquiry_status ANSWERED added')
except Exception as e:
    print(f'SKIP: enum - {e}')

conn.autocommit = False

# 2) inquiry.answer_read_at 컬럼 추가
try:
    cur.execute('ALTER TABLE inquiry ADD COLUMN answer_read_at TIMESTAMPTZ')
    conn.commit()
    print('OK: answer_read_at column added')
except Exception as e:
    conn.rollback()
    print(f'SKIP: answer_read_at - {e}')

# 3) inquiry_answer 테이블 생성
try:
    cur.execute("""
    CREATE TABLE inquiry_answer (
        id          BIGSERIAL PRIMARY KEY,
        inquiry_id  BIGINT NOT NULL REFERENCES inquiry(id),
        author_id   BIGINT NOT NULL REFERENCES app_user(id),
        content     TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at  TIMESTAMPTZ
    )
    """)
    conn.commit()
    print('OK: inquiry_answer table created')
except Exception as e:
    conn.rollback()
    print(f'SKIP: inquiry_answer table - {e}')

# 4) UNIQUE 부분 인덱스
try:
    cur.execute("""
    CREATE UNIQUE INDEX uq_inquiry_answer_active
        ON inquiry_answer (inquiry_id) WHERE deleted_at IS NULL
    """)
    conn.commit()
    print('OK: uq_inquiry_answer_active created')
except Exception as e:
    conn.rollback()
    print(f'SKIP: unique index - {e}')

# 5) author 인덱스
try:
    cur.execute("""
    CREATE INDEX idx_inquiry_answer_author
        ON inquiry_answer (author_id) WHERE deleted_at IS NULL
    """)
    conn.commit()
    print('OK: idx_inquiry_answer_author created')
except Exception as e:
    conn.rollback()
    print(f'SKIP: author index - {e}')

# 6) 시드: 박현우 VISIT 문의에 답변 추가
try:
    cur.execute("""
    INSERT INTO inquiry_answer (inquiry_id, author_id, content)
    VALUES (
        (SELECT id FROM inquiry WHERE content LIKE '%토요일%' LIMIT 1),
        2,
        '안녕하세요 보호자님. 토요일 오후 2시 방문 가능하십니다. 면회실에서 30분 정도 시간 마련해 두겠습니다. 따뜻한 옷차림으로 오시면 정원에서도 함께 시간 보내실 수 있습니다.'
    )
    ON CONFLICT DO NOTHING
    """)
    conn.commit()
    print('OK: seed answer inserted')
except Exception as e:
    conn.rollback()
    print(f'SKIP: seed answer - {e}')

# 7) 해당 문의 status를 ANSWERED로 업데이트
try:
    cur.execute("""
    UPDATE inquiry SET status = 'ANSWERED'
    WHERE content LIKE '%토요일%'
    """)
    conn.commit()
    print('OK: inquiry status updated to ANSWERED')
except Exception as e:
    conn.rollback()
    print(f'SKIP: status update - {e}')

cur.close()
conn.close()
print('Migration complete')
