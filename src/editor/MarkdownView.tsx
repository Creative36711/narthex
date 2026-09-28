import type { ReactNode } from 'react'

function inline(text: string, onNavigate: (file: string) => void, keyPrefix: string): ReactNode[] {
  const pattern = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  const out: ReactNode[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > last) out.push(text.slice(last, start))
    const token = match[0]
    if (token.startsWith('![')) {
      const parts = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (parts) out.push(<img key={`${keyPrefix}-${index++}`} className="book-inline-image" src={parts[2]} alt={parts[1]} />)
    } else if (token.startsWith('[')) {
      const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (parts) {
        const isBookFile = /(?:^|\/)(?:README|0[1-9]-[a-z-]+)\.md(?:#.*)?$/.test(parts[2])
        out.push(isBookFile
          ? <button key={`${keyPrefix}-${index++}`} className="book-inline-link" onClick={() => onNavigate(parts[2].split('/').pop()!.split('#')[0])}>{parts[1]}</button>
          : <a key={`${keyPrefix}-${index++}`} href={parts[2]} target="_blank" rel="noreferrer">{parts[1]}</a>)
      }
    } else if (token.startsWith('**')) out.push(<strong key={`${keyPrefix}-${index++}`}>{token.slice(2, -2)}</strong>)
    else if (token.startsWith('`')) out.push(<code key={`${keyPrefix}-${index++}`}>{token.slice(1, -1)}</code>)
    else out.push(<em key={`${keyPrefix}-${index++}`}>{token.slice(1, -1)}</em>)
    last = start + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

/** строка начинает новый markdown-блок (значит, продолжением предыдущего быть не может) */
const isBlockStart = (raw: string) => /^(#{1,4}\s|[-*+]\s|\d+[.)]\s|>|```|\||-{3,}$)/.test(raw.trim())

/** непустые строки-продолжения (мягкий перенос внутри пункта/абзаца), склеенные пробелом */
function continuation(lines: string[], from: number): { text: string; next: number } {
  const parts: string[] = []
  let i = from
  while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
    parts.push(lines[i].trim())
    i++
  }
  return { text: parts.join(' '), next: i }
}

export function MarkdownView({ source, onNavigate }: { source: string; onNavigate: (file: string) => void }) {
  const lines = source.split(/\r?\n/)
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      const Tag = `h${heading[1].length}` as 'h1' | 'h2' | 'h3' | 'h4'
      blocks.push(<Tag key={key++}>{inline(heading[2], onNavigate, `h${i}`)}</Tag>)
      i++; continue
    }
    if (/^```/.test(line)) {
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
      i++
      blocks.push(<pre className="book-code" key={key++}><code>{code.join('\n')}</code></pre>)
      continue
    }
    if (line.startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const heads = cells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]))
      blocks.push(<div className="book-table-wrap" key={key++}><table className="book-table"><thead><tr>{heads.map((cell, n) => <th key={n}>{inline(cell, onNavigate, `th${n}`)}</th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{inline(cell, onNavigate, `td${r}-${c}`)}</td>)}</tr>)}</tbody></table></div>)
      continue
    }
    if (/^[-*+]\s+/.test(line)) {
      const items: Array<{ text: string; nested: boolean }> = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const raw = lines[i]
        const nested = /^\s{2,}[-*+]\s+/.test(raw)
        let text = raw.replace(/^\s*[-*+]\s+/, '').trim()
        i++
        // мягкий перенос: строки-продолжения пункта (с отступом или без) склеиваем
        const cont = continuation(lines, i)
        if (cont.text) { text += ` ${cont.text}`; i = cont.next }
        items.push({ text, nested })
      }
      blocks.push(<ul key={key++}>{items.map((item, n) => <li key={n} className={item.nested ? 'book-li-nested' : undefined}>{inline(item.text, onNavigate, `ul${n}`)}</li>)}</ul>)
      continue
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      let startNum = 1
      const first = lines[i].match(/^\s*(\d+)[.)]\s+/)
      if (first) startNum = Number(first[1])
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        let text = lines[i].replace(/^\s*\d+[.)]\s+/, '').trim()
        i++
        const cont = continuation(lines, i)
        if (cont.text) { text += ` ${cont.text}`; i = cont.next }
        items.push(text)
      }
      blocks.push(<ol key={key++} start={startNum === 1 ? undefined : startNum}>{items.map((item, n) => <li key={n}>{inline(item, onNavigate, `ol${n}`)}</li>)}</ol>)
      continue
    }
    if (line.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push(<blockquote key={key++}>{inline(quote.join(' '), onNavigate, `q${i}`)}</blockquote>)
      continue
    }
    if (/^---+$/.test(line)) { blocks.push(<hr key={key++} />); i++; continue }
    // абзац: мягкие переносы исходника склеиваются пробелом (как в настоящем markdown)
    const paragraph = [line]
    i++
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) paragraph.push(lines[i++].trim())
    blocks.push(<p key={key++}>{inline(paragraph.join(' '), onNavigate, `p${key}`)}</p>)
  }
  return <div className="book-markdown">{blocks}</div>
}
