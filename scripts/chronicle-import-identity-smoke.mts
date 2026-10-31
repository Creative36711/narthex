import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { readChronicleCampaignIdentity } from '../src/editor/chronicleIdentity'
import {
  importChroniclePackage,
  type ChronicleIdConflictAction,
  type ChronicleIdConflict,
  type ChronicleImportResult,
} from '../src/editor/newCampaign'
import { campaignIdFromPath } from '../src/editor/editorMenus'

const EXISTING_ID = '3b7f552a-a345-41dc-ae87-d6259cec7050'
const EXISTING_TITLE = 'Existing campaign'
const INCOMING_TITLE = 'Incoming campaign'
const EXPECTED_CHOICES: ChronicleIdConflictAction[] = ['update', 'copy', 'cancel']

interface ProbeState {
  index: Array<{ id: string; title: string }>
  installedMeta: { id: string; title: string }
  savedFiles: Map<string, string>
  saveCalls: string[]
  reservedIds: Set<string>
  deletedFolders: string[]
  conflictCalls: ChronicleIdConflict[]
}

function makeProbeServer(): { state: ProbeState; fetch: typeof globalThis.fetch } {
  const state: ProbeState = {
    index: [{ id: EXISTING_ID, title: EXISTING_TITLE }],
    installedMeta: { id: EXISTING_ID, title: EXISTING_TITLE },
    savedFiles: new Map(),
    saveCalls: [],
    reservedIds: new Set(),
    deletedFolders: [],
    conflictCalls: [],
  }

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), 'http://chronicle-import-identity.local')
    const method = init?.method ?? 'GET'

    if (method === 'POST' && url.pathname === '/__editor/reserve-campaign') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { id?: unknown }
      assert.equal(typeof body.id, 'string', 'reservation must include a campaign ID')
      assert.notEqual(body.id, EXISTING_ID, 'copy must reserve a new ID')
      state.reservedIds.add(body.id as string)
      return new Response('reserved', { status: 200 })
    }

    if (method === 'POST' && url.pathname === '/__editor/save') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { path?: unknown; text?: unknown }
      assert.equal(typeof body.path, 'string', 'save must include its destination path')
      state.saveCalls.push(body.path as string)
      if (body.path === 'campaigns/index.json') {
        assert.equal(typeof body.text, 'string', 'campaign index save must include text')
        state.index = JSON.parse(body.text as string) as ProbeState['index']
      } else {
        assert.equal(typeof body.text, 'string', 'campaign file save must include text')
        state.savedFiles.set(body.path as string, body.text as string)
      }
      return new Response('saved', { status: 200 })
    }

    if (method === 'POST' && url.pathname === '/__editor/delete') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { path?: unknown }
      if (typeof body.path === 'string') state.deletedFolders.push(body.path)
      return new Response('deleted', { status: 200 })
    }

    if (method === 'GET' && url.pathname === '/campaigns/index.json') {
      return Response.json(state.index)
    }
    if (method === 'GET' && url.pathname === '/__editor/campaign-files') {
      assert.equal(url.searchParams.get('id'), EXISTING_ID)
      return Response.json({ files: ['campaign.json'] })
    }
    if (method === 'GET' && url.pathname === `/campaigns/${EXISTING_ID}/campaign.json`) {
      return Response.json(state.installedMeta)
    }

    return new Response(`unhandled probe request: ${method} ${url.pathname}`, { status: 404 })
  }

  return { state, fetch }
}

async function packageFile(): Promise<File> {
  const zip = new JSZip()
  zip.file('campaign.json', JSON.stringify({
    id: EXISTING_ID,
    title: INCOMING_TITLE,
    author: 'identity smoke',
    description: 'Different package content, deliberately conflicting with the installed title.',
    version: '1.0.0',
    package_format: 1,
  }))
  return new File([await zip.generateAsync({ type: 'uint8array' })], 'same-id.narthex')
}

function assertActualChoice(
  action: ChronicleIdConflictAction,
  result: ChronicleImportResult,
  state: ProbeState,
): void {
  if (action === 'update') {
    assert.equal(result.id, EXISTING_ID, 'update keeps the installed campaign ID')
    assert.notEqual(result.cancelled, true, 'update is not cancellation')
    assert.ok(result.idWarning?.includes(`ID «${EXISTING_ID}» сохранён`), 'update explains the preserved ID')
    const saved = state.savedFiles.get(`campaigns/${EXISTING_ID}/campaign.json`)
    assert.ok(saved, 'update must save the imported campaign package')
    assert.equal(JSON.parse(saved).id, EXISTING_ID, 'saved campaign.json retains its existing ID')
    assert.equal(state.index.length, 1, 'update does not create a second registry entry')
    assert.equal(state.index[0]?.id, EXISTING_ID, 'updated registry entry keeps its existing ID')
    assert.equal(state.reservedIds.size, 0, 'update does not reserve a replacement ID')
    assert.deepEqual(state.saveCalls.slice().sort(), [`campaigns/${EXISTING_ID}/campaign.json`, 'campaigns/index.json'].sort(), 'update writes only the campaign and registry')
    return
  }

  if (action === 'copy') {
    assert.notEqual(result.id, EXISTING_ID, 'copy receives a distinct campaign ID')
    assert.match(result.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    assert.equal(state.reservedIds.has(result.id), true, 'copy reserves its new campaign ID')
    const saved = state.savedFiles.get(`campaigns/${result.id}/campaign.json`)
    assert.ok(saved, 'copy must write the new campaign package')
    assert.equal(JSON.parse(saved).id, result.id, 'copied campaign.json carries the new ID')
    assert.equal(state.index.length, 2, 'copy adds exactly one registry entry')
    assert.deepEqual(state.index.map((entry) => entry.id).sort(), [EXISTING_ID, result.id].sort())
    assert.ok(result.idWarning?.includes(EXISTING_ID), 'copy explains why a new ID was assigned')
    assert.deepEqual(state.saveCalls.slice().sort(), [`campaigns/${result.id}/campaign.json`, 'campaigns/index.json'].sort(), 'copy writes only the new campaign and registry')
    return
  }

  assert.equal(result.cancelled, true, 'cancel returns the cancelled outcome')
  assert.equal(result.id, EXISTING_ID, 'cancel reports the conflict identity')
  assert.equal(state.savedFiles.size, 0, 'cancel writes no campaign files')
  assert.equal(state.index.length, 1, 'cancel does not change the registry')
  assert.equal(state.index[0]?.id, EXISTING_ID)
  assert.equal(state.reservedIds.size, 0, 'cancel reserves no ID')
  assert.deepEqual(state.saveCalls, [], 'cancel performs no save requests')
  assert.deepEqual(state.deletedFolders, [], 'cancel has no cleanup side effect')
}

const originalFetch = globalThis.fetch
const rows: Array<{ choice: string; result: string; id: string; writes: number }> = []
try {
  const stableId = campaignIdFromPath(`/campaigns/${EXISTING_ID}`)
  assert.equal(stableId, EXISTING_ID, 'the open campaign path is the stable identity')

  for (const choice of EXPECTED_CHOICES) {
    const server = makeProbeServer()
    globalThis.fetch = server.fetch
    const file = await packageFile()
    const identity = await readChronicleCampaignIdentity(file)
    assert.deepEqual(identity, { id: EXISTING_ID, title: INCOMING_TITLE }, 'package identity is read before conflict resolution')

    const result = await importChroniclePackage(file, async (conflict) => {
      server.state.conflictCalls.push(conflict)
      assert.equal(conflict.id, EXISTING_ID)
      assert.equal(conflict.existingTitle, EXISTING_TITLE)
      assert.equal(conflict.incomingTitle, INCOMING_TITLE)
      assert.equal(conflict.identicalPackage, false)
      return choice
    })

    assert.equal(server.state.conflictCalls.length, 1, `${choice}: the actual package conflict asks for a choice`)
    assertActualChoice(choice, result, server.state)
    rows.push({
      choice,
      result: choice === 'update' ? 'updated; ID preserved' : choice === 'copy' ? 'copied; new ID' : 'cancelled; no writes',
      id: result.id,
      writes: server.state.saveCalls.length,
    })
  }

  // A callable placeholder has the right type but cannot perform any choice.
  const typeofOnlyState = makeProbeServer().state
  const typeofOnlyStub = async (): Promise<ChronicleImportResult> => ({ id: EXISTING_ID, title: INCOMING_TITLE })
  assert.equal(typeof typeofOnlyStub, 'function', 'the old type-only assertion would pass')
  const placeholder = await typeofOnlyStub()
  assert.throws(
    () => assertActualChoice('update', placeholder, typeofOnlyState),
    /update explains the preserved ID/,
    'the behavior oracle must reject a typeof-only placeholder',
  )

  console.log('| choice | observed result | campaign ID | writes |')
  console.log('| --- | --- | --- | ---: |')
  for (const row of rows) console.log(`| ${row.choice} | ${row.result} | ${row.id} | ${row.writes} |`)
  console.log('✓ typeof-only negative control rejected; update/copy/cancel all exercised the import conflict flow')
  console.log('CHRONICLE_IMPORT_IDENTITY_SMOKE passed')
} finally {
  globalThis.fetch = originalFetch
}
