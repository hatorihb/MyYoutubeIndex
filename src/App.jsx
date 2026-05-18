import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabase'
import VideoCard from './components/VideoCard'
import AddVideoModal from './components/AddVideoModal'
import VideoDetailModal from './components/VideoDetailModal'
import ScrollRow from './components/ScrollRow'

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [videos, setVideos] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState(new Set())
  const [primarySort, setPrimarySort] = useState('date')
  const [ratingDir, setRatingDir] = useState('desc')
  const [dateDir, setDateDir] = useState('desc')
  const [selectedRatings, setSelectedRatings] = useState(new Set([8, 9, 10]))

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoginError('メールアドレスまたはパスワードが違います')
  }

  const loadVideos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })
    setVideos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadVideos() }, [loadVideos])

  const categories = useMemo(() =>
    [...new Set(videos.map(v => v.category).filter(Boolean))].sort(),
    [videos]
  )

  const displayedVideos = useMemo(() => {
    if (isSearchMode) return searchResults
    let base = selectedCategories.size > 0 ? videos.filter(v => selectedCategories.has(v.category)) : videos
    if (selectedRatings.size === 0) return []
    base = base.filter(v => selectedRatings.has(v.rating ?? 0))
    return [...base].sort((a, b) => {
      const dA = new Date(a.created_at), dB = new Date(b.created_at)
      const dateDiff = dateDir === 'desc' ? dB - dA : dA - dB
      const rDiff = ratingDir === 'desc'
        ? (b.rating ?? 0) - (a.rating ?? 0)
        : (a.rating ?? 0) - (b.rating ?? 0)
      return primarySort === 'date'
        ? (dateDiff !== 0 ? dateDiff : rDiff)
        : (rDiff !== 0 ? rDiff : dateDiff)
    })
  }, [isSearchMode, searchResults, selectedCategories, videos, primarySort, ratingDir, dateDir, selectedRatings])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setIsSearchMode(false)
      return
    }
    setSearching(true)
    setIsSearchMode(true)
    setSelectedCategories(new Set())
    setSelectedRatings(new Set())
    const { data } = await supabase.functions.invoke('search-videos', {
      body: { query: searchQuery },
    })
    setSearchResults(data || [])
    setSearching(false)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setIsSearchMode(false)
    setSearchResults([])
  }

  const handleVideoAdded = () => {
    loadVideos()
    setShowAddModal(false)
  }

  if (authLoading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!session) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-sm w-80 flex flex-col gap-4">
        <div className="flex items-center gap-2 justify-center mb-2">
          <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900">MyYoutubeIndex</h1>
        </div>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="メールアドレス" className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400" required />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="パスワード" className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400" required />
        {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
        <button type="submit" className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600">ログイン</button>
      </form>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">MyYoutubeIndex</h1>
            <span className="ml-auto text-xs text-gray-400">{displayedVideos.length}本</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ログアウト
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="キーワードで検索"
                className="w-full pl-9 pr-8 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-red-400"
                style={{fontSize: '16px'}}
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {isSearchMode && (
                <button type="button" onClick={handleClearSearch} className="absolute right-3 top-2.5 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 bg-red-500 text-white rounded-full text-sm font-medium disabled:opacity-50 flex-shrink-0"
            >
              {searching ? '...' : '検索'}
            </button>
          </form>

          {!isSearchMode && (
            <div className="mb-1.5">
              <ScrollRow gap="gap-1.5">
                <button
                  onClick={() => {
                    if (primarySort !== 'date') setPrimarySort('date')
                    else setDateDir(d => d === 'desc' ? 'asc' : 'desc')
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    primarySort === 'date' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <svg className={`w-3 h-3 transition-transform ${dateDir === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m8 0l4-4m0 0l4 4m-4-4v12"/>
                  </svg>
                  {dateDir === 'desc' ? '新しい順' : '古い順'}
                </button>
                <button
                  onClick={() => {
                    if (primarySort !== 'rating') setPrimarySort('rating')
                    else setRatingDir(d => d === 'desc' ? 'asc' : 'desc')
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    primarySort === 'rating' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  {ratingDir === 'desc' ? '高い順' : '低い順'}
                </button>
                <div className="w-px bg-gray-200 mx-1 self-stretch" />
                <button
                  onClick={() => setSelectedRatings(prev =>
                    prev.size === 10 ? new Set() : new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
                  )}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedRatings.size === 10 ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  すべて
                </button>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
                  <button
                    key={r}
                    onClick={() => setSelectedRatings(prev => {
                      const next = new Set(prev)
                      next.has(r) ? next.delete(r) : next.add(r)
                      return next
                    })}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedRatings.has(r) ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    ★{r}
                  </button>
                ))}
              </ScrollRow>
            </div>
          )}

          {!isSearchMode && categories.length > 0 && (
            <ScrollRow>
              <button
                onClick={() => setSelectedCategories(new Set())}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategories.size === 0 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                すべて
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategories(prev => {
                    const next = new Set(prev)
                    next.has(cat) ? next.delete(cat) : next.add(cat)
                    return next
                  })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCategories.has(cat) ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </ScrollRow>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 pb-24">
        {isSearchMode && !searching && (
          <p className="text-sm text-gray-500 mb-3">「{searchQuery}」— {displayedVideos.length}件</p>
        )}
        {!isSearchMode && selectedCategories.size > 0 && (
          <p className="text-sm text-gray-500 mb-3">{[...selectedCategories].join('・')} — {displayedVideos.length}件</p>
        )}

        {searching ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">検索中...</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedVideos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <p className="font-medium">
              {isSearchMode ? '該当する動画がありません' : selectedCategories.size > 0 ? '該当する動画がありません' : '動画がありません'}
            </p>
            {!isSearchMode && selectedCategories.size === 0 && <p className="text-sm mt-1">下の＋ボタンから追加しましょう</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayedVideos.map(video => (
              <VideoCard key={video.id} video={video} onClick={() => setSelectedVideo(video)} />
            ))}
          </div>
        )}
      </main>

      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-600 active:scale-95 transition-transform z-10"
        aria-label="動画を追加"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {showAddModal && (
        <AddVideoModal onClose={() => setShowAddModal(false)} onAdded={handleVideoAdded} />
      )}
      {selectedVideo && (
        <VideoDetailModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onDeleted={() => { setSelectedVideo(null); loadVideos() }}
          onCategoryChanged={(cat) => {
            setSelectedVideo(v => ({ ...v, category: cat }))
            loadVideos()
          }}
          onRatingChanged={(rating) => {
            setSelectedVideo(v => ({ ...v, rating }))
            loadVideos()
          }}
        />
      )}
    </div>
  )
}
