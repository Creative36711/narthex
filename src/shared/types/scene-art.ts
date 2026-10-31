import type { TimeOfDay } from './world'


/** Простое декларативное условие для состояний сцены / слотов */
export interface SceneCondition {
  time_of_day?: TimeOfDay | TimeOfDay[]
  flag?: string
  not_flag?: string
  /** текущая погода (блок 9 ТЗ) */
  weather?: string
}

// ─────────────── декларативная графика (итерация 8, блок D) ───────────────

/**
 * Заливка примитива: сплошной цвет или линейный градиент.
 * `angle` — направление градиента в градусах (0 — слева направо).
 */
export type ArtFill = string | { color?: string; gradient?: { from: string; to: string; angle?: number } }

interface ArtShapeBase {
  /** прозрачность 0…1 */
  opacity?: number
  /** поворот вокруг своего центра, градусы */
  rotate?: number
}

export interface ArtRect extends ArtShapeBase {
  type: 'rect'
  x: number
  y: number
  w: number
  h: number
  fill?: ArtFill
  stroke?: string
  stroke_width?: number
  radius?: number
}

export interface ArtEllipse extends ArtShapeBase {
  type: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
  fill?: ArtFill
  stroke?: string
  stroke_width?: number
}

export interface ArtPolygon extends ArtShapeBase {
  type: 'polygon'
  /** точки в виде [x1, y1, x2, y2, …] в координатах холста */
  points: number[]
  fill?: ArtFill
  stroke?: string
  stroke_width?: number
}

export interface ArtLine extends ArtShapeBase {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  color?: string
  width?: number
}

export interface ArtText extends ArtShapeBase {
  type: 'text'
  x: number
  y: number
  text: string
  size?: number
  color?: string
  /** 'start' | 'middle' | 'end' — как в SVG */
  align?: 'start' | 'middle' | 'end'
  bold?: boolean
  italic?: boolean
  font?: string
}

export type ArtShape = ArtRect | ArtEllipse | ArtPolygon | ArtLine | ArtText

export interface ArtLayer {
  /** подпись слоя для мастера («небо», «гора», «стена») */
  label?: string
  shape: ArtShape
  opacity?: number
  rotate?: number
}

/**
 * Векторная «картинка из JSON»: слои примитивов в координатах холста
 * (по умолчанию 1280×720 — та же система, что у слотов сцены).
 * Формат рассчитан на генерацию ИИ: нарисовав сцену примитивами, генератор
 * сам знает координаты объектов и ставит слоты точно на них.
 */
export interface ArtDoc {
  canvas?: { w: number; h: number }
  background?: string
  layers: ArtLayer[]
}

/** изображение пакета либо цикл кадров для «живых» сцен (frame-swap анимация):
 *  строка — статично (все старые кампании); массив строк — кадры без настроек;
 *  объект — кадры + темп (кадр/с, умолч. 2) + зацикленность (умолч. true). */
export type ImageValue = string | string[] | { frames: string[]; fps?: number; loop?: boolean } | SheetDoc

/**
 * Спрайт-лист: один файл-лист с кадрами раскладки N×M (мастерская анимация
 * без нарезки: «идёт дым», «горит окно», покачивание моря). Размер кадра
 * выводится из размеров файла / сетки.
 */
export interface SheetDoc {
  /** файл пакета или ссылка (PNG/WEBP с раскладкой) */
  sheet: string
  /** число колонок кадров */
  cols: number
  /** число строк кадров */
  rows: number
  /** кадров в секунду (умолчание 8) */
  fps?: number
  /** повторять цикл (умолчание true) */
  loop?: boolean
}

/**
 * Кинематографическая камера фона: медленный пан-зум состояния сцены или
 * слайда катсцены («пролёт» по картине, приближение на лицо). Проценты — от
 * общей ширины/высоты изображения; зум >1 приближает, <1 отдаляет.
 */
export interface CameraDoc {
  /** целевой зум (умолчание 1) */
  zoom?: number
  /** горизонтальный сдвиг кадрирования, -50…50 % ширины (умолчание 0) */
  pan_x?: number
  /** вертикальный сдвиг кадрирования, -50…50 % высоты (умолчание 0) */
  pan_y?: number
  /** секунды перехода к позиции (умолчание 8; 0 — мгновенно) */
  duration?: number
}

export interface SceneStateDef {
  id: string
  label: string
  /** фон-изображение (файл пакета или ссылка); можно цикл кадров (ImageValue) */
  image?: ImageValue
  /** фон, нарисованный примитивами (вместо image) */
  art?: ArtDoc
  /** кинематографическая камера фона состояния (пан-зум) */
  camera?: CameraDoc
  /** звук, воспроизводимый один раз при переключении сцены в это состояние */
  sound?: string
  sound_volume?: number
  condition: SceneCondition | null
}

/** тип слота — id из реестра кампании slot_types (мастер может добавлять свои) */
export type SlotType = string
