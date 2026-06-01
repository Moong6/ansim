import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { useNoticeStore } from '../store/noticeStore'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { saveDraft } from '../utils/draftStorage'
import { updateLanguage } from '../api/users'
import { ApiException } from '../api/client'
import { type Lang, type StructuredStatus, type Tone } from '../types'

// 2차: 언어 칩
const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'vi', label: '🇻🇳 Tiếng Việt' },
  { value: 'zh', label: '🇨🇳 中文' },
  { value: 'en', label: '🇵🇭 English' },
]
const PLACEHOLDERS: Record<Lang, string> = {
  ko: '예) 점심 미역국 절반 드심, 손녀 얘기 많이 하심',
  vi: 'VD) Ăn được nửa bát canh, vui vẻ kể chuyện về cháu',
  zh: '例) 午饭吃了一半海带汤,开心地聊孙女的事',
  en: 'e.g.) Ate half of the seaweed soup, happily talked about grandchild',
}
// Web Speech API 언어 코드 매핑
const SPEECH_LANG: Record<Lang, string> = {
  ko: 'ko-KR',
  vi: 'vi-VN',
  zh: 'zh-CN',
  en: 'en-US',
}

// ─── 옵션 정의 ────────────────────────────────────────────────────────────────

const HEALTH_OPTIONS: { value: StructuredStatus['health']; label: string }[] = [
  { value: 'GOOD',              label: '좋음' },
  { value: 'NORMAL',            label: '보통' },
  { value: 'NEEDS_OBSERVATION', label: '관찰필요' },
]
const MOOD_OPTIONS: { value: StructuredStatus['mood']; label: string }[] = [
  { value: 'GOOD',    label: '좋음' },
  { value: 'NORMAL',  label: '보통' },
  { value: 'ANXIOUS', label: '우울/불안' },
]
const MEAL_OPTIONS: { value: StructuredStatus['meal']; label: string }[] = [
  { value: 'FULL',    label: '완식' },
  { value: 'NORMAL',  label: '보통' },
  { value: 'LITTLE',  label: '적게' },
  { value: 'REFUSED', label: '거부' },
]
const MEDICATION_OPTIONS: { value: StructuredStatus['medication']; label: string }[] = [
  { value: 'DONE', label: '완료' },
  { value: 'NONE', label: '해당없음' },
]
const TONE_OPTIONS: { value: Tone; label: string; desc: string }[] = [
  { value: 'FRIENDLY',   label: '친근',     desc: '다정하고 친근한 어조' },
  { value: 'POLITE',     label: '정중',     desc: '정중하고 격식 있는 어조 (기본)' },
  { value: 'EMPATHETIC', label: '공감·위로', desc: '공감과 위로가 담긴 어조' },
]

// ─── 칩 그룹 ──────────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  label, required, options, value, onChange,
}: {
  label: string
  required?: boolean
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (v: T) => void
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`
                px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors
                ${selected
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700'}
              `}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── 음성 인식 지원 ──────────────────────────────────────────────────────────

const SpeechRecognitionCtor: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    : null

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export default function S3WritingArea() {
  const selectedId = useDashboardStore((s) => s.selectedResidentId)
  const residents  = useDashboardStore((s) => s.residents)
  const programs   = useDashboardStore((s) => s.programs)

  const userId = useAuthStore((s) => s.user?.id)

  const selected = useMemo(
    () => residents.find((r) => r.id === selectedId) ?? null,
    [residents, selectedId],
  )

  // ── 모드 가드: reading 모드면 ReadOnlyNotice가 렌더링됨 ────────────────────
  const mode = useNoticeStore((s) => s.mode)

  // ── 입력 상태 ───────────────────────────────────────────────────────────────
  const participatedProgramIds = useNoticeStore((s) => s.participatedProgramIds)
  const status                 = useNoticeStore((s) => s.status)
  const memo                   = useNoticeStore((s) => s.memo)
  const tone                   = useNoticeStore((s) => s.tone)
  const memoLang               = useNoticeStore((s) => s.memoLang)
  const generating             = useNoticeStore((s) => s.generating)
  const generateError          = useNoticeStore((s) => s.generateError)
  const previousNoticeId       = useNoticeStore((s) => s.previousNoticeId)
  const justSentNoticeId       = useNoticeStore((s) => s.justSentNoticeId)

  const toggleProgram = useNoticeStore((s) => s.toggleProgram)
  const setStatusField = useNoticeStore((s) => s.setStatusField)
  const setMemo        = useNoticeStore((s) => s.setMemo)
  const appendMemo     = useNoticeStore((s) => s.appendMemo)
  const setTone        = useNoticeStore((s) => s.setTone)
  const setMemoLang    = useNoticeStore((s) => s.setMemoLang)
  const generate       = useNoticeStore((s) => s.generate)
  const setPreferredLang = useAuthStore((s) => s.setPreferredLang)

  // ── 음성 인식 ───────────────────────────────────────────────────────────────
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  function startListening() {
    if (!SpeechRecognitionCtor) return
    const rec = new SpeechRecognitionCtor()
    rec.lang = SPEECH_LANG[memoLang]    // 2차: 선택 언어로 음성 인식
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: any) => appendMemo(e.results[0][0].transcript as string)
    rec.onerror = () => setListening(false)
    rec.onend   = () => setListening(false)
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }
  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  // ── 2차: 언어 칩 변경 ──────────────────────────────────────────────────────
  async function handleLangChange(lang: Lang) {
    if (lang === memoLang) return
    // (a) 즉시 로컬 상태 반영 (낙관적)
    setMemoLang(lang)
    setPreferredLang(lang)
    // (b) 서버 저장 (실패해도 로컬은 유지)
    try {
      await updateLanguage(lang)
    } catch (e) {
      const msg = e instanceof ApiException
        ? e.error.message
        : '언어 설정 저장에 실패했습니다.'
      useToastStore.getState().show(msg, 'error')
    }
  }

  // ── ★ localStorage 자동 임시저장 (500ms 디바운스) ─────────────────────────
  // mode='editing' + 어르신 선택됨 + 전송완료 화면 아님 일 때만 저장.
  useEffect(() => {
    if (mode !== 'editing' || !selectedId || !userId) return
    if (justSentNoticeId !== null) return

    const handle = window.setTimeout(() => {
      saveDraft(userId, selectedId, {
        participatedProgramIds,
        status,
        memo,
        tone,
      })
    }, 500)
    return () => window.clearTimeout(handle)
  }, [
    mode, selectedId, userId, justSentNoticeId,
    participatedProgramIds, status, memo, tone,
  ])

  // ── 가드 ───────────────────────────────────────────────────────────────────
  if (mode === 'reading') return null      // ReadOnlyNotice 가 렌더링
  if (justSentNoticeId !== null) return null    // S4가 전송 완료 화면을 렌더링

  if (!selected) {
    return (
      <section className="bg-white rounded-xl shadow-sm border border-dashed border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-3">작성 영역</h2>
        <p className="py-8 text-center text-sm text-gray-400">
          위 어르신 카드를 선택하면 작성 영역이 나타납니다.
        </p>
      </section>
    )
  }

  const canGenerate =
    !!status.health && !!status.mood && !!status.meal && !generating

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* ─ 헤더: 선택된 어르신 + 재전송 모드 뱃지 ─ */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-teal-700">{selected.name.charAt(0)}</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              {selected.name} 어르신 작성 영역
              {previousNoticeId !== null && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                  재전송 모드 (v+1)
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500">
              {selected.age}세 · {selected.roomNumber} · {selected.careLevel}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">

        {/* ─ 참여 프로그램 (방어 4: 빈 배열이면 영역 숨김) ─ */}
        {programs.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              참여한 공통 프로그램
              <span className="ml-2 text-xs text-gray-400">기본 전체 체크, 미참여 항목만 해제</span>
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((p) => {
                const checked = participatedProgramIds.includes(p.id)
                return (
                  <label
                    key={p.id}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors
                      ${checked
                        ? 'bg-teal-50 border-teal-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProgram(p.id)}
                      className="w-4 h-4 accent-teal-600"
                    />
                    <span className="text-xs font-bold text-teal-600">{p.startTime}</span>
                    <span className="text-sm text-gray-700 truncate">{p.title}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* ─ 상태 칩 4종 ─ */}
        <div className="grid gap-5 sm:grid-cols-2">
          <ChipGroup label="건강 상태" required options={HEALTH_OPTIONS}
            value={status.health} onChange={(v) => setStatusField('health', v)} />
          <ChipGroup label="기분" required options={MOOD_OPTIONS}
            value={status.mood} onChange={(v) => setStatusField('mood', v)} />
          <ChipGroup label="식사" required options={MEAL_OPTIONS}
            value={status.meal} onChange={(v) => setStatusField('meal', v)} />
          <ChipGroup label="투약" options={MEDICATION_OPTIONS}
            value={status.medication} onChange={(v) => setStatusField('medication', v)} />
        </div>

        {/* ─ 메모 + 음성 + 입력 언어 (2차) ─ */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">특이사항 메모</p>
            {SpeechRecognitionCtor && (
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                className={`
                  inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                  ${listening
                    ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700'}
                `}
              >
                {listening ? '⏹ 듣는 중... 클릭해 중지' : '🎙️ 음성 입력'}
              </button>
            )}
          </div>

          {/* ─ 2차: 메모 입력 언어 칩 ─ */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">메모 입력 언어:</span>
            {LANG_OPTIONS.map((opt) => {
              const selected = memoLang === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleLangChange(opt.value)}
                  disabled={generating}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium border transition-colors
                    ${selected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700'}
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {opt.label}
                </button>
              )
            })}
            {memoLang !== 'ko' && (
              <span className="ml-1 text-[11px] text-amber-600">
                결과는 항상 한국어로 생성됩니다
              </span>
            )}
          </div>

          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={PLACEHOLDERS[memoLang]}
            rows={4}
            disabled={generating}
            className="
              w-full px-3 py-2 rounded-lg border border-gray-200
              text-sm text-gray-800 placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
              disabled:bg-gray-50 resize-none
            "
          />
        </div>

        {/* ─ 톤 ─ */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">알림장 어조</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {TONE_OPTIONS.map((opt) => {
              const selected = tone === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTone(opt.value)}
                  className={`
                    text-left p-3 rounded-lg border-2 transition-colors
                    ${selected ? 'border-teal-500 bg-teal-50' : 'border-gray-100 bg-white hover:border-gray-200'}
                  `}
                >
                  <p className={`text-sm font-bold ${selected ? 'text-teal-700' : 'text-gray-700'}`}>{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {generateError && <p role="alert" className="text-sm text-red-600">{generateError}</p>}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400">
            {canGenerate
              ? '준비 완료 — 생성 버튼을 눌러주세요.'
              : '필수 항목(*) 3종을 모두 선택하면 활성화됩니다.'}
          </p>
          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => generate(selected.id)}
            className="
              px-6 py-2.5 rounded-lg font-semibold text-sm text-white
              bg-teal-600 hover:bg-teal-700 active:bg-teal-800
              disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2
              transition-colors
            "
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
                AI 생성 중... (3~5초)
              </span>
            ) : 'AI로 알림장 생성'}
          </button>
        </div>
      </div>
    </section>
  )
}
