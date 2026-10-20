import { getDb } from '../connection'
import { STAGE_CONFIG } from '../../../shared/constants'
import type { KnowledgePoint, Stage, Subject } from '../../../shared/types'

interface SubjectRow {
  id: number
  stage: string
  name: string
  icon: string | null
  sort: number
}

interface KnowledgeRow {
  id: number
  subject_id: number
  grade: number
  parent_id: number | null
  name: string
  sort: number
}

export function listSubjects(stage: Stage = 'primary', grade?: number): Subject[] {
  const rows = getDb()
    .prepare('SELECT id, stage, name, icon, sort FROM bank.subject WHERE stage = ? ORDER BY sort ASC, id ASC')
    .all(stage) as SubjectRow[]

  let list = rows.map((row) => ({
    id: row.id,
    stage: row.stage as Stage,
    name: row.name,
    icon: row.icon ?? 'pi pi-circle',
    sort: row.sort
  }))

  if (grade) {
    const allowed = STAGE_CONFIG[stage]?.subjectsByGrade?.[grade]
    if (allowed) list = list.filter((item) => allowed.includes(item.name))
  }
  return list
}

export function getSubject(id: number): Subject | null {
  const row = getDb()
    .prepare('SELECT id, stage, name, icon, sort FROM bank.subject WHERE id = ?')
    .get(id) as SubjectRow | undefined
  if (!row) return null
  return {
    id: row.id,
    stage: row.stage as Stage,
    name: row.name,
    icon: row.icon ?? 'pi pi-circle',
    sort: row.sort
  }
}

export function listKnowledgeTree(subjectId: number, grade: number): KnowledgePoint[] {
  const rows = getDb()
    .prepare(
      'SELECT id, subject_id, grade, parent_id, name, sort FROM bank.knowledge_point WHERE subject_id = ? AND grade = ? ORDER BY sort ASC, id ASC'
    )
    .all(subjectId, grade) as KnowledgeRow[]

  const nodes = new Map<number, KnowledgePoint>()
  const roots: KnowledgePoint[] = []

  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      subjectId: row.subject_id,
      grade: row.grade,
      parentId: row.parent_id,
      name: row.name,
      sort: row.sort,
      children: []
    })
  }

  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function knowledgeIdsUnder(subjectId: number, grade: number, ids: number[]): number[] {
  if (ids.length === 0) return []
  const all = getDb()
    .prepare('SELECT id, parent_id FROM bank.knowledge_point WHERE subject_id = ? AND grade = ?')
    .all(subjectId, grade) as { id: number; parent_id: number | null }[]
  const children = new Map<number, number[]>()
  for (const row of all) {
    if (row.parent_id) {
      if (!children.has(row.parent_id)) children.set(row.parent_id, [])
      children.get(row.parent_id)!.push(row.id)
    }
  }
  const result = new Set<number>()
  const walk = (id: number): void => {
    result.add(id)
    for (const child of children.get(id) ?? []) walk(child)
  }
  ids.forEach(walk)
  return [...result]
}
