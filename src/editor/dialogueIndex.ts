import type { EditorStore } from './store'

/** есть ли у ink визуальный исходник конструктора */
export function hasDlgDoc(store: EditorStore, inkPath: string): boolean {
  return store.jsonFiles.has(inkPath.replace(/\.ink$/, '.dlg.json'))
}

/** название диалога (для списков): подпись документа, иначе имя персонажа-собеседника */
export function dialogueTitle(store: EditorStore, inkPath: string): string {
  return store.dialogueLabel(inkPath)
}
