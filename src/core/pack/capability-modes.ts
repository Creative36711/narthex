export type CapabilityMode = 'core' | 'code' | 'off'

export interface CapabilityModeDefinition {
  id: string
  status: string
}

export interface ProjectCapabilityOptions {
  mode?: CapabilityMode
  version?: number
}

export interface ProjectCapabilityInput {
  kind?: unknown
  caps?: unknown
  cap_options?: unknown
  code?: unknown
  [key: string]: unknown
}

export interface CapabilityModesReady {
  status: 'ready'
  declaredCaps: string[] | null
  activeCaps: string[] | null
  modes: Record<string, CapabilityMode>
}

export interface CapabilityModesInvalid {
  status: 'invalid'
  code: 'CAPABILITY_MODE_INVALID'
  message: string
}

export type CapabilityModesResolution = CapabilityModesReady | CapabilityModesInvalid

const ENABLED_STATUSES = new Set(['stable', 'experimental'])
const MODES = new Set<CapabilityMode>(['core', 'code', 'off'])
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

/** Resolve project capability modes without removing or rewriting project data. */
export function resolveProjectCapabilityModes(
  project: ProjectCapabilityInput,
  capabilities: readonly CapabilityModeDefinition[],
  requiredCaps: readonly string[] = [],
): CapabilityModesResolution {
  const capabilityById = new Map(capabilities.map((capability) => [capability.id, capability]))
  const modes: Record<string, CapabilityMode> = {}
  if (project.caps === undefined) {
    if (project.cap_options !== undefined && (!isRecord(project.cap_options) || Object.keys(project.cap_options).length > 0)) {
      return invalid('cap_options требует явный массив caps в project.json.')
    }
    return { status: 'ready', declaredCaps: null, activeCaps: null, modes }
  }
  if (!Array.isArray(project.caps)) return invalid('project.json: caps должен быть массивом id возможностей.')

  const declaredCaps: string[] = []
  const seen = new Set<string>()
  for (const value of project.caps) {
    if (typeof value !== 'string' || !value.trim()) return invalid('project.json: каждый caps id должен быть непустой строкой.')
    const id = value.trim()
    if (seen.has(id)) return invalid(`project.json: возможность «${id}» указана в caps несколько раз.`)
    const definition = capabilityById.get(id)
    if (!definition) return invalid(`project.json: неизвестная возможность «${id}».`)
    if (!ENABLED_STATUSES.has(definition.status)) return invalid(`project.json: возможность «${id}» нельзя включить (status: ${definition.status}).`)
    seen.add(id)
    declaredCaps.push(id)
    modes[id] = 'core'
  }

  const options = project.cap_options === undefined ? {} : project.cap_options
  if (!isRecord(options)) return invalid('project.json: cap_options должен быть объектом.')
  for (const [id, value] of Object.entries(options)) {
    if (!seen.has(id)) return invalid(`project.json: cap_options["${id}"] должен ссылаться на возможность из caps.`)
    if (!isRecord(value)) return invalid(`project.json: cap_options["${id}"] должен быть объектом.`)
    if (Object.keys(value).some((key) => key !== 'mode' && key !== 'version')) {
      return invalid(`project.json: cap_options["${id}"] содержит неизвестное поле.`)
    }
    const mode = value.mode === undefined ? 'core' : value.mode
    if (typeof mode !== 'string' || !MODES.has(mode as CapabilityMode)) {
      return invalid(`project.json: cap_options["${id}"].mode должен быть core, code или off.`)
    }
    if (value.version !== undefined && (!Number.isInteger(value.version) || Number(value.version) < 1)) {
      return invalid(`project.json: cap_options["${id}"].version должен быть целым числом ≥ 1.`)
    }
    if (mode === 'off' && requiredCaps.includes(id)) {
      return invalid(`project.json: обязательную для kind возможность «${id}» нельзя выключить.`)
    }
    if (mode === 'code' && (!isRecord(project.code) || typeof project.code.entry !== 'string' || !project.code.entry.trim())) {
      return invalid(`project.json: для режима code возможности «${id}» требуется code.entry.`)
    }
    modes[id] = mode as CapabilityMode
  }

  return {
    status: 'ready',
    declaredCaps,
    activeCaps: declaredCaps.filter((id) => modes[id] !== 'off'),
    modes,
  }
}

function invalid(message: string): CapabilityModesInvalid {
  return { status: 'invalid', code: 'CAPABILITY_MODE_INVALID', message }
}

export function projectCapabilityMode(
  project: ProjectCapabilityInput,
  capabilityId: string,
): CapabilityMode {
  const options = isRecord(project.cap_options) ? project.cap_options : {}
  const option = isRecord(options[capabilityId]) ? options[capabilityId] : {}
  return option.mode === 'code' || option.mode === 'off' ? option.mode : 'core'
}
