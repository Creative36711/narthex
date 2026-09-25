/**
 * Генератор docs/campaign.schema.json (JSON Schema монолитного формата
 * кампании) из src/shared/types.ts — единого источника правды по формату.
 *
 * Запуск: npx tsx scripts/gen-schema.mts
 * (перегенерировать после правок типов; файл в git — схему читают внешние
 * генераторы и редакторы JSON)
 *
 * Реализация — компиляторный API TypeScript: берём корневой тип MonolithDoc
 * и рекурсивно отражаем все ссылочные типы shared/types.ts в $defs.
 */
import ts from 'typescript'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'src/shared/types.ts')
const outFile = join(root, 'docs/campaign.schema.json')
const ROOT_TYPE = 'MonolithDoc'

const program = ts.createProgram([entry], { strict: true, target: ts.ScriptTarget.ES2022 })
const sf = program.getSourceFile(entry)!
if (!sf) {
  console.error('Не удалось прочитать', entry)
  process.exit(1)
}

type Schema = Record<string, unknown>

const defs: Record<string, Schema> = {}
const computing = new Set<string>()

/** текст JSDoc-комментария объявления (для description схемы) */
function jsdocText(node: ts.Node): string | undefined {
  const anyNode = node as unknown as { jsDoc?: Array<{ comment?: string | ts.NodeArray<ts.JSDocComment> }> }
  const doc = anyNode.jsDoc?.[anyNode.jsDoc.length - 1]
  if (!doc?.comment) return undefined
  if (typeof doc.comment === 'string') return doc.comment.trim()
  return doc.comment
    .map((c) => ('text' in c ? c.text : c.getText()))
    .join('')
    .trim()
}

function withDoc(node: ts.Node, schema: Schema): Schema {
  const doc = jsdocText(node)
  return doc && !schema.description ? { ...schema, description: doc } : schema
}

/** литерал → схема */
function literalSchema(node: ts.LiteralTypeNode): Schema | undefined {
  const lit = node.literal
  if (lit.kind === ts.SyntaxKind.TrueKeyword) return { const: true }
  if (lit.kind === ts.SyntaxKind.FalseKeyword) return { const: false }
  if (lit.kind === ts.SyntaxKind.NullKeyword) return { const: null }
  if (ts.isStringLiteral(lit)) return { const: lit.text }
  if (ts.isNumericLiteral(lit)) return { const: Number(lit.text) }
  if (ts.isPrefixUnaryExpression(lit) && ts.isNumericLiteral(lit.operand)) {
    return { const: lit.operator === ts.SyntaxKind.MinusToken ? -Number(lit.operand.text) : Number(lit.operand.text) }
  }
  return undefined
}

function isUndefinedNode(node: ts.TypeNode): boolean {
  return node.kind === ts.SyntaxKind.UndefinedKeyword || (ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.UndefinedKeyword)
}

/** union → enum (если всё — литералы одного типа) либо anyOf */
function unionSchema(nodes: ts.TypeNode[]): Schema {
  const parts = nodes.filter((n) => !isUndefinedNode(n))
  const lits = parts.map((n) => (ts.isLiteralTypeNode(n) ? literalSchema(n) : undefined))
  if (lits.every((l) => l && 'const' in l)) {
    const values = lits.map((l) => (l as { const: unknown }).const)
    const t = typeof values[0]
    return values.every((v) => typeof v === t) && (t === 'string' || t === 'number')
      ? { type: t, enum: values }
      : { enum: values }
  }
  return { anyOf: parts.map(typeSchema) }
}

function membersSchema(members: ts.NodeArray<ts.TypeElement>): Schema {
  const properties: Record<string, Schema> = {}
  const required: string[] = []
  let additional: Schema | undefined

  for (const m of members) {
    if (ts.isPropertySignature(m) && m.name) {
      const name = ts.isStringLiteral(m.name) ? m.name.text : (m.name as ts.Identifier).text
      const schema = m.type ? typeSchema(m.type) : {}
      properties[name] = withDoc(m, schema)
      if (!m.questionToken) required.push(name)
    } else if (ts.isIndexSignatureDeclaration(m)) {
      additional = m.type ? typeSchema(m.type) : {}
    }
  }
  const out: Schema = { type: 'object', properties }
  if (required.length) out.required = required
  if (additional) out.additionalProperties = additional
  else out.additionalProperties = false
  return out
}

/** интерфейс: свойства предков + свои */
function collectHeritage(decl: ts.InterfaceDeclaration, members: ts.TypeElement[], seen = new Set<string>()): void {
  for (const clause of decl.heritageClauses ?? []) {
    for (const ext of clause.types) {
      const name = ext.expression.getText(sf)
      if (seen.has(name)) continue
      seen.add(name)
      const src = findTypeDecl(name)
      if (src && ts.isInterfaceDeclaration(src)) {
        collectHeritage(src, members, seen)
        members.push(...src.members)
      }
    }
  }
}

function interfaceSchema(decl: ts.InterfaceDeclaration): Schema {
  const members: ts.TypeElement[] = []
  collectHeritage(decl, members)
  members.push(...decl.members)
  return withDoc(decl, membersSchema(ts.factory.createNodeArray(members)))
}

function findTypeDecl(name: string): ts.InterfaceDeclaration | ts.TypeAliasDeclaration | undefined {
  let found: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | undefined
  sf.forEachChild((node) => {
    if (found) return
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name.text === name) found = node
  })
  return found
}

function register(name: string): void {
  if (defs[name] || computing.has(name)) return
  computing.add(name)
  const decl = findTypeDecl(name)
  if (!decl) {
    defs[name] = {}
    computing.delete(name)
    return
  }
  defs[name] = withDoc(decl, declKind(decl))
  computing.delete(name)
}

function declKind(decl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): Schema {
  if (ts.isInterfaceDeclaration(decl)) return interfaceSchema(decl)
  return typeSchema(decl.type)
}

function typeSchema(node: ts.TypeNode): Schema {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { type: 'string' }
    case ts.SyntaxKind.NumberKeyword:
      return { type: 'number' }
    case ts.SyntaxKind.BooleanKeyword:
      return { type: 'boolean' }
    case ts.SyntaxKind.NullKeyword:
      return { type: 'null' }
    case ts.SyntaxKind.AnyKeyword:
    case ts.SyntaxKind.UnknownKeyword:
      return {}
    case ts.SyntaxKind.UndefinedKeyword:
      return {}
    default:
      break
  }
  if (ts.isLiteralTypeNode(node)) {
    const l = literalSchema(node)
    return l ?? {}
  }
  if (ts.isArrayTypeNode(node)) return { type: 'array', items: typeSchema(node.elementType) }
  if (ts.isTupleTypeNode(node)) {
    return {
      type: 'array',
      prefixItems: node.elements.map((e) => typeSchema((e as ts.NamedTupleMember).type ?? (e as ts.TypeNode))),
      minItems: node.elements.length,
      maxItems: node.elements.length,
    }
  }
  if (ts.isParenthesizedTypeNode(node)) return typeSchema(node.type)
  if (ts.isUnionTypeNode(node)) return unionSchema(node.types)
  if (ts.isIntersectionTypeNode(node)) return { allOf: node.types.map(typeSchema) }
  if (ts.isTypeLiteralNode(node)) return membersSchema(node.members)
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText(sf)
    const args = node.typeArguments ?? []
    if (name === 'Array' || name === 'ReadonlyArray') {
      return { type: 'array', items: args[0] ? typeSchema(args[0]) : {} }
    }
    if (name === 'Record') {
      return { type: 'object', additionalProperties: args[1] ? typeSchema(args[1]) : {} }
    }
    if (name === 'Partial' && args[0]) {
      const inner = typeSchema(args[0])
      if (inner.required) delete inner.required
      return inner
    }
    // ссылка на локальный тип
    register(name)
    return { $ref: `#/$defs/${name}` }
  }
  console.warn('Неизвестный узел типа:', ts.SyntaxKind[node.kind], '— схема «что угодно»')
  return {}
}

// ── сборка ──
register(ROOT_TYPE)

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://chronicle-forge.local/docs/campaign.schema.json',
  title: 'Chronicle Forge — кампания одним JSON (MonolithDoc)',
  description:
    'Монолитный формат кампании Chronicle Forge: campaign, world, scenes, entities, rules, quests, arenas, cutscenes, encounters, dialogues. ' +
    'Сгенерировано из src/shared/types.ts (scripts/gen-schema.mts). Гайд для ИИ-генераторов: docs/ai-campaign-guide.md.',
  $ref: `#/$defs/${ROOT_TYPE}`,
  $defs: defs,
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(schema, null, 2) + '\n')
console.log(`OK: ${outFile} ($defs: ${Object.keys(defs).length})`)
