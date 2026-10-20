import { createHash } from 'node:crypto'
import { get as getEmoji } from 'node-emoji'
import { getDb } from '../connection'
import type { Stage, User } from '../../../shared/types'

interface UserRow {
  id: number
  name: string
  avatar: string | null
  stage: string
  grade: number
  role: string
  hasPin: number
  created_at: string
}

const SELECT_USER = `
  SELECT id, name, avatar, stage, grade, role,
         CASE WHEN pin IS NULL OR pin = '' THEN 0 ELSE 1 END AS hasPin,
         created_at
  FROM user
`

const CUTE_EMOJI_NAMES = [
  'panda_face',
  'bear',
  'rabbit',
  'fox_face',
  'cat',
  'dog',
  'koala',
  'hamster',
  'penguin',
  'tiger',
  'lion',
  'frog',
  'monkey_face',
  'pig',
  'teddy_bear',
  'unicorn',
  'whale',
  'dolphin',
  'octopus',
  'butterfly',
  'turtle',
  'owl',
  'chick',
  'sparkles',
  'star2',
  'rainbow',
  'sunflower',
  'cherry_blossom',
  'four_leaf_clover',
  'ice_cream',
  'cookie',
  'doughnut',
  'cake',
  'balloon',
  'gift',
  'rocket',
  'smile',
  'blush',
  'heart_eyes',
  'star_struck'
]

const CUTE_EMOJIS = CUTE_EMOJI_NAMES.map((name) => getEmoji(name)).filter(
  (emoji): emoji is string => Boolean(emoji)
)

function randomAvatar(): string {
  return CUTE_EMOJIS[Math.floor(Math.random() * CUTE_EMOJIS.length)] ?? '🐼'
}

function hashPin(pin: string): string {
  return createHash('sha256').update(`study:${pin}`).digest('hex')
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    stage: row.stage as Stage,
    grade: row.grade,
    role: row.role as User['role'],
    hasPin: Boolean(row.hasPin),
    createdAt: row.created_at
  }
}

export function listUsers(): User[] {
  const rows = getDb().prepare(`${SELECT_USER} ORDER BY id ASC`).all() as UserRow[]
  return rows.map(mapUser)
}

export function getUser(id: number): User | null {
  const row = getDb().prepare(`${SELECT_USER} WHERE id = ?`).get(id) as UserRow | undefined
  return row ? mapUser(row) : null
}

export function createUser(input: {
  name: string
  grade: number
  stage?: Stage
  pin?: string | null
  role?: User['role']
}): User {
  const name = input.name?.trim()
  if (!name) throw new Error('请填写姓名')
  const grade = Number(input.grade)
  if (!Number.isInteger(grade) || grade < 1) throw new Error('请选择年级')
  const result = getDb()
    .prepare(
      `INSERT INTO user(name, avatar, stage, grade, pin, role) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      randomAvatar(),
      input.stage ?? 'primary',
      grade,
      input.pin ? hashPin(input.pin) : null,
      input.role ?? 'student'
    )
  return getUser(Number(result.lastInsertRowid))!
}

export function updateUser(
  id: number,
  patch: {
    name?: string
    grade?: number
    stage?: Stage
    pin?: string | null
    avatar?: string | null
  }
): User {
  const current = getUser(id)
  if (!current) throw new Error('用户不存在')
  const name = patch.name?.trim() ?? current.name
  if (!name) throw new Error('请填写姓名')
  const grade = patch.grade ?? current.grade
  const stage = patch.stage ?? current.stage
  const avatar = patch.avatar === undefined ? current.avatar : patch.avatar

  if (patch.pin === undefined) {
    getDb()
      .prepare('UPDATE user SET name = ?, grade = ?, stage = ?, avatar = ? WHERE id = ?')
      .run(name, grade, stage, avatar, id)
  } else {
    getDb()
      .prepare(
        'UPDATE user SET name = ?, grade = ?, stage = ?, avatar = ?, pin = ? WHERE id = ?'
      )
      .run(name, grade, stage, avatar, patch.pin ? hashPin(patch.pin) : null, id)
  }
  return getUser(id)!
}

export function deleteUser(id: number): void {
  getDb().prepare('DELETE FROM user WHERE id = ?').run(id)
}

export function verifyPin(id: number, pin: string): boolean {
  const row = getDb().prepare('SELECT pin FROM user WHERE id = ?').get(id) as
    | { pin: string | null }
    | undefined
  if (!row) return false
  if (!row.pin) return true
  return row.pin === hashPin(pin ?? '')
}

export function countUsers(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS count FROM user').get() as { count: number }
  return row.count
}
