import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fileIcon = (type) => {
  if (type === 'pdf') return '📄'
  if (['pptx', 'ppt'].includes(type)) return '📊'
  return '📎'
}

export default function VideoDetailModal({ video, onClose }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)

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
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)

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
      await loadFiles()
    }
    setUploading(false)
    e.target.value = ''
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
            <div className="flex justify-end mb-2">
              <button onClick={onClose} className="text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <h2 className="text-base font-bold text-gray-900 mb-1 leading-snug">{video.title}</h2>
          <p className="text-sm text-gray-500 mb-3">{video.channel}</p>

          {video.category && (
            <span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full mb-3 font-medium">
              {video.category}
            </span>
          )}

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
                  <a
                    key={file.id}
                    href={getFileUrl(file.storage_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-xl">{fileIcon(file.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400 uppercase">{file.file_type}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
