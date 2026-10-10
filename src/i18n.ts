import type { Lang } from './lib/model'

export type T = (s: string, ...args: (string | number)[]) => string

/** English source string → Ukrainian. `{0}`, `{1}` are placeholders for interpolated values. */
export const UK: Record<string, string> = {
  'Fourier epicycles': 'Епіцикли Фур’є',
  'Draw any shape and watch rotating circles redraw it.': 'Намалюйте будь-яку фігуру, а обертові кола перемалюють її.',
  'Drawing is approximated by a Fourier series. Everything runs in your browser.': 'Малюнок наближається рядом Фур’є. Усе працює у вашому браузері.',
  'Source on GitHub': 'Код на GitHub',
  Path: 'Контур',
  'Draw on the canvas with mouse, finger or pen. The shape closes itself.': 'Малюйте на полотні мишею, пальцем чи пером. Фігура замикається сама.',
  Presets: 'Взірці',
  Heart: 'Серце',
  Star: 'Зірка',
  Butterfly: 'Метелик',
  Infinity: 'Нескінченність',
  Trefoil: 'Трилисник',
  Pi: 'Пі',
  'Upload SVG': 'Завантажити SVG',
  'Clear': 'Очистити',
  "Couldn't read any shapes from that SVG.": 'У цьому SVG не знайдено фігур.',
  'Draw something bigger.': 'Намалюйте щось більше.',
  Epicycles: 'Епіцикли',
  'Terms: {0} of {1}': 'Членів: {0} з {1}',
  All: 'Усі',
  'Seconds per turn': 'Секунд на оберт',
  Display: 'Показ',
  Circles: 'Кола',
  Arms: 'Стрілки',
  Trail: 'Слід',
  'Original path': 'Вихідний контур',
  'Full reconstructed path': 'Увесь відновлений контур',
  Export: 'Експорт',
  'Export GIF': 'Зберегти GIF',
  'Record WebM': 'Записати WebM',
  'Rendering frame {0} of {1}…': 'Кадр {0} з {1}…',
  'Recording… {0}%': 'Запис… {0}%',
  'Video recording is not supported in this browser.': 'Цей браузер не підтримує запис відео.',
  Cancel: 'Скасувати',
  Settings: 'Налаштування',
  Language: 'Мова',
  Theme: 'Тема',
  System: 'Системна',
  Light: 'Світла',
  Dark: 'Темна',
  Pause: 'Пауза',
  Play: 'Відтворити',
  'Position along the path': 'Положення на контурі',
  'Fit error (RMS)': 'Похибка наближення (RMS)',
  'of the shape size': 'від розміру фігури',
  'Largest terms': 'Найбільші члени',
  Frequency: 'Частота',
  Radius: 'Радіус',
  Phase: 'Фаза',
  'Fourier epicycle canvas. Draw a shape here.': 'Полотно епіциклів. Малюйте тут фігуру.',
}

export function tr(lang: Lang, s: string, ...args: (string | number)[]): string {
  const src = lang === 'uk' ? (UK[s] ?? s) : s
  return src.replace(/\{(\d+)\}/g, (_, i: string) => String(args[+i]))
}
