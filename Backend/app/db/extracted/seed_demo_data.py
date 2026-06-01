import os
import sys
import random
import json
from datetime import date, datetime, time, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session

# Add the Backend directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.db.session import SessionLocal
from app.models.models import Facility, AppUser, Resident, Guardian, Program, Assignment, Notice, NoticeTone, NoticeStatus
from app.models.report import Report
from app.models.board import NoticeBoard
from app.models.meal_schedule import MealLog, ScheduleEvent, MealType, ScheduleEventType
from app.models.inquiry import Inquiry, InquiryCategory, InquiryStatus, ClassificationStatus

def seed_data():
    db: Session = SessionLocal()
    try:
        print("Cleaning existing demo data...")
        # Clean existing demo tables (CASCADE preserves static records in other tables)
        db.execute(text("TRUNCATE TABLE report, notice, inquiry, meal_log, schedule_event, program, notice_board RESTART IDENTITY CASCADE;"))
        db.commit()
        print("Clean complete.")

        # ---------------------------------------------------------
        # 1. Seed Programs (공동 프로그램)
        # ---------------------------------------------------------
        print("Seeding programs...")
        start_date = date(2026, 5, 1)
        end_date = date(2026, 6, 30)
        current = start_date
        
        programs_dict = {} # date -> list of Program
        
        morning_titles = [
            "치매 예방 인지 훈련 🧩",
            "실버 건강 스트레칭 체조 🧘‍♀️",
            "오감 만족 미술 치료 미술 활동 🎨",
            "정서 원예 치료 꽃꽂이 🌸",
            "신나는 실버 노래 교실 🎶"
        ]
        morning_descriptions = [
            "어르신들의 뇌 활동을 자극하고 집중력을 높이는 퍼즐 및 퍼즐 게임을 진행했습니다.",
            "전신 근육을 이완하고 혈액 순환을 돕는 가벼운 맨손 체조 활동을 진행했습니다.",
            "색종이와 점토를 활용해 소근육 발달과 창의성을 자극하는 창작 활동을 진행했습니다.",
            "허브 식물을 심고 가꾸며 심리적 안정과 자연 교감을 돕는 활동을 진행했습니다.",
            "추억의 가요와 민요를 따라 부르며 스트레스를 해소하고 폐활량을 높였습니다."
        ]
        
        afternoon_titles = [
            "두뇌 자극 보드게임 🎲",
            "건강 아로마 발 마사지 🦶",
            "추억 회상 음악 감상 📻",
            "소근육 발달 종이접기 교실 📄",
            "전통 다도 명상 시간 🍵"
        ]
        afternoon_descriptions = [
            "집중력과 전략적 사고를 유도하는 가벼운 카드 매칭 및 보드게임을 진행했습니다.",
            "아로마 오일을 사용해 피로를 풀고 어르신들의 숙면을 돕는 발 마사지 치료를 진행했습니다.",
            "어린 시절 불렀던 옛 동요와 흘러간 옛 노래를 들으며 정서적 안정을 유도했습니다.",
            "학, 배, 비행기 등 종이 접기 활동을 통해 눈과 손의 협응력을 향상했습니다.",
            "따뜻한 녹차와 함께 명상을 하며 한 주의 긴장을 풀고 차분히 마음을 다스렸습니다."
        ]

        while current <= end_date:
            weekday = current.weekday()
            programs_dict[current] = []
            
            if weekday < 5:  # Mon - Fri
                # Morning Program
                idx1 = weekday % len(morning_titles)
                p1 = Program(
                    facility_id=1,
                    program_date=current,
                    start_time=time(10, 0),
                    title=morning_titles[idx1],
                    description=morning_descriptions[idx1]
                )
                db.add(p1)
                programs_dict[current].append(p1)
                
                # Afternoon Program
                idx2 = weekday % len(afternoon_titles)
                p2 = Program(
                    facility_id=1,
                    program_date=current,
                    start_time=time(14, 0),
                    title=afternoon_titles[idx2],
                    description=afternoon_descriptions[idx2]
                )
                db.add(p2)
                programs_dict[current].append(p2)
            else:  # Sat - Sun
                # Weekend Program
                if weekday == 5:
                    p = Program(
                        facility_id=1,
                        program_date=current,
                        start_time=time(14, 0),
                        title="주말 명작 극장 시네마 데이 🎬",
                        description="어르신들이 좋아하시는 고전 영화를 대형 스크린으로 상영하고 간식을 즐겼습니다."
                    )
                else:
                    p = Program(
                        facility_id=1,
                        program_date=current,
                        start_time=time(14, 0),
                        title="원내 가벼운 휴식 및 개별 면회 🍀",
                        description="한 주를 마무리하며 클래식 음악을 감상하고, 개별 휴식과 보호자 면회를 지원했습니다."
                    )
                db.add(p)
                programs_dict[current].append(p)
                
            current += timedelta(days=1)
        
        db.commit()
        print("Programs seeded.")

        # ---------------------------------------------------------
        # 2. Seed Meals (식단표)
        # ---------------------------------------------------------
        print("Seeding meals...")
        meal_start = date(2026, 5, 4)
        meal_end = date(2026, 5, 29) # Up to today
        current = meal_start
        
        breakfast_menus = [
            "흰쌀밥\n맑은 아욱국\n부드러운 계란찜\n시금치나물\n깍두기",
            "영양 야채죽\n계란국\n연두부 양념장\n숙주나물무침\n백김치",
            "현미잡곡밥\n시원한 북어국\n고소한 두부부침\n김자반볶음\n배추김치"
        ]
        
        lunch_menus = [
            "흰쌀밥\n소고기 미역국\n고등어 구이\n애호박 나물볶음\n겉절이 김치",
            "영양 곤드레밥\n구수한 배추된장국\n단호박 돼지갈비찜\n콩나물무침\n배추김치",
            "현미잡곡밥\n맑은 소갈비탕\n적어 구이\n무청 시래기 조림\n총각김치"
        ]
        
        dinner_menus = [
            "보리잡곡밥\n순두부 백탕\n돈육 감자조림\n참나물무침\n배추김치",
            "흰쌀밥\n버섯 들깨탕\n야채 버섯불고기\n도라지나물볶음\n배추김치",
            "잡곡밥\n비지찌개\n삼치 엿장구이\n청경채무침\n깍두기"
        ]
        
        snack_menus = [
            "달콤한 단호박죽\n따뜻한 우유",
            "노란 군고구마\n새콤달콤 매실차",
            "생바나나\n마시는 요거트"
        ]

        photo_samples = [
            [{"url": "/static/meals/sample/lunch_sample.jpg", "uploadedAt": "2026-05-27T12:00:00+09:00"}],
            [{"url": "/static/meals/sample/lunch_sample2.jpg", "uploadedAt": "2026-05-26T12:00:00+09:00"}],
            []
        ]

        while current <= meal_end:
            day_idx = current.day % 3
            
            # Breakfast
            db.add(MealLog(
                facility_id=1,
                author_id=2, # 박서준 (Social Worker)
                meal_date=current,
                meal_type=MealType.BREAKFAST,
                menu_text=breakfast_menus[day_idx],
                photos=[]
            ))
            
            # Lunch
            db.add(MealLog(
                facility_id=1,
                author_id=2,
                meal_date=current,
                meal_type=MealType.LUNCH,
                menu_text=lunch_menus[day_idx],
                photos=photo_samples[day_idx]
            ))
            
            # Dinner
            db.add(MealLog(
                facility_id=1,
                author_id=2,
                meal_date=current,
                meal_type=MealType.DINNER,
                menu_text=dinner_menus[day_idx],
                photos=[]
            ))
            
            # Snack
            db.add(MealLog(
                facility_id=1,
                author_id=2,
                meal_date=current,
                meal_type=MealType.SNACK,
                menu_text=snack_menus[day_idx],
                photos=[]
            ))
            
            current += timedelta(days=1)
            
        db.commit()
        print("Meals seeded.")

        # ---------------------------------------------------------
        # 3. Seed Daily Notices (일간 알림장)
        # ---------------------------------------------------------
        print("Seeding notices...")
        notice_start = date(2026, 5, 4)
        notice_end = date(2026, 6, 1) # Full range requested
        
        residents = db.query(Resident).filter(Resident.id.in_([1, 2, 3])).all()
        resident_map = {r.id: r for r in residents}
        
        # We need to construct realistic templates for each resident.
        # Resident 1: 김순자 (당뇨, 인지저하)
        # Resident 2: 이복남 (고혈압)
        # Resident 3: 박정호 (와상, 휠체어 사용) - CRITICAL SAFETY RULES (no walking/standing references)

        r1_templates = [
            {
                "memo": "점심 식사 맛있게 다 비우셨고, 손녀 자랑 많이 하심. 인지 치료 때 집중 잘 하셨습니다.",
                "draftA": "안녕하세요 보호자님! 오늘 순자 어르신께서는 오전 인지치료 프로그램에 참여하셔서 예쁜 색칠공부를 하셨습니다. 🎨 집중하시는 모습이 참 아름다우셨어요. 점심 식사로 나온 소고기미역국을 무척 좋아하셔서 한 그릇을 깨끗이 다 비우셨습니다. 😊 오후에는 손녀분 자랑을 끊임없이 하시는 모습에서 깊은 사랑과 애정을 느낄 수 있었습니다. 행복하고 평온한 하루를 보내셨습니다. 💕",
                "draftB": "보호자님 안녕하세요! 😊 순자 어르신의 오늘 소식을 전해드립니다. 오늘 인지 훈련 시간에 다른 어르신들과 도란도란 이야기를 나누며 활발히 참여하셨습니다. 점심도 든든히 드셨고 식사 후 혈당 수치도 매우 안정적으로 조절되었습니다. 👍 오후에는 손녀분 이야기를 하시며 얼굴 가득 밝은 미소를 지으셨습니다. 즐거운 저녁 되세요. 😊",
                "draftC": "순자 어르신 보호자님께 인사드립니다. 🌸 오늘 어르신께서는 인지 퍼즐 훈련을 하시며 높은 성취감을 느끼셨습니다. 🧩 요즘 손녀분 생각을 많이 하시는지 관련 추억담을 들려주시는 목소리가 무척 활기찼습니다. 식사도 잘 하셨고 건강 상태도 이상 없이 아주 양호하십니다. 편안한 밤 보내시기 바랍니다. 💖"
            },
            {
                "memo": "체조 동작을 잘 따라 하셨고, 혈당 조절도 안정적입니다. 간식 단호박죽을 좋아하셨어요.",
                "draftA": "보호자님 안녕하세요! ☀️ 오늘 순자 어르신께서는 실버 체조 시간에 어깨와 팔을 가볍게 움직이시며 적극적으로 참여해 주셨습니다. 💪 혈당도 당뇨 기준치 이내로 잘 유지되어 건강 상태가 매우 우수합니다. 간식으로 나온 달콤한 단호박죽을 크게 좋아하셔서 맛있게 드셨습니다. 😊 늘 건강에 힘쓰고 있으니 안심하셔도 좋습니다. 🍀",
                "draftB": "안녕하세요 보호자님! 오늘 순자 어르신께서는 실버 체조 활동으로 하루를 활기차게 시작하셨습니다. 🧘‍♀️ 굳어있던 몸을 쭉쭉 펴시며 시원해하셨어요. 당뇨식 간식으로 챙겨드린 단호박죽을 참 맛있게 드셔 주셔서 바라보는 직원들도 기뻤습니다. 혈당도 규칙적으로 잘 검사 중입니다. 💖",
                "draftC": "순자 어르신의 하루 소식입니다. 😊 오늘 어르신께서는 아침 실버 스트레칭에 성실하게 함께하셨습니다. 당뇨 예방을 위해 철저한 간식 제어가 이루어졌고, 만족스럽게 단호박죽을 즐기셨습니다. 🥣 건강 수치 모두 양호하시며 평온하게 휴식을 취하고 계십니다. 따뜻한 하루 보내세요! ✨"
            }
        ]

        r2_templates = [
            {
                "memo": "혈압 정상 유지됨. 노래 교실에서 마이크 잡고 박수치며 즐겁게 부르셨습니다.",
                "draftA": "안녕하세요 보호자님! 😊 오늘 복남 어르신께서는 오후 노래교실에서 가장 앞장서서 활약해 주셨습니다. 🎶 평소 즐겨 부르시던 노래가 흘러나오자 마이크를 두 손으로 잡고 박수치며 노래를 불러주셔서 교실 분위기가 아주 밝아졌습니다. 혈압도 정상적으로 잘 조절되고 있으며, 컨디션도 최상이십니다. 기분 좋은 하루 보내세요! 👍",
                "draftB": "보호자님 안녕하세요! 🌸 복남 어르신의 오늘 소식입니다. 오늘 노래교실에서 옛 추억에 잠겨 함박웃음을 지으시며 노래를 열정적으로 소화하셨습니다. 🎤 지켜보는 요양사들에게도 큰 웃음을 선물해 주셨어요. 혈압과 체온 모두 정상이시며 기분이 매우 좋으셨습니다. 💖",
                "draftC": "복남 어르신 보호자님 안녕하세요. 😊 어르신께서는 오늘 노래 부르기 활동에서 남다른 목소리로 다 함께 노래를 부르는 등 활기찬 모습이 두드러진 하루였습니다. 🎶 고혈압 관리 약도 정확하게 챙겨 드셨으며, 편안하게 저녁 휴식을 맞이하고 계십니다. 감사합니다. ✨"
            },
            {
                "memo": "원예 치료 시간에 화분에 흙을 잘 채워주셨습니다. 혈압도 안정적이고 점심 생선구이를 다 드셨습니다.",
                "draftA": "안녕하세요 보호자님! 오늘 복남 어르신께서는 원예 치료 꽃꽂이 활동에 매우 섬세하게 참여해 주셨습니다. 🌸 화분에 조심스럽게 흙을 채우고 예쁜 꽃을 정성껏 심어주셨어요. 점심 식사로 차려진 생선구이 반찬도 뼈를 잘 발라 무척 맛있게 드셨습니다. 😊 혈압 수치도 지극히 양호하며 평온히 잘 계십니다. 🍀",
                "draftB": "보호자님 안녕하세요! 😊 오늘 복남 어르신은 요양원 마당의 작은 식물 화분을 꾸미는 원예 미술 시간에 참여하셨습니다. 🌱 초록 흙을 만지며 예전 정원을 가꾸던 때가 생각나신다며 밝게 웃으셨습니다. 식사도 생선 구이와 함께 다 드셨고 혈압약 복용도 완수하셨습니다. 💖",
                "draftC": "복남 어르신 소식 전해드립니다. ✨ 오늘 어르신은 원예 프로그램에서 흙과 식물을 보며 마음의 치유를 받는 평화로운 시간을 보냈습니다. 🪴 입맛이 좋으셨는지 생선구이를 남김없이 드시며 식사도 성공적으로 마치셨습니다. 신체 기능 및 혈압 모두 모니터링상 안정 상태이십니다. 🌟"
            }
        ]

        r3_templates = [
            {
                "memo": "침상에서 가벼운 스트레칭 도와드렸습니다. 휠체어를 타고 거실에서 티비 보시며 미소를 지으셨습니다. 식사는 보통이었습니다.",
                "draftA": "보호자님 안녕하세요. 😊 오늘 정호 어르신께서는 침상에서 요양사의 지도 아래 손목과 다리 근육의 굳어짐을 방지하는 부드러운 침상 관절 스트레칭을 편안하게 받으셨습니다. 🧘‍♂️ 오후에는 안전하게 휠체어로 거실로 이동하셔서 어르신들과 함께 재미있는 텔레비전을 시청하며 환하게 미소를 보여주셨습니다. 📺 식사도 한 공기 보통 양으로 편안하게 다 소화하셨습니다. 평온한 하루를 보내셨습니다. 🍀",
                "draftB": "안녕하세요 보호자님! 정호 어르신의 소식입니다. ✨ 오늘 오전에는 침대 위에서 근육이 굳지 않도록 가벼운 전신 이완 스트레칭을 꼼꼼하게 지원해 드렸습니다. 오후에는 휠체어에 탑승하셔 거실 넓은 공간에서 편하게 휴식을 취하시고, 정겨운 TV 방송을 감상하셨습니다. 식사와 투약도 잘 완료하셨습니다. 💖",
                "draftC": "정호 어르신 보호자님께 소식 드립니다. 😊 어르신께서는 오늘 침상 휴식을 넉넉히 취하시며 부드러운 손마사지와 스트레칭 치료를 편안히 즐기셨습니다. 오후 간식 시간 즈음에는 휠체어를 타고 창가를 바라보며 바깥 풍경을 조용히 관찰하셨습니다. 📻 소화 상태와 체온 모두 정상 범주에 있습니다. 편안한 시간 보내세요. 🌸"
            },
            {
                "memo": "관절 마사지 도중 시원해 하셨고, 휠체어를 타고 다도 명상 프로그램에 참여하여 음악을 잘 들으셨습니다.",
                "draftA": "보호자님 안녕하세요. 🍵 오늘 정호 어르신께서는 굳어 있는 어깨와 다리 근육을 풀어드리는 침상 관절 마사지 시간에 무척 시원해하시며 편안한 표정을 지어주셨습니다. 😊 오후에는 휠체어로 다도 명상실로 이동하여 따뜻한 찻잔의 향을 느끼시며 조용히 흐르는 한옥 음악을 귀 기울여 들으셨습니다. 식사도 잘 소화하셨고 건강히 지내고 계십니다. 💖",
                "draftB": "안녕하세요 보호자님! 😊 오늘 정호 어르신은 휠체어를 이용하여 찻잔의 온도와 음악을 공유하는 다도 프로그램에 차분히 동행하셨습니다. 프로그램 진행 내내 평화롭게 클래식 음율을 감상하셨습니다. 🎶 물리치료사의 세심한 관절 마사지도 제공해 드렸는데 미소를 띠며 호응해 주셨습니다. 건강한 저녁 되시기 바랍니다. 🍀",
                "draftC": "정호 어르신 보호자님께 안부 전합니다. 🌸 오늘 어르신은 침상 위에서 개인 어깨 마사지 케어를 받으시며 시원한 휴식을 즐기셨습니다. 오후 프로그램에는 편안한 휠체어를 사용해 차를 우려 마시며 전통 음악을 함께 경청하셨습니다. 식욕과 소화 모두 양호하며 규칙적인 케어가 이어졌습니다. ✨"
            }
        ]

        current = notice_start
        notices_list = [] # to collect for weekly reports
        
        while current <= notice_end:
            day_idx = current.day % 2
            
            # 1. Resident 1 (김순자)
            temp1 = r1_templates[day_idx]
            n1 = Notice(
                resident_id=1,
                author_id=1, # 김민지
                root_notice_id=None,
                version=1,
                structured_status={
                    "health": "GOOD" if current.day % 4 != 0 else "NORMAL",
                    "mood": "GOOD" if current.day % 5 != 0 else "NORMAL",
                    "meal": "FULL" if current.day % 3 == 0 else ("NORMAL" if current.day % 3 == 1 else "LITTLE"),
                    "medication": "DONE"
                },
                participated_programs=[{
                    "program_id": p.id,
                    "title": p.title,
                    "start_time": p.start_time.strftime("%H:%M")
                } for p in programs_dict.get(current, [])],
                raw_memo=temp1["memo"],
                tone=NoticeTone.POLITE,
                ai_generated_texts=[
                    {"index": 0, "label": "A", "text": temp1["draftA"]},
                    {"index": 1, "label": "B", "text": temp1["draftB"]},
                    {"index": 2, "label": "C", "text": temp1["draftC"]}
                ],
                selected_draft_index=0,
                is_refined=False,
                final_polished_text=temp1["draftA"],
                status=NoticeStatus.SENT,
                is_edited=False,
                sent_at=datetime.combine(current, time(17, 0, 0)),
                read_at=datetime.combine(current, time(19, 30, 0)) if current <= date(2026, 5, 29) else None
            )
            db.add(n1)
            notices_list.append(n1)
            
            # 2. Resident 2 (이복남)
            temp2 = r2_templates[day_idx]
            n2 = Notice(
                resident_id=2,
                author_id=1,
                root_notice_id=None,
                version=1,
                structured_status={
                    "health": "GOOD" if current.day % 3 != 0 else "NORMAL",
                    "mood": "GOOD" if current.day % 4 != 0 else "NORMAL",
                    "meal": "FULL" if current.day % 2 == 0 else "NORMAL",
                    "medication": "DONE"
                },
                participated_programs=[{
                    "program_id": p.id,
                    "title": p.title,
                    "start_time": p.start_time.strftime("%H:%M")
                } for p in programs_dict.get(current, [])],
                raw_memo=temp2["memo"],
                tone=NoticeTone.POLITE,
                ai_generated_texts=[
                    {"index": 0, "label": "A", "text": temp2["draftA"]},
                    {"index": 1, "label": "B", "text": temp2["draftB"]},
                    {"index": 2, "label": "C", "text": temp2["draftC"]}
                ],
                selected_draft_index=0,
                is_refined=False,
                final_polished_text=temp2["draftA"],
                status=NoticeStatus.SENT,
                is_edited=False,
                sent_at=datetime.combine(current, time(17, 10, 0)),
                read_at=datetime.combine(current, time(19, 45, 0)) if current <= date(2026, 5, 29) else None
            )
            db.add(n2)
            notices_list.append(n2)
            
            # 3. Resident 3 (박정호 - 와상 환자)
            temp3 = r3_templates[day_idx]
            n3 = Notice(
                resident_id=3,
                author_id=1,
                root_notice_id=None,
                version=1,
                structured_status={
                    "health": "GOOD" if current.day % 5 != 0 else "NEEDS_OBSERVATION",
                    "mood": "GOOD" if current.day % 4 != 0 else "NORMAL",
                    "meal": "NORMAL" if current.day % 2 == 0 else "LITTLE",
                    "medication": "DONE"
                },
                participated_programs=[{
                    "program_id": p.id,
                    "title": p.title,
                    "start_time": p.start_time.strftime("%H:%M")
                } for p in programs_dict.get(current, [])],
                raw_memo=temp3["memo"],
                tone=NoticeTone.POLITE,
                ai_generated_texts=[
                    {"index": 0, "label": "A", "text": temp3["draftA"]},
                    {"index": 1, "label": "B", "text": temp3["draftB"]},
                    {"index": 2, "label": "C", "text": temp3["draftC"]}
                ],
                selected_draft_index=0,
                is_refined=False,
                final_polished_text=temp3["draftA"],
                status=NoticeStatus.SENT,
                is_edited=False,
                sent_at=datetime.combine(current, time(17, 20, 0)),
                read_at=datetime.combine(current, time(20, 0, 0)) if current <= date(2026, 5, 29) else None
            )
            db.add(n3)
            notices_list.append(n3)
            
            current += timedelta(days=1)
            
        db.commit()
        print("Notices seeded.")

        # ---------------------------------------------------------
        # 4. Seed Weekly Reports (주간 안심 리포트)
        # ---------------------------------------------------------
        print("Seeding weekly reports...")
        # Weeks boundaries
        weeks = [
            (date(2026, 5, 4), date(2026, 5, 10)),
            (date(2026, 5, 11), date(2026, 5, 17)),
            (date(2026, 5, 18), date(2026, 5, 24)),
            (date(2026, 5, 25), date(2026, 5, 31))
        ]

        # Let's generate weekly summaries for Resident 1, 2, 3
        # Emphasize safety rule for Resident 3
        r1_weekly_texts = [
            "이번 주 순자 어르신께서는 대부분 기분이 매우 좋으셨고 식사도 만족스럽게 드셨습니다. 😊 인지 치료와 미술 활동에 몰입하며 활력을 보이셨고, 🎨 면회 때마다 즐거운 웃음을 띠며 한 주를 보내셨습니다. 혈당도 인슐린 및 식이 조절을 통해 정상 범위로 철저히 유지 중이오니 안심하셔도 괜찮습니다. 늘 평온하고 복되게 모시겠습니다. 💖",
            "이번 주 순자 어르신은 실버체조에 참여하여 손끝과 발끝 근육을 성실하게 강화하셨습니다. 💪 간식으로 챙겨주신 견과류와 과일을 건강하게 나누어 드시며 규칙적인 식생활을 이어가셨습니다. 경증 인지 증상에 대한 집중 케어를 동반하여 동료들과 따뜻한 담소를 많이 나누셨습니다. 늘 행복한 케어에 힘쓰겠습니다. 🍀",
            "순자 어르신께서는 이번 한 주 동안 미술 공예 프로그램에서 독창적인 종이 작품을 장식하며 창의력을 발휘하셨습니다. 🎨 식욕도 좋으셔서 남김없이 영양 가득한 식사들을 즐기셨고, 어르신들과의 소통에서도 항상 부드러운 리더십을 보이셨습니다. 안전하고 건강한 건강 상태를 유지하고 계십니다. 감사합니다! 😊",
            "5월 마지막 주 순자 어르신의 종합 리포트입니다. 🌱 한 주 내내 매일 아침 체조에 기쁘게 참석해 주시며 가벼운 운동으로 시작하셨습니다. 식단 조절도 차분히 이루어져 당뇨 관련 혈당 체크가 매번 평온한 수준으로 관리되었습니다. 사랑하는 손녀 자랑으로 모두에게 긍정의 에너지를 듬뿍 전해주셨습니다. 항상 평온함 속에 모시겠습니다. 💖"
        ]

        r2_weekly_texts = [
            "이번 주 복남 어르신께서는 노래교실과 다도 프로그램에 참여하여 우수한 컨디션을 유지하셨습니다. 🎶 흥이 나실 때 손뼉을 활짝 치며 옛 노랫가락을 힘껏 부르시는 적극적인 태도로 모두에게 힘을 주셨습니다. 🎤 혈압도 지정된 시간에 약을 거르지 않고 복용하셔 안전 수치 내에 계십니다. 건강하고 에너지가 넘치는 보람찬 한 주였습니다. 👍",
            "이번 한 주 복남 어르신은 야외 마당 꽃밭 가꾸기와 화분 분갈이 등 원예 치유 과정에서 흙의 질감을 느끼며 함박웃음을 지으셨습니다. 🌱 제철 생선 요리를 특별히 좋아하셔 풍부한 영양 식단을 성공적으로 끝마치셨습니다. 고혈압약 조절도 규칙적으로 실시하고 있습니다. 항상 어르신 편에서 정성을 다하겠습니다. 💖",
            "복남 어르신의 활기찬 주간 안심 소식입니다. ✨ 이번 주 어르신께서는 인지 퍼즐 맞추기와 단어 연상 퀴즈를 무척 빠르게 완수하며 지적 즐거움을 만끽하셨습니다. 오후 다도 시간에는 차 향기를 음미하며 옛 추억을 잔잔하게 떠올리셨습니다. 혈압 모니터링 결과도 지극히 평온한 일상을 가리키고 있습니다. 🍀",
            "5월 넷째 주 복남 어르신은 맑은 날씨 속에 요양원 마당을 거닐며 꽃들을 심으시는 원예 프로젝트에 흙손을 더해주셨습니다. 🌸 기분 좋게 밥과 반찬을 섭취해 체력을 기르셨고, 음악에 맞춰 리듬을 맞추며 한 주를 흥겹게 수놓으셨습니다. 복용약 관리도 이상무입니다. 다음 한 주도 복되게 동행하겠습니다. ✨"
        ]

        r3_weekly_texts = [
            "이번 주 정호 어르신께서는 침상 위에서 요양사와 관절 유연성 강화를 위한 이완 스트레칭을 온화하게 수행하셨습니다. 🧘‍♂️ 소화가 용이한 부드러운 유동식을 하루 세 차례 정량 공급받아 체력을 고르게 채우셨습니다. 오후에는 휠체어 편안한 자리에 탑승하셔 거실 티비나 가벼운 라디오 음악을 감상하시며 편안하게 휴식을 즐기셨습니다. 늘 정성을 다하는 케어를 보여드리겠습니다. 🍀",
            "이번 한 주 정호 어르신께서는 컨디션 난조 없이 침상 관절 마사지 치료를 시원스럽게 소화하셨습니다. 😊 기력이 양호하신 오후 시간에는 안정적인 휠체어 지지를 받으시며 다른 어르신들과 거실 창가 테이블로 동행해 다도 분위기를 조용히 감상하며 마음을 안정하셨습니다. 신체 긴장도 정상이며 차분한 케어가 유지되었습니다. 💖",
            "정호 어르신의 편안한 주간 안부 리포트입니다. 🌸 어르신은 이번 주 가벼운 체온 조절을 동반하여 침상 마사지 케어를 집중적으로 받아 관절 강직을 철저히 방지했습니다. 주 3회 휠체어로 조심스럽게 마당 근처 실내 테라스로 이동하여 따사로운 봄 햇빛을 안전하게 보며 여유를 즐기셨습니다. 소화 및 수면 모두 양호하십니다. 📻",
            "5월 마지막 주 정호 어르신은 무리한 활동 없이 침대 위에서 잔잔한 고전 음악을 편히 들으시며 스트레칭을 실천하셨습니다. 🎵 가래나 기침 등 호흡기 불안 증세도 전혀 확인되지 않아 가슴 편안히 한 주를 나셨습니다. 매일 오후 휠체어로 안전히 이동해 거실에서 티비를 바라보며 부드러운 휴식을 영위하셨습니다. 매일 안전하고 소중하게 정성을 쏟겠습니다. 🍀"
        ]

        for w_idx, (p_start, p_end) in enumerate(weeks):
            for res_id in [1, 2, 3]:
                # Find notices of this resident in this week
                week_notices = [n for n in notices_list if n.resident_id == res_id and p_start <= n.sent_at.date() <= p_end]
                source_ids = [n.id for n in week_notices]
                
                # Compute stats summary from these notices
                meal_counts = {"FULL": 0, "NORMAL": 0, "LITTLE": 0, "REFUSED": 0}
                mood_counts = {"GOOD": 0, "NORMAL": 0, "ANXIOUS": 0}
                health_counts = {"GOOD": 0, "NORMAL": 0, "NEEDS_OBSERVATION": 0}
                program_counts = {}

                for n in week_notices:
                    ss = n.structured_status
                    meal_counts[ss.get("meal", "NORMAL")] += 1
                    mood_counts[ss.get("mood", "NORMAL")] += 1
                    health_counts[ss.get("health", "NORMAL")] += 1
                    
                    for prog in n.participated_programs:
                        title = prog.get("title", "")
                        # Remove emojis for frequency count if needed, or keep clean
                        title_clean = title.split(" ")[0] if " " in title else title
                        program_counts[title_clean] = program_counts.get(title_clean, 0) + 1

                top_programs = [
                    {"title": k, "count": v} 
                    for k, v in sorted(program_counts.items(), key=lambda item: item[1], reverse=True)[:2]
                ]

                stats_summary = {
                    "recordedDays": len(week_notices),
                    "meal": meal_counts,
                    "mood": mood_counts,
                    "health": health_counts,
                    "topPrograms": top_programs
                }

                # Determine weekly letter text
                if res_id == 1:
                    text_content = r1_weekly_texts[w_idx]
                elif res_id == 2:
                    text_content = r2_weekly_texts[w_idx]
                else:
                    text_content = r3_weekly_texts[w_idx]

                rep = Report(
                    resident_id=res_id,
                    author_id=2, # 박서준 (Social Worker)
                    period_start=p_start,
                    period_end=p_end,
                    recorded_days=len(week_notices),
                    stats_summary=stats_summary,
                    source_notice_ids=source_ids,
                    tone=NoticeTone.POLITE,
                    ai_generated_text=text_content,
                    final_text=text_content,
                    status=NoticeStatus.SENT,
                    sent_at=datetime.combine(p_end, time(18, 0, 0)),
                    read_at=datetime.combine(p_end, time(20, 30, 0)) if p_end <= date(2026, 5, 29) else None
                )
                db.add(rep)
        
        db.commit()
        print("Weekly reports seeded.")

        # ---------------------------------------------------------
        # 5. Seed Notice Board (공지사항)
        # ---------------------------------------------------------
        print("Seeding notice board...")
        boards = [
            {
                "title": "🌸 어버이날 감사 특별 행사 및 보호자 간접 참여 안내",
                "content": "안녕하세요, 행복요양원 보호자 여러분.\n\n5월 8일 어버이날을 맞이하여 원내 어르신들을 모시고 카네이션 달아드리기 및 특별 감사 드림 행사를 진행합니다.\n\n감염 예방을 위해 직접 방문이 어려우신 보호자님들을 위하여, 행사 당일 실시간 사진 및 비대면 화상 통화를 적극적으로 지원해 드릴 예정이오니 많은 관심과 신청 바랍니다.\n\n항상 어르신들을 부모님처럼 소중히 모시는 행복요양원이 되겠습니다.",
                "created": datetime(2026, 5, 4, 9, 0, 0)
            },
            {
                "title": "🧹 5월 원내 전체 위생 소독 및 봄맞이 대청소 일정",
                "content": "안녕하십니까, 시설본부입니다.\n\n어르신들의 안전하고 쾌적한 생활 환경을 유지하기 위해 5월 10일(일요일) 13:00부터 17:00까지 원내 전체 특별 방역 및 생활실 대청소를 실시합니다.\n\n해당 시간 동안 어르신들은 별도로 마련된 안전 대기실에서 보호를 받으실 예정이며, 방역 작업 중에는 면회가 제한되오니 면회 일정을 잡으실 때 참고해 주시면 감사하겠습니다.",
                "created": datetime(2026, 5, 8, 10, 30, 0)
            },
            {
                "title": "👕 어르신 하절기 의복 교체 및 소지품 정돈 요청",
                "content": "안녕하세요. 행복요양원 간호부입니다.\n\n최근 낮 기온이 크게 올라감에 따라 어르신들의 하복 의류 준비가 필요한 시기입니다. 보호자님들께서는 이번 주말 방문 시 어르신들이 입으실 수 있는 얇은 하복(반팔, 얇은 긴바지 등)을 3~4벌 준비해 주시어 담당 간호사에게 전달 부탁드립니다.\n\n더불어 보관 중이던 두꺼운 겨울철 의복은 위생 관리를 위해 가정으로 회수해 주시길 부탁드립니다.",
                "created": datetime(2026, 5, 13, 11, 0, 0)
            },
            {
                "title": "🚒 2분기 정기 소방 합동 대피 안전 훈련 실시 안내",
                "content": "보호자님들께 알립니다.\n\n행복요양원은 재난 발생 시 어르신들의 신속하고 안전한 대피 조치를 위해 관할 소방서와 함께하는 합동 대피 훈련을 5월 20일(수요일) 오후 3시에 진행합니다.\n\n훈련 시 소방 경보음 및 사이렌 소리가 들릴 수 있으나 실제 상황이 아니오니 인근 지역 주민분들과 내방객분들께서는 당황하지 마시고 직원의 안내에 협조해 주시기를 바랍니다.",
                "created": datetime(2026, 5, 18, 14, 0, 0)
            },
            {
                "title": "💻 2026년도 상반기 비대면 보호자 간담회 개최 공지",
                "content": "안녕하십니까, 행복요양원 원장입니다.\n\n요양원 운영 현황과 하반기 주요 프로그램 계획을 안내해 드리고 보호자님들의 고견을 수렴하기 위해 온라인 간담회를 개최합니다.\n\n- 일시: 2026년 5월 27일(수) 오후 7시 ~ 8시\n- 방법: Zoom 비대면 온라인 회의 (접속 링크는 개별 문자 전송)\n- 주요 내용: 시설 리노베이션 안내, 영양 관리 현황 보고, 질의응답\n\n바쁘시더라도 자리를 함께하시어 따뜻한 동행이 이어질 수 있기를 희망합니다.",
                "created": datetime(2026, 5, 22, 15, 30, 0)
            },
            {
                "title": "📋 6월 식단표 및 가정통신문 정기 공유 안내",
                "content": "보호자 여러분 안녕하십니까.\n\n다가오는 6월 한 달 동안 어르신들의 영양 균형과 소화기능을 최우선으로 고려하여 맞춘 영양 식단표와 6월 요양원 주요 소식 및 가정통신문을 전달해 드립니다.\n\n제철 야채와 보양식 식단 구성 등 다가오는 더위에 어르신들의 기력이 떨어지지 않도록 철저히 대비하겠습니다. 세부 식단 파일은 첨부 캘린더나 식단 조회를 통해 실시간 확인하실 수 있습니다.",
                "created": datetime(2026, 5, 29, 9, 0, 0)
            }
        ]

        for b in boards:
            db.add(NoticeBoard(
                facility_id=1,
                author_id=3, # 관리자 (Admin)
                title=b["title"],
                content=b["content"],
                created_at=b["created"],
                updated_at=b["created"]
            ))
        db.commit()
        print("Notice board seeded.")

        # ---------------------------------------------------------
        # 6. Seed Schedule Events (일정표)
        # ---------------------------------------------------------
        print("Seeding schedule events...")
        events = [
            # May Holidays
            {"date": date(2026, 5, 5), "type": ScheduleEventType.HOLIDAY, "title": "어린이날 🎈", "desc": "법정 공휴일 (원내 정상 프로그램 미운영, 기본 케어 지원)"},
            {"date": date(2026, 5, 8), "type": ScheduleEventType.HOLIDAY, "title": "어버이날 🌹", "desc": "요양원 카네이션 수여 및 어버이 은혜 감사 특별 찬치"},
            {"date": date(2026, 5, 24), "type": ScheduleEventType.HOLIDAY, "title": "부처님오신날 🪷", "desc": "법정 공휴일"},
            
            # June Holidays
            {"date": date(2026, 6, 6), "type": ScheduleEventType.HOLIDAY, "title": "현충일 🇰🇷", "desc": "법정 공휴일 조기 게양"},
            
            # May Facility Events
            {"date": date(2026, 5, 15), "type": ScheduleEventType.FACILITY_EVENT, "title": "상반기 온라인 보호자 간담회 💻", "desc": "Zoom 회의실을 활용한 요양원 현황 설명 및 소통"},
            {"date": date(2026, 5, 22), "type": ScheduleEventType.FACILITY_EVENT, "title": "원내 텃밭 봄 꽃심기 행사 🌸", "desc": "앞마당 미니 정원 가꾸기 원예 요양 프로그램"},
            {"date": date(2026, 5, 28), "type": ScheduleEventType.FACILITY_EVENT, "title": "관할 소방서 합동 소방 대피 훈련 🚒", "desc": "전 직원 및 어르신 참여 비상 탈출 교육"},
            
            # June Facility Events
            {"date": date(2026, 6, 10), "type": ScheduleEventType.FACILITY_EVENT, "title": "6월 자원봉사 정기 이미용 봉사 ✂️", "desc": "헤어 디자이너 봉사팀 방문 이발 및 커트"},
            {"date": date(2026, 6, 17), "type": ScheduleEventType.FACILITY_EVENT, "title": "협력 치과의원 출장 구강 검진 🦷", "desc": "전체 어르신 틀니 점검 및 치아 잇몸 검진"},
            {"date": date(2026, 6, 24), "type": ScheduleEventType.FACILITY_EVENT, "title": "6월 생신 어르신 합동 생신 파티 🎉", "desc": "축하 케이크 촛불 불기 및 노래 자랑 선물 증정"}
        ]

        for ev in events:
            db.add(ScheduleEvent(
                facility_id=1,
                author_id=2, # 박서준 (Social Worker)
                event_date=ev["date"],
                event_type=ev["type"],
                title=ev["title"],
                description=ev["desc"]
            ))

        # Dynamic resident birthdays in May and June
        all_residents = db.query(Resident).all()
        for r in all_residents:
            if r.birth_date:
                # Find birthday in 2026
                b_date = r.birth_date
                try:
                    r_bday_2026 = date(2026, b_date.month, b_date.day)
                    if date(2026, 5, 1) <= r_bday_2026 <= date(2026, 6, 30):
                        db.add(ScheduleEvent(
                            facility_id=1,
                            author_id=2,
                            event_date=r_bday_2026,
                            event_type=ScheduleEventType.BIRTHDAY,
                            title=f"🎂 {r.name} 어르신 생신",
                            description=f"행복요양원 가족 모두가 진심으로 {r.name} 어르신의 생신을 축하드립니다! 🎉",
                            resident_id=r.id
                        ))
                except ValueError:
                    # Handle leap years birth_date 02-29
                    pass

        db.commit()
        print("Schedule events seeded.")

        # ---------------------------------------------------------
        # 7. Seed Inquiries (보호자 문의)
        # ---------------------------------------------------------
        print("Seeding inquiries...")
        inqs = [
            # 1. Health inquiry from boram@family.kr (User 5) for 김순자 (Resident 1)
            {
                "guardian_id": 5, "resident_id": 1,
                "title": "김순자 어르신 감기 증상 및 약 처방 관련 문의",
                "content": "안녕하세요. 최근 일교차가 커져서 아침저녁으로 방이 쌀쌀한 것 같습니다. 혹시 순자 어르신께서 감기 기운이나 기침을 하지는 않으시는지 조심스럽게 여쭤봅니다. 필요하다면 가정에서 상비약을 가지고 방문하겠습니다.",
                "category": InquiryCategory.HEALTH, "created": datetime(2026, 5, 4, 14, 0, 0),
                "status": InquiryStatus.READ, "read_by": 1, "read_at": datetime(2026, 5, 4, 16, 30, 0)
            },
            # 2. Visit inquiry from jiwon@family.kr (User 6) for 이복남 (Resident 2)
            {
                "guardian_id": 6, "resident_id": 2,
                "title": "어버이날 주말 대면 면회 신청합니다",
                "content": "어버이날을 맞아 5월 9일 토요일 오후 2시경에 아버님 대면 면회를 신청하고 싶습니다. 참여 가능 인원은 총 3명(보호자 부부, 자녀 1명)입니다. 예약 확인 및 가능 여부를 답변해 주시면 감사하겠습니다.",
                "category": InquiryCategory.VISIT, "created": datetime(2026, 5, 6, 9, 30, 0),
                "status": InquiryStatus.READ, "read_by": 2, "read_at": datetime(2026, 5, 6, 11, 0, 0)
            },
            # 3. Meal inquiry from hyeonu@family.kr (User 7) for 박정호 (Resident 3)
            {
                "guardian_id": 7, "resident_id": 3,
                "title": "박정호 어르신 식사 섭취 관련 건의사항",
                "content": "아버님께서 치아 통증이 있으신지 최근 밥을 절반만 드셨다는 알림장을 받았습니다. 식단 제공 시 반찬류나 고기류를 아주 잘게 다지거나 부드러운 형태로 제공해 주실 수 있으신가요? 부탁드리겠습니다.",
                "category": InquiryCategory.MEAL, "created": datetime(2026, 5, 11, 10, 15, 0),
                "status": InquiryStatus.READ, "read_by": 1, "read_at": datetime(2026, 5, 11, 14, 20, 0)
            },
            # 4. Admin Affairs inquiry from boram@family.kr (User 5) for 김순자 (Resident 1)
            {
                "guardian_id": 5, "resident_id": 1,
                "title": "5월 장기요양 본인부담금 청구서 및 영수증 재발급 요청",
                "content": "안녕하세요. 계좌이체 내역과 대조해 보고 싶은 영수증 내역이 있어 5월 청구 영수증을 메일로 받아보고 싶습니다. 이메일 주소는 boram@family.kr 입니다. 확인 부탁드립니다.",
                "category": InquiryCategory.ADMIN_AFFAIRS, "created": datetime(2026, 5, 14, 11, 0, 0),
                "status": InquiryStatus.READ, "read_by": 2, "read_at": datetime(2026, 5, 14, 13, 0, 0)
            },
            # 5. Visit inquiry from jiwon@family.kr (User 6) for 이복남 (Resident 2)
            {
                "guardian_id": 6, "resident_id": 2,
                "title": "석가탄신일 연휴 비대면 화상면회 희망",
                "content": "석가탄신일인 5월 24일에 가족들이 직접 갈 수가 없어서요. 영상통화로라도 아버님 얼굴을 뵙고 인사를 나누고 싶습니다. 일요일 오후 3시~4시 사이에 10분 정도 연결 가능할지 문의합니다.",
                "category": InquiryCategory.VISIT, "created": datetime(2026, 5, 20, 16, 20, 0),
                "status": InquiryStatus.READ, "read_by": 2, "read_at": datetime(2026, 5, 20, 18, 0, 0)
            },
            # 6. Health inquiry from hyeonu@family.kr (User 7) for 박정호 (Resident 3)
            {
                "guardian_id": 7, "resident_id": 3,
                "title": "박정호 어르신 정기 외래 진료 동행 안내 건",
                "content": "다음 주 목요일인 5월 28일에 서울대학병원 비뇨기과 예약이 있어 외출해야 합니다. 사설 구급차는 예약해 두었으며, 당일 오전 9시 30분에 모시러 갈 예정입니다. 외출 준비 및 차트 서류 챙기기 부탁드립니다.",
                "category": InquiryCategory.HEALTH, "created": datetime(2026, 5, 22, 10, 0, 0),
                "status": InquiryStatus.READ, "read_by": 1, "read_at": datetime(2026, 5, 22, 11, 30, 0)
            },
            # 7. Meal inquiry from boram@family.kr (User 5) for 김순자 (Resident 1)
            {
                "guardian_id": 5, "resident_id": 1,
                "title": "김순자 어르신 개인 당뇨 간식 제재 요청",
                "content": "최근 요양원 프로그램에서 빵과 과자가 간식으로 나오는 것을 어르신께서 너무 기분 좋게 드셨다는 소식을 보았습니다. 당뇨를 앓고 계셔 혈당 급상승 우려가 있습니다. 탄수화물류 간식 섭취 비중을 줄여주실 수 있는지요.",
                "category": InquiryCategory.MEAL, "created": datetime(2026, 5, 25, 14, 45, 0),
                "status": InquiryStatus.READ, "read_by": 1, "read_at": datetime(2026, 5, 25, 16, 10, 0)
            },
            # 8. Visit inquiry from jiwon@family.kr (User 6) for 이복남 (Resident 2)
            {
                "guardian_id": 6, "resident_id": 2,
                "title": "주중 퇴근 후 야간 면회(19시 이후) 규정 문의",
                "content": "주말에는 급한 해외 출장이 잡혀 방문하기 힘듭니다. 혹시 평일 퇴근 후 19시경에 짧게 면회하는 것이 요양원 내부 규정상 허용되는지 여쭤보고 싶습니다. 불가피한 상황이라 답변 부탁드립니다.",
                "category": InquiryCategory.VISIT, "created": datetime(2026, 5, 27, 18, 0, 0),
                "status": InquiryStatus.UNREAD, "read_by": None, "read_at": None
            },
            # 9. Other inquiry from boram@family.kr (User 5) for 김순자 (Resident 1)
            {
                "guardian_id": 5, "resident_id": 1,
                "title": "순자 어르신 세탁물(카디건) 분실 확인 건",
                "content": "가족들이 지난주 사드렸던 진한 핑크색 꽃무늬 봄 카디건이 세탁실에서 섞였는지 장롱에 보이지 않는다고 하시네요. 세탁실 바구니나 다른 어르신 옷장으로 잘못 가지 않았는지 한 번만 수색해 봐주세요. 감사합니다.",
                "category": InquiryCategory.OTHER, "created": datetime(2026, 5, 28, 10, 0, 0),
                "status": InquiryStatus.UNREAD, "read_by": None, "read_at": None
            },
            # 10. Health inquiry from hyeonu@family.kr (User 7) for 박정호 (Resident 3)
            {
                "guardian_id": 7, "resident_id": 3,
                "title": "욕창 예방 전용 에어 매트리스 설치 여부",
                "content": "아버님께서 와상 상태로 침상 생활 비중이 아주 높다 보니 피부 욕창이 크게 염려됩니다. 필요시 개인용 욕창 매트리스를 구매해서 병실 침대에 설치하는 것이 반입 및 전기 사용 허용 규정에 어긋나지 않는지 알려주십시오.",
                "category": InquiryCategory.HEALTH, "created": datetime(2026, 5, 29, 13, 0, 0),
                "status": InquiryStatus.UNREAD, "read_by": None, "read_at": None
            },
            # 11. Visit inquiry from jiwon@family.kr (User 6) for 이복남 (Resident 2)
            {
                "guardian_id": 6, "resident_id": 2,
                "title": "6월 둘째 주 주말 예약 면회 신청",
                "content": "6월 13일 토요일 오전 11시에 대면 면회 2명 신청하고 싶습니다. 시간이 많이 남아있지만 인원이 마감되기 전에 미리 등록하고자 하오니 예약 조치 후 확인 부탁드립니다.",
                "category": InquiryCategory.VISIT, "created": datetime(2026, 5, 30, 10, 0, 0),
                "status": InquiryStatus.UNREAD, "read_by": None, "read_at": None
            },
            # 12. Admin Affairs inquiry from boram@family.kr (User 5) for 김순자 (Resident 1)
            {
                "guardian_id": 5, "resident_id": 1,
                "title": "장기요양 세액공제 증명원 팩스 전송 요청",
                "content": "직장 연말정산 보정 기간이라 요양원 납부 확인 내역이 필요해졌습니다. 회사 팩스 번호인 02-9999-8888 번으로 증명원을 한 부만 팩스 송부해 주실 수 있을까요? 늦어도 다음 주 월요일까지 부탁드립니다.",
                "category": InquiryCategory.ADMIN_AFFAIRS, "created": datetime(2026, 6, 1, 9, 30, 0),
                "status": InquiryStatus.UNREAD, "read_by": None, "read_at": None
            }
        ]

        for i in inqs:
            # Prepare classification scores based on category
            category = i["category"]
            scores = {c.value: 0.02 for c in InquiryCategory}
            scores[category.value] = 0.92
            
            db.add(Inquiry(
                guardian_user_id=i["guardian_id"],
                resident_id=i["resident_id"],
                facility_id=1,
                title=i["title"],
                content=i["content"],
                category=category,
                confidence=0.92,
                classification_scores=scores,
                classification_status=ClassificationStatus.SUCCESS,
                status=i["status"],
                read_by=i["read_by"],
                read_at=i["read_at"],
                created_at=i["created"],
                updated_at=i["created"]
            ))
            
        db.commit()
        print("Inquiries seeded.")

        print("Updating sequence values for safety...")
        # Since we cleared and inserted with SQLAlchemy default PK values,
        # we adjust sequences so next manual insert doesn't hit unique violation
        db.execute(text("SELECT setval('program_id_seq', COALESCE((SELECT MAX(id) FROM program), 1));"))
        db.execute(text("SELECT setval('meal_log_id_seq', COALESCE((SELECT MAX(id) FROM meal_log), 1));"))
        db.execute(text("SELECT setval('notice_id_seq', COALESCE((SELECT MAX(id) FROM notice), 1));"))
        db.execute(text("SELECT setval('report_id_seq', COALESCE((SELECT MAX(id) FROM report), 1));"))
        db.execute(text("SELECT setval('notice_board_id_seq', COALESCE((SELECT MAX(id) FROM notice_board), 1));"))
        db.execute(text("SELECT setval('schedule_event_id_seq', COALESCE((SELECT MAX(id) FROM schedule_event), 1));"))
        db.execute(text("SELECT setval('inquiry_id_seq', COALESCE((SELECT MAX(id) FROM inquiry), 1));"))
        db.commit()
        print("Sequences updated.")
        
        print("Database seeding completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
