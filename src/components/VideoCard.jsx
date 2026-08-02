const categoryColors = {
  'AI｜社会・未来': 'bg-sky-100 text-sky-700',
  'AI｜働き方・変革': 'bg-sky-100 text-sky-800',
  'AI｜ツール・実践': 'bg-blue-100 text-blue-700',
  'AI｜モデル・動向': 'bg-indigo-100 text-indigo-700',
  'AI｜ニュース（TBS）': 'bg-cyan-100 text-cyan-700',
  'AI｜ニュース（いけとも）': 'bg-cyan-100 text-cyan-800',
  'AI｜1人起業': 'bg-orange-100 text-orange-600',
  'フィジカルAI': 'bg-indigo-100 text-indigo-800',
  'Claude｜全般': 'bg-orange-100 text-orange-700',
  'Claude｜アプリ開発': 'bg-amber-100 text-amber-800',
  'Claude｜デザイン': 'bg-yellow-100 text-yellow-700',
  '科学': 'bg-slate-100 text-slate-700',
  '育成｜組織・マネジメント': 'bg-purple-100 text-purple-700',
  '育成｜個人成長': 'bg-violet-100 text-violet-700',
  'キャリア・自己啓発': 'bg-amber-100 text-amber-700',
  'リーダーシップ・マネジメント': 'bg-purple-100 text-purple-600',
  '業務プロセス変革': 'bg-blue-100 text-blue-600',
  '教養・リベラルアーツ': 'bg-teal-100 text-teal-700',
  '人生観・メンタル': 'bg-rose-100 text-rose-600',
  '時事ネタ': 'bg-gray-100 text-gray-600',
  '投資': 'bg-green-100 text-green-700',
  '金融': 'bg-emerald-100 text-emerald-700',
  '災害': 'bg-red-100 text-red-700',
  '英会話': 'bg-pink-100 text-pink-700',
  '宇宙': 'bg-violet-100 text-violet-800',
  'その他': 'bg-gray-100 text-gray-500',
}

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function VideoCard({ video, onClick }) {
  const colorClass = categoryColors[video.category] || 'bg-gray-100 text-gray-600'

  return (
    <button onClick={onClick} className="text-left group w-full">
      <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden mb-2 relative">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium line-clamp-2 text-gray-900 leading-tight mb-1">{video.title}</p>
        <p className="text-xs text-gray-500 truncate">{video.channel}</p>
        <p className="text-xs text-gray-400 mb-1">{formatDate(video.created_at)}</p>
        {video.category && (
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
            {video.category}
          </span>
        )}
        {video.rating != null && (
          <div className="flex items-center gap-0.5 mt-1.5">
            {Array.from({ length: 10 }, (_, i) => (
              <svg key={i} className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill={i < video.rating ? '#f59e0b' : 'none'} stroke={i < video.rating ? '#f59e0b' : '#d1d5db'} strokeWidth="2" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            ))}
            <span className="ml-0.5 text-xs text-gray-400">{video.rating}</span>
          </div>
        )}
      </div>
    </button>
  )
}
