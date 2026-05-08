const categoryColors = {
  '技術': 'bg-blue-100 text-blue-700',
  '料理': 'bg-orange-100 text-orange-700',
  '音楽': 'bg-purple-100 text-purple-700',
  'ゲーム': 'bg-green-100 text-green-700',
  '教育': 'bg-yellow-100 text-yellow-700',
  'ニュース': 'bg-gray-100 text-gray-700',
  'エンタメ': 'bg-pink-100 text-pink-700',
  'スポーツ': 'bg-teal-100 text-teal-700',
  'ビジネス': 'bg-indigo-100 text-indigo-700',
  'マーケティング・営業': 'bg-indigo-100 text-indigo-700',
  '投賄・金融': 'bg-emerald-100 text-emerald-700',
  '経営・戦略': 'bg-violet-100 text-violet-700',
  'キャリア・自己啓発': 'bg-amber-100 text-amber-700',
  '起業・スタートアップ': 'bg-rose-100 text-rose-700',
  '健康': 'bg-lime-100 text-lime-700',
  '旅行': 'bg-cyan-100 text-cyan-700',
  'その他': 'bg-gray-100 text-gray-600',
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
        <p className="text-xs text-gray-500 mb-1 truncate">{video.channel}</p>
        {video.category && (
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
            {video.category}
          </span>
        )}
      </div>
    </button>
  )
}
