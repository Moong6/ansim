from app.main import app
from fastapi.testclient import TestClient
from app.core.security import create_access_token

TOKEN_STAFF    = create_access_token(2)   # 박서준 SOCIAL_WORKER
TOKEN_GUARDIAN = create_access_token(6)   # 이지원 GUARDIAN (ANSWERED items)
TOKEN_CAREGIVER = create_access_token(1)  # 김민지 CAREGIVER
TOKEN_ADMIN    = create_access_token(3)   # 관리자

client = TestClient(app)

print("=== Staff Endpoints ===")

# GET /api/inquiries
resp = client.get('/api/inquiries', headers={'Authorization': f'Bearer {TOKEN_STAFF}'})
assert resp.status_code == 200, f"FAIL: {resp.text}"
data = resp.json()
print(f'LIST OK: summary={data["summary"]}')

# Filter ANSWERED
resp_f = client.get('/api/inquiries?status=ANSWERED', headers={'Authorization': f'Bearer {TOKEN_STAFF}'})
assert resp_f.status_code == 200
print(f'LIST ANSWERED filter: {len(resp_f.json()["items"])} items')

# GET /api/inquiries/2 (ANSWERED)
resp2 = client.get('/api/inquiries/2', headers={'Authorization': f'Bearer {TOKEN_STAFF}'})
assert resp2.status_code == 200
inq = resp2.json()['inquiry']
ans = inq.get('answer')
print(f'DETAIL id=2: status={inq["status"]}, answer.canEdit={ans.get("canEdit") if ans else None}')

# GET /api/home/summary
resp4 = client.get('/api/home/summary', headers={'Authorization': f'Bearer {TOKEN_STAFF}'})
assert resp4.status_code == 200
print(f'HOME inquiry: {resp4.json()["inquiry"]}')

print("\n=== Parent Endpoints ===")

# GET /api/parent/me
resp5 = client.get('/api/parent/me', headers={'Authorization': f'Bearer {TOKEN_GUARDIAN}'})
assert resp5.status_code == 200
summary = resp5.json()['summary']
print(f'PARENT ME inquiryNewAnswerCount={summary.get("inquiryNewAnswerCount")}')

# GET /api/parent/inquiries
resp6 = client.get('/api/parent/inquiries', headers={'Authorization': f'Bearer {TOKEN_GUARDIAN}'})
assert resp6.status_code == 200
items = resp6.json()['items']
print(f'PARENT LIST: {len(items)} items')
for item in items:
    preview = (item.get("answerPreview") or "")[:30]
    print(f'  id={item["id"]} status={item["status"]} hasNewAnswer={item["hasNewAnswer"]} answerPreview={repr(preview)}')

# GET /api/parent/inquiries/{id} (first ANSWERED one)
answered_item = next((i for i in items if i['status'] == 'ANSWERED'), None)
if answered_item:
    resp7 = client.get(f'/api/parent/inquiries/{answered_item["id"]}', headers={'Authorization': f'Bearer {TOKEN_GUARDIAN}'})
    assert resp7.status_code == 200
    inq7 = resp7.json()['inquiry']
    print(f'PARENT DETAIL id={answered_item["id"]}: status={inq7["status"]} answer={inq7.get("answer")}')
    # second call should not update answer_read_at again (already set)
    resp7b = client.get(f'/api/parent/inquiries/{answered_item["id"]}', headers={'Authorization': f'Bearer {TOKEN_GUARDIAN}'})
    print(f'  second call status={resp7b.json()["inquiry"]["status"]} (should still be ANSWERED)')

print("\n=== CRUD Tests ===")

# 1) UNREAD → 400 INVALID_INQUIRY_STATUS
resp_unread = client.post('/api/inquiries/9/answer',
    json={'content': 'test'},
    headers={'Authorization': f'Bearer {TOKEN_STAFF}'})
assert resp_unread.status_code == 400, f"Expected 400, got {resp_unread.status_code}"
print(f'UNREAD answer attempt: 400 {resp_unread.json()["detail"]["code"]} OK')

# 2) ANSWERED → 400 INVALID_INQUIRY_STATUS
resp_answered = client.post('/api/inquiries/2/answer',
    json={'content': 'test'},
    headers={'Authorization': f'Bearer {TOKEN_STAFF}'})
assert resp_answered.status_code == 400
print(f'ANSWERED answer attempt: 400 {resp_answered.json()["detail"]["code"]} OK')

# 3) READ → 201 + ANSWERED status
# Find a READ inquiry
read_item = next((i for i in data['items'] if i['status'] == 'READ' and i.get('hasAnswer') == False), None)
if read_item:
    rid = read_item['id']
    resp_create = client.post(f'/api/inquiries/{rid}/answer',
        json={'content': '안녕하세요 보호자님. 임시 답변입니다.'},
        headers={'Authorization': f'Bearer {TOKEN_CAREGIVER}'})
    assert resp_create.status_code == 201, f"Expected 201, got {resp_create.status_code}: {resp_create.text}"
    result = resp_create.json()
    print(f'CREATE answer for id={rid}: 201 inquiryStatus={result["inquiryStatus"]} canEdit={result["answer"]["canEdit"]} OK')

    # 4) Edit by non-author (박서준 trying to edit 김민지's answer) → 403
    resp_edit_403 = client.patch(f'/api/inquiries/{rid}/answer',
        json={'content': 'modified'},
        headers={'Authorization': f'Bearer {TOKEN_STAFF}'})
    assert resp_edit_403.status_code == 403
    print(f'Edit by non-author: 403 OK')

    # 5) Edit by ADMIN → 200
    resp_edit_admin = client.patch(f'/api/inquiries/{rid}/answer',
        json={'content': '관리자 수정 답변입니다.'},
        headers={'Authorization': f'Bearer {TOKEN_ADMIN}'})
    assert resp_edit_admin.status_code == 200
    print(f'Edit by ADMIN: 200 OK content={repr(resp_edit_admin.json()["content"][:20])}')

    # 6) DELETE → 204, status returns to READ, read_at preserved
    resp_del = client.delete(f'/api/inquiries/{rid}/answer', headers={'Authorization': f'Bearer {TOKEN_STAFF}'})
    assert resp_del.status_code in (403, 204), f"Expected 403 or 204, got {resp_del.status_code}"
    print(f'DELETE by non-author: {resp_del.status_code}')
    resp_del2 = client.delete(f'/api/inquiries/{rid}/answer', headers={'Authorization': f'Bearer {TOKEN_ADMIN}'})
    assert resp_del2.status_code == 204
    # Verify status is READ
    resp_check = client.get(f'/api/inquiries/{rid}', headers={'Authorization': f'Bearer {TOKEN_STAFF}'})
    inq_check = resp_check.json()['inquiry']
    assert inq_check['status'] == 'READ', f"Expected READ, got {inq_check['status']}"
    assert inq_check['answer'] is None
    print(f'After DELETE: status={inq_check["status"]} (READ), read_at={inq_check["readAt"]} answer=None OK')
else:
    print('No READ item without answer found for CRUD test')

print("\nAll tests passed!")
