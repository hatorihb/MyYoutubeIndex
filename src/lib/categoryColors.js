// カテゴリ用の色パレット。
//
// Tailwind はソース上のリテラル文字列を見てクラスを生成するため、クラス名を
// DB から組み立てるとビルド時に削除されてしまう。そのため DB には色キー
// （例: 'sky-700'）だけを保存し、実際のクラス名はここに列挙しておく。
// 新しい色を使いたい場合は、このファイルに行を足すこと。
export const CATEGORY_PALETTE = {
  'amber-600': 'bg-amber-100 text-amber-600',
  'amber-700': 'bg-amber-100 text-amber-700',
  'amber-800': 'bg-amber-100 text-amber-800',
  'blue-600': 'bg-blue-100 text-blue-600',
  'blue-700': 'bg-blue-100 text-blue-700',
  'blue-800': 'bg-blue-100 text-blue-800',
  'cyan-600': 'bg-cyan-100 text-cyan-600',
  'cyan-700': 'bg-cyan-100 text-cyan-700',
  'cyan-800': 'bg-cyan-100 text-cyan-800',
  'emerald-700': 'bg-emerald-100 text-emerald-700',
  'emerald-800': 'bg-emerald-100 text-emerald-800',
  'fuchsia-700': 'bg-fuchsia-100 text-fuchsia-700',
  'fuchsia-800': 'bg-fuchsia-100 text-fuchsia-800',
  'gray-500': 'bg-gray-100 text-gray-500',
  'gray-600': 'bg-gray-100 text-gray-600',
  'green-700': 'bg-green-100 text-green-700',
  'green-800': 'bg-green-100 text-green-800',
  'indigo-600': 'bg-indigo-100 text-indigo-600',
  'indigo-700': 'bg-indigo-100 text-indigo-700',
  'indigo-800': 'bg-indigo-100 text-indigo-800',
  'lime-700': 'bg-lime-100 text-lime-700',
  'orange-600': 'bg-orange-100 text-orange-600',
  'orange-700': 'bg-orange-100 text-orange-700',
  'orange-800': 'bg-orange-100 text-orange-800',
  'pink-700': 'bg-pink-100 text-pink-700',
  'pink-800': 'bg-pink-100 text-pink-800',
  'purple-600': 'bg-purple-100 text-purple-600',
  'purple-700': 'bg-purple-100 text-purple-700',
  'purple-800': 'bg-purple-100 text-purple-800',
  'red-700': 'bg-red-100 text-red-700',
  'red-800': 'bg-red-100 text-red-800',
  'rose-600': 'bg-rose-100 text-rose-600',
  'rose-700': 'bg-rose-100 text-rose-700',
  'sky-700': 'bg-sky-100 text-sky-700',
  'sky-800': 'bg-sky-100 text-sky-800',
  'sky-900': 'bg-sky-100 text-sky-900',
  'slate-700': 'bg-slate-100 text-slate-700',
  'stone-700': 'bg-stone-100 text-stone-700',
  'teal-700': 'bg-teal-100 text-teal-700',
  'teal-800': 'bg-teal-100 text-teal-800',
  'violet-700': 'bg-violet-100 text-violet-700',
  'violet-800': 'bg-violet-100 text-violet-800',
  'yellow-700': 'bg-yellow-100 text-yellow-700',
  'yellow-800': 'bg-yellow-100 text-yellow-800',
  'zinc-700': 'bg-zinc-100 text-zinc-700',
}

export const DEFAULT_CATEGORY_COLOR = 'bg-gray-100 text-gray-600'

export const colorClassFor = (key) => CATEGORY_PALETTE[key] || DEFAULT_CATEGORY_COLOR

export const PALETTE_KEYS = Object.keys(CATEGORY_PALETTE)
