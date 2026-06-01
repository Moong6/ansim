import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import { useToastStore } from '../store/toastStore'
import { fetchAssignedResidents, fetchResident, patchResidentPrecautions } from '../api/residents'
import type { ResidentCard, ResidentDetail } from '../types'

function genderLabel(g: string | null) {
  if (g === 'M') return '남'
  if (g === 'F') return '여'
  return ''
}

export default function ResidentsPage() {
  const { show: showToast } = useToastStore()
  const [cards, setCards]   = useState<ResidentCard[]>([])
  const [selected, setSelected] = useState<ResidentDetail | null>(null)
  const [editedPrecautions, setEdited] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const isDirtyRef = useRef(false)

  useEffect(() => {
    fetchAssignedResidents()
      .then((r) => setCards(r.residents))
      .catch(() => showToast('어르신 목록을 불러오지 못했습니다', 'error'))
  }, [showToast])

  // precautions 변경 여부 추적
  useEffect(() => {
    isDirtyRef.current = selected !== null && editedPrecautions !== (selected.precautions ?? '')
  }, [editedPrecautions, selected])

  async function handleSelectCard(card: ResidentCard) {
    if (isDirtyRef.current) {
      if (!confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return
    }
    try {
      const res = await fetchResident(card.id)
      setSelected(res.resident)
      setEdited(res.resident.precautions ?? '')
    } catch {
      showToast('어르신 정보를 불러오지 못했습니다', 'error')
    }
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      await patchResidentPrecautions(selected.id, editedPrecautions)
      setSelected({ ...selected, precautions: editedPrecautions })
      isDirtyRef.current = false
      showToast('수정되었습니다. 다음 알림장 생성부터 반영됩니다')
    } catch {
      showToast('저장에 실패했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (selected) setEdited(selected.precautions ?? '')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-4" style={{ minHeight: 'calc(100vh - 64px)' }}>

        {/* ── 좌측: 어르신 목록 (240px 고정) ── */}
        <aside className="w-60 shrink-0 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">담당 어르신</h2>
          {cards.length === 0 && (
            <p className="text-sm text-gray-400 px-1">담당 어르신이 없습니다</p>
          )}
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => handleSelectCard(card)}
              className={`
                flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                ${selected?.id === card.id
                  ? 'border-teal-400 bg-teal-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-teal-200 hover:bg-teal-50/40'
                }
              `}
            >
              {/* 아바타 */}
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0 text-lg">
                {card.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{card.name}</p>
                <p className="text-xs text-gray-500 truncate">{card.roomNumber} · {card.careLevel}</p>
              </div>
            </button>
          ))}
        </aside>

        {/* ── 우측: 선택된 어르신 상세 ── */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400 text-sm">좌측에서 어르신을 선택하세요</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">

              {/* 헤더: 아바타 + 기본 정보 */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-xl shrink-0">
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selected.name}</h3>
                  <p className="text-sm text-gray-500">
                    {selected.roomNumber} · {selected.age}세 · {genderLabel(selected.gender)}
                  </p>
                </div>
              </div>

              {/* 기본 정보 (읽기 전용) */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['등급', selected.careLevel ?? '—'],
                  ['생년월일', selected.birthDate ?? '—'],
                  ['호실', selected.roomNumber ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-gray-700">{value}</p>
                  </div>
                ))}
              </div>

              {/* precautions 편집 */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  특이사항 / AI 주의사항
                </label>
                <textarea
                  value={editedPrecautions}
                  onChange={(e) => setEdited(e.target.value)}
                  rows={4}
                  placeholder="어르신의 특이사항, 금기사항, AI가 알림장 생성 시 반영할 내용을 입력하세요"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-teal-300"
                  style={{ minHeight: '90px' }}
                />
              </div>

              {/* 인포 박스 */}
              <div className="flex items-start gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                <span className="text-teal-500 mt-0.5">ℹ️</span>
                <p className="text-xs text-teal-700 leading-relaxed">
                  이 정보는 AI 알림장·리포트 생성 시 자동으로 반영됩니다. 와상·위루관·치매 등 주의사항을 상세히 입력할수록 정확도가 높아집니다.
                </p>
              </div>

              {/* 버튼 */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '저장 중...' : '수정 사항 저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
