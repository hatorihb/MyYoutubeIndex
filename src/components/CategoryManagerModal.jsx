import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { PALETTE_KEYS, colorClassFor } from '../lib/categoryColors'

const FALLBACK = 'その他'

export default function CategoryManagerModal({ categories, videos, onClose, onChanged }) {
  const [editing, setEditing] = useState(null)   // 編集中のカテゴリ名（新規は '')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const countFor = (name) => videos.filter(v => v.category === name).length

  const startNew = () => {
    setError('')
    setEditing('')
    setDraft({
      name: '',
      color_key: 'gray-600',
      definition: '',
      sort_order: (categories.at(-1)?.sort_order ?? 0) + 10,
    })
  }

  const startEdit = (cat) => {
    setError('')
    setEditing(cat.name)
    setDraft({ ...cat })
  }

  const cancel = () => { setEditing(null); setDraft(null); setError('') }

  const save = async () => {
    const name = draft.name.trim()
    if (!name) { setError('カテゴリ名を入力してください'); return }
    if (name !== editing && categories.some(c => c.name === name)) {
      setError('同じ名前のカテゴリがすでにあります'); return
    }
    setBusy(true); setError('')

    const payload = {
      name,
      color_key: draft.color_key,
      definition: draft.definition.trim(),
      sort_order: Number(draft.sort_order) || 999,
    }
    // 改名は外部キーの ON UPDATE CASCADE で videos 側にも反映される
    const { error: err } = editing === ''
      ? await supabase.from('categories').insert(payload)
      : await supabase.from('categories').update(payload).eq('name', editing)

    setBusy(false)
    if (err) { setError(err.message); return }
    cancel()
    onChanged()
  }

  const remove = async (cat) => {
    const used = countFor(cat.name)
    if (cat.name === FALLBACK) { setError(`「${FALLBACK}」は退避先のため削除できません`); return }
    const msg = used > 0
      ? `「${cat.name}」を削除します。\nこのカテゴリの動画 ${used} 本は「${FALLBACK}」に移動します。`
      : `「${cat.name}」を削除します。`
    if (!confirm(msg)) return

    setBusy(true); setError('')
    const { error: err } = await supabase.rpc('delete_category', {
      p_name: cat.name,
      p_fallback: FALLBACK,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onChanged()
  }

  const move = async (index, dir) => {
    const target = categories[index + dir]
    const current = categories[index]
    if (!target) return
    setBusy(true); setError('')
    // 並び順を入れ替える
    const { error: e1 } = await supabase.from('categories')
      .update({ sort_order: target.sort_order }).eq('name', current.name)
    const { error: e2 } = await supabase.from('categories')
      .update({ sort_order: current.sort_order }).eq('name', target.name)
    setBusy(false)
    if (e1 || e2) { setError((e1 || e2).message); return }
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">カテゴリ管理</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {editing !== null ? (
            <div className="border border-gray-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                {editing === '' ? 'カテゴリを追加' : `「${editing}」を編集`}
              </p>

              <label className="block text-xs text-gray-500 mb-1 font-medium">カテゴリ名</label>
              <input
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
                style={{ fontSize: '16px' }}
                autoFocus
              />

              <label className="block text-xs text-gray-500 mb-1 font-medium">
                AI分類用の説明
                <span className="font-normal text-gray-400">（どんな動画がこのカテゴリかを書く）</span>
              </label>
              <textarea
                value={draft.definition}
                onChange={e => setDraft({ ...draft, definition: e.target.value })}
                rows={2}
                placeholder="例: 株・不動産・資産運用など、自分の資産をどう増やすかの実践"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                style={{ fontSize: '16px' }}
              />

              <label className="block text-xs text-gray-500 mb-1.5 font-medium">色</label>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {PALETTE_KEYS.map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft({ ...draft, color_key: key })}
                    className={`w-7 h-7 rounded-full ${colorClassFor(key)} ${
                      draft.color_key === key ? 'ring-2 ring-offset-1 ring-gray-900' : ''
                    }`}
                    aria-label={key}
                  >
                    <span className="text-[10px] font-bold">A</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={cancel}
                  disabled={busy}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={save}
                  disabled={busy}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {busy ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={startNew}
              className="w-full py-2.5 mb-4 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
            >
              ＋ カテゴリを追加
            </button>
          )}

          <ul className="space-y-1">
            {categories.map((cat, i) => {
              const used = countFor(cat.name)
              return (
                <li key={cat.name} className="flex items-center gap-2 py-1.5 border-b border-gray-50">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${colorClassFor(cat.color_key)}`}>
                    {cat.name}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{used}本</span>
                  <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={busy || i === 0}
                      className="w-7 h-7 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                      aria-label="上へ"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={busy || i === categories.length - 1}
                      className="w-7 h-7 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                      aria-label="下へ"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => startEdit(cat)}
                      disabled={busy}
                      className="px-2 h-7 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => remove(cat)}
                      disabled={busy}
                      className="px-2 h-7 text-xs text-gray-400 hover:text-red-600 disabled:opacity-40"
                    >
                      削除
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="text-xs text-gray-400 mt-4 leading-relaxed">
            カテゴリ名を変更すると、そのカテゴリの動画も自動的に新しい名前に切り替わります。
            削除した場合、そのカテゴリの動画は「{FALLBACK}」に移動します。
          </p>
        </div>
      </div>
    </div>
  )
}
