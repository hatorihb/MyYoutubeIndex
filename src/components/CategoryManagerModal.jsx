import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { PALETTE_KEYS, colorClassFor } from '../lib/categoryColors'

const FALLBACK = 'その他'

export default function CategoryManagerModal({ categories, rules, videos, onClose, onChanged }) {
  const [tab, setTab] = useState('categories')
  const [editing, setEditing] = useState(null)   // 編集中のカテゴリ名（新規は '')
  const [ruleEditing, setRuleEditing] = useState(null)  // 編集中のルールid（新規は 'new')
  const [ruleDraft, setRuleDraft] = useState(null)
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

  const startRule = (rule) => {
    setError('')
    setRuleEditing(rule ? rule.id : 'new')
    setRuleDraft(rule
      ? { ...rule }
      : { title: '', body: '', sort_order: (rules.at(-1)?.sort_order ?? 0) + 10 })
  }

  const cancelRule = () => { setRuleEditing(null); setRuleDraft(null); setError('') }

  const saveRule = async () => {
    const title = ruleDraft.title.trim()
    const body = ruleDraft.body.trim()
    if (!title || !body) { setError('見出しと本文の両方を入力してください'); return }
    setBusy(true); setError('')
    const payload = { title, body, sort_order: Number(ruleDraft.sort_order) || 999 }
    const { error: err } = ruleEditing === 'new'
      ? await supabase.from('category_rules').insert(payload)
      : await supabase.from('category_rules').update(payload).eq('id', ruleEditing)
    setBusy(false)
    if (err) { setError(err.message); return }
    cancelRule()
    onChanged()
  }

  const removeRule = async (rule) => {
    if (!confirm(`ルール「${rule.title}」を削除します。`)) return
    setBusy(true); setError('')
    const { error: err } = await supabase.from('category_rules').delete().eq('id', rule.id)
    setBusy(false)
    if (err) { setError(err.message); return }
    onChanged()
  }

  const moveRule = async (index, dir) => {
    const target = rules[index + dir]
    const current = rules[index]
    if (!target) return
    setBusy(true); setError('')
    const { error: e1 } = await supabase.from('category_rules')
      .update({ sort_order: target.sort_order }).eq('id', current.id)
    const { error: e2 } = await supabase.from('category_rules')
      .update({ sort_order: current.sort_order }).eq('id', target.id)
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

        <div className="flex border-b border-gray-100">
          {[['categories', 'カテゴリ'], ['rules', '判断ルール']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError('') }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === key ? 'text-red-600 border-b-2 border-red-500' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {tab === 'rules' ? (
            <RulesPane
              rules={rules}
              busy={busy}
              editing={ruleEditing}
              draft={ruleDraft}
              setDraft={setRuleDraft}
              onStart={startRule}
              onCancel={cancelRule}
              onSave={saveRule}
              onRemove={removeRule}
              onMove={moveRule}
            />
          ) : (
          <>
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
          </>
          )}
        </div>
      </div>
    </div>
  )
}

// AI分類プロンプトに差し込まれる「迷いやすい組み合わせの判断ルール」の編集面
function RulesPane({ rules, busy, editing, draft, setDraft, onStart, onCancel, onSave, onRemove, onMove }) {
  return (
    <>
      {editing !== null ? (
        <div className="border border-gray-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-gray-700 mb-3">
            {editing === 'new' ? 'ルールを追加' : 'ルールを編集'}
          </p>

          <label className="block text-xs text-gray-500 mb-1 font-medium">
            見出し <span className="font-normal text-gray-400">（迷いやすいカテゴリを / で並べる）</span>
          </label>
          <input
            value={draft.title}
            onChange={e => setDraft({ ...draft, title: e.target.value })}
            placeholder="例: 投資 / 金融 / 時事ネタ"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
            style={{ fontSize: '16px' }}
            autoFocus
          />

          <label className="block text-xs text-gray-500 mb-1 font-medium">
            判断の基準 <span className="font-normal text-gray-400">（どちらを選ぶかを書く）</span>
          </label>
          <textarea
            value={draft.body}
            onChange={e => setDraft({ ...draft, body: e.target.value })}
            rows={4}
            placeholder="例: 自分の資産運用の判断材料なら「投資」、金利・為替・金融政策の解説なら「金融」。"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            style={{ fontSize: '16px' }}
          />

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={onSave}
              disabled={busy}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {busy ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onStart(null)}
          className="w-full py-2.5 mb-4 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
        >
          ＋ ルールを追加
        </button>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">ルールはまだありません</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule, i) => (
            <li key={rule.id} className="border-b border-gray-50 pb-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 leading-snug">{rule.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{rule.body}</p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => onMove(i, -1)}
                    disabled={busy || i === 0}
                    className="w-6 h-6 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                    aria-label="上へ"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => onMove(i, 1)}
                    disabled={busy || i === rules.length - 1}
                    className="w-6 h-6 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                    aria-label="下へ"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => onStart(rule)}
                    disabled={busy}
                    className="px-1.5 h-6 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => onRemove(rule)}
                    disabled={busy}
                    className="px-1.5 h-6 text-xs text-gray-400 hover:text-red-600 disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-400 mt-4 leading-relaxed">
        ここに書いた内容は、動画を追加するときのAI分類にそのまま渡されます。
        似たカテゴリを取り違える場合は、その組み合わせのルールを足すと精度が上がります。
      </p>
    </>
  )
}
