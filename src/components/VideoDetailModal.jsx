import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  '技術', '料理', '音楽', 'ゲーム', '教育', 'ニュース', 'エンタメ', 'スポーツ',
  'マーケティング・営業', '投資・金融', '経営・戦略', 'キャリア・自己問発',
  '起業・スタートアップ', '健康', '旅行',
  'AI時代を考える', 'AI tech', 'AI他社状況', 'AI関連（TBS CRSS DIG）',
  'AIニュース（いけともch）', 'AI1人起業',
  'Claude関連', 'Claude Codeによるアプリ開発', 'Claude Design関連',
  'GitHub関連', '業務プロセス変革', '人生観', 'ビジネススキル',
  'リーダーシップ・マネジメント', 'キャリア関連', 'リベラルアーツ関連',
  '教養関連', 'メンタル関連', '育成関連', '時事ネタ', 'その他',
]

const fileIcon = (type) => {
  if (type === 'pdf') return '📄'
  if (['pptx', 'ppt'].includes(type)) return '📊'
  return '📎'
}

export default function VideoDetailModal({ video, onClose, onDeleted, onCategoryChanged }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState(video.category || '')
  const [editingCategory, setEditingCategory] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`「${video.title}」を削除しますか？`)) return
    await supabase.from('videos').delete().eq('id', video.id)
    onDeleted()
  }

  const handleCategoryChange = async (newCategory) => {
    setCategory(newCategory)
    setEditingCategory(false)
    const { error } = await supabase.from('videos').update({ category: newCategory }).eq('id', video.id)
    if (!error) onCategoryChanged?.(newCategory)
  }

  useEffect(() => {
    loadFiles()
  }, [video.id])

  const loadFiles = async () => {
    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('video_id', video.id)
      .order('created_at', { ascending: false })
    setFiles(data || [])
  }

  const handleFileUpload = async (e) => {
    const selected = Array.from(e.target.files)
    if (!selected.length) return
    setUploading(true)
    for (const file of selected) {
      const fileName = `${video.id}/${Date.now()}_${file.name}`
      const { data: storageData, error: storageErr } = await supabase.storage
        .from('notebooks')
        .upload(fileName, file)
      if (!storageErr) {
        await supabase.from('files').insert({
          video_id: video.id,
          name: file.name,
          file_type: file.name.split('.').pop().toLowerCase(),
          storage_path: storageData.path,
        })
      }
    }
    await loadFiles()
    setUploading(false)
    e.target.value = ''
  }

  const handleFileDelete = async (file) => {
    await supabase.storage.from('notebooks').remove([file.storage_path])
    await supabase.from('files').delete().eq('id', file.id)
    setFiles(prev => prev.filter(f => f.id !== file.id))
  }

  const getFileUrl = (path) => {
    const { data } = supabase.storage.from('notebooks').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {video.thumbnail_url && (
          <div className="aspect-video w-full relative flex-shrink-0">
            <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover rounded-t-2xl" />
            <button
              onClick={handleDelete}
              className="absolute top-3 left-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-red-600/80"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="p-5">
          {!video.thumbnail_url && (
            <div className="flex justify-between mb-2">
              <button onClick={handleDelete} className="text-red-400 hover:text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button onClick={onClose} className="text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <h2 className="text-base font-bold text-gray-900 mb-1 leading-snug">{video.title}</h2>
          <p className="text-sm text-gray-500 mb-3">{video.channel}</p>

          <div className="mb-3">
            {editingCategory ? (
              <select
                autoFocus
                value={category}
                onChange={e => handleCategoryChange(e.target.value)}
                onBlur={() => setEditingCategory(false)}
                className="text-xs border border-red-300 rounded-full px-3 py-1 text-red-700 bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => setEditingCategory(true)}
                className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium hover:bg-red-200"
              >
                {category || 'カテゴリなし'}
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                </svg>
              </button>
            )}
          </div>

          {video.summary && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1 font-medium">AI要約</p>
              <p className="text-sm text-gray-700 leading-relaxed">{video.summary}</p>
            </div>
          )}

          {video.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {video.tags.slice(0, 8).map(tag => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <a
            href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-full py-2.5 border border-red-500 text-red-500 rounded-xl text-sm font-medium mb-5 justify-center hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
            YouTubeで見る
          </a>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">NotebookLMファイル</h3>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.pptx,.ppt,.png,.jpg,.jpeg"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <span className="text-sm text-red-500 font-medium">
                  {uploading ? 'アップロード中...' : '+ 追加'}
                </span>
              </label>
            </div>

            {files.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4 border-2 border-dashed border-gray-200 rounded-xl">
                NotebookLMのPDF・PPTXをアップロードできます
              </p>
            ) : (
              <div className="space-y-2">
                {files.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xl">{fileIcon(file.file_type)}</span>
                    <a
                      href={getFileUrl(file.storage_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 hover:opacity-70"
                    >
                      <p className="text-sm text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400 uppercase">{file.file_type}</p>
                    </a>
                    <button
                      onClick={() => handleFileDelete(file)}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
