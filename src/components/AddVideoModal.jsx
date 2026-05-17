import { useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  'AI｜社会・未来', 'AI｜働き方・変革', 'AI｜ツール・実践', 'AI｜モデル・動向',
  'AI｜ニュース（TBS）', 'AI｜ニュース（いけとも）', 'AI｜1人起業',
  'Claude｜全般', 'Claude｜アプリ開発', 'Claude｜デザイン',
  '技術・開発',
  '育成｜組織・マネジメント', '育成｜個人成長',
  'キャリア・自己啓発', 'リーダーシップ・マネジメント', '業務プロセス変革',
  '教養・リベラルアーツ', '人生観・メンタル',
  '時事ネタ', '災害', 'その他',
]

export default function AddVideoModal({ onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [confirmedCategory, setConfirmedCategory] = useState('')
  const [confirmedRating, setConfirmedRating] = useState(8)

  const handleAnalyze = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.functions.invoke('add-video', {
      body: { url: url.trim(), preview: true },
    })

    if (err || data?.error) {
      setError(err?.message || data?.error || '分析に失敗しました')
      setLoading(false)
      return
    }

    setPreviewData(data)
    setConfirmedCategory(data.category || '')
    setConfirmedRating(data.rating ?? 8)
    setLoading(false)
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.functions.invoke('add-video', {
      body: { url: url.trim(), previewData: { ...previewData, category: confirmedCategory, rating: confirmedRating } },
    })

    if (err || data?.error) {
      setError(err?.message || data?.error || '追加に失敗しました')
      setLoading(false)
      return
    }

    if (pendingFiles.length > 0 && data?.id) {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i]
        const fileName = `${data.id}/${Date.now()}_${i}_${file.name}`
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

  if (previewData) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
          {previewData.thumbnail_url && (
            <img src={previewData.thumbnail_url} alt={previewData.title} className="w-full aspect-video object-cover rounded-t-2xl" />
          )}
          <div className="p-5">
            <p className="font-bold text-sm text-gray-900 mb-0.5 leading-snug">{previewData.title}</p>
            <p className="text-xs text-gray-500 mb-4">{previewData.channel}</p>

            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1 font-medium">カテゴリ</p>
              <select
                value={confirmedCategory}
                onChange={e => setConfirmedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                style={{ fontSize: '16px' }}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">おすすめ度</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setConfirmedRating(i + 1)}
                    className="w-7 h-7 flex-shrink-0"
                  >
                    <svg viewBox="0 0 24 24" fill={i < confirmedRating ? '#f59e0b' : 'none'} stroke={i < confirmedRating ? '#f59e0b' : '#d1d5db'} strokeWidth="1.5" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </button>
                ))}
                <span className="ml-1 text-sm font-medium text-amber-600">{confirmedRating}/10</span>
              </div>
            </div>

            {previewData.summary && (
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1 font-medium">AI要約</p>
                <p className="text-sm text-gray-700 leading-relaxed">{previewData.summary}</p>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 w-full px-4 py-3 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors mb-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-sm text-gray-400">参考ファイルを追加（任意）</span>
                <input type="file" accept=".pdf,.pptx,.ppt,.png,.jpg,.jpeg" multiple onChange={handleFileChange} className="hidden" />
              </label>
              {pendingFiles.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {pendingFiles.map((file, i) => (
                    <li key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                      <span className="truncate">{file.name}</span>
                      <button type="button" onClick={() => removeFile(i)} className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setPreviewData(null); setError('') }}
                disabled={loading}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                戻る
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {loading ? '追加中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
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

        <form onSubmit={handleAnalyze} className="space-y-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            style={{ fontSize: '16px' }}
            autoFocus
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full py-3 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50 transition-opacity"
          >
            {loading ? 'AI分析中...' : 'AI分析する'}
          </button>
        </form>
      </div>
    </div>
  )
}
