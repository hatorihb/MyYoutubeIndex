import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AddVideoModal({ onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.functions.invoke('add-video', {
      body: { url: url.trim() },
    })

    if (err || data?.error) {
      setError(err?.message || data?.error || '追加に失敗しました')
    } else {
      onAdded(data)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">動画を追加</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full py-3 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50 transition-opacity"
          >
            {loading ? 'AI分析中...' : '追加する'}
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-3">AIが自動でカテゴリ分類・要約します</p>
      </div>
    </div>
  )
}
