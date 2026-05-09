import { useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  '技術', '料理', '音楽', 'ゲーム', '教育', 'ニュース', 'エンタメ', 'スポーツ',
  'マーケティング・営業', '投資・金融', '経営・戦略', 'キャリア・自己啓発',
  '起業・スタートアップ', '健康', '旅行',
  'AI時代を考える', 'AI tech', 'AI他社状況', 'AI関連（TBS CRSS DIG）',
  'AIニュース（いけともch）', 'AI1人起業',
  'Claude関連', 'Claude Codeによるアプリ開発', 'Claude Design関連',
  'GitHub関連', '業務プロセス変革', '人生観', 'ビジネススキル',
  'リーダーシップ・マネジメント', 'キャリア関連', 'リベラルアーツ関連',
  '教養関連', 'メンタル関連', '育成関連', '時事ネタ', 'その他',
]

export default function AddVideoModal({ onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')

    const body = { url: url.trim() }
    if (category) body.category = category

    const { data, error: err } = await supabase.functions.invoke('add-video', { body })

    if (err || data?.error) {
      setError(err?.message || data?.error || '追加に失敗しました')
      setLoading(false)
      return
    }

    if (pendingFiles.length > 0 && data?.id) {
      for (const file of pendingFiles) {
        const fileName = `${data.id}/${Date.now()}_${file.name}`
        const { data: storageData, error: storageErr } = await supabase.storage
          .from('notebooks')
          .upload(fileName, file)
        if (!storageErr) {
          await supabase.from('files').insert({
            video_id: data.id,
            name: file.name,
            file_type: file.name.split('.').pop().toLowerCase(),
            storage_path: storageData.path,
          })
        }
      }
    }

    onAdded(data)
    setLoading(false)
  }

  const handleFileChange = (e) => {
    setPendingFiles(prev => [...prev, ...Array.from(e.target.files)])
    e.target.value = ''
  }

  const removeFile = (index) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">動画を追加</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            style={{fontSize: '16px'}}
            autoFocus
          />

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400"
            style={{fontSize: '16px'}}
          >
            <option value="">AIが自動でカテゴリを選択</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div>
            <label className="flex items-center gap-2 w-full px-4 py-3 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm text-gray-400">参考ファイルを追加（任意）</span>
              <input
                type="file"
                accept=".pdf,.pptx,.ppt,.png,.jpg,.jpeg"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {pendingFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {pendingFiles.map((file, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full py-3 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50 transition-opacity"
          >
            {loading ? 'AI分析中...' : '追加する'}
          </button>
        </form>
      </div>
    </div>
  )
}
