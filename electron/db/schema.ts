/**
 * 双数据库架构：
 * - bank.db（题库库）：subject / knowledge_point / question / paper / paper_question / ref_*
 *   随安装包分发，首次启动复制到用户目录后本地可写（题库管理）。
 * - study-platform.db（用户库）：user / 练习记录 / 考试记录 / 答题记录 / 错题本 / 设置
 *   首次启动自动创建，永不随包分发。
 * 两者通过 ATTACH 关联，跨库不设外键。
 */

export const BANK_SCHEMA = `
CREATE TABLE IF NOT EXISTS subject (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  stage TEXT NOT NULL,
  name  TEXT NOT NULL,
  icon  TEXT,
  sort  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(stage, name)
);

CREATE TABLE IF NOT EXISTS knowledge_point (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subject(id),
  grade      INTEGER NOT NULL,
  parent_id  INTEGER REFERENCES knowledge_point(id),
  name       TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_kp_subject ON knowledge_point(subject_id, grade);

CREATE TABLE IF NOT EXISTS question (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id   INTEGER NOT NULL REFERENCES subject(id),
  stage        TEXT NOT NULL,
  grade        INTEGER NOT NULL,
  knowledge_id INTEGER REFERENCES knowledge_point(id),
  type         TEXT NOT NULL,
  difficulty   INTEGER NOT NULL DEFAULT 2,
  stem         TEXT NOT NULL,
  options      TEXT,
  answer       TEXT NOT NULL,
  solution     TEXT,
  score        REAL NOT NULL DEFAULT 2,
  source       TEXT,
  fingerprint  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_question_lookup ON question(stage, grade, subject_id, type, difficulty);
CREATE INDEX IF NOT EXISTS idx_question_filter ON question(subject_id, grade, type, difficulty);
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_fingerprint ON question(fingerprint);
CREATE INDEX IF NOT EXISTS idx_question_knowledge ON question(knowledge_id);

CREATE TABLE IF NOT EXISTS paper (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  stage       TEXT NOT NULL,
  grade       INTEGER,
  subject_id  INTEGER REFERENCES subject(id),
  type        TEXT NOT NULL,
  rule        TEXT,
  duration    INTEGER,
  total_score REAL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS paper_question (
  paper_id    INTEGER NOT NULL REFERENCES paper(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES question(id),
  sort        INTEGER NOT NULL DEFAULT 0,
  score       REAL NOT NULL DEFAULT 2,
  PRIMARY KEY (paper_id, question_id)
);

CREATE TABLE IF NOT EXISTS ref_hanzi (
  char   TEXT PRIMARY KEY,
  grade  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ref_hanzi_grade ON ref_hanzi(grade);

CREATE TABLE IF NOT EXISTS ref_poem (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  author     TEXT NOT NULL,
  dynasty    TEXT,
  grade      INTEGER NOT NULL,
  lines      TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 2
);
CREATE INDEX IF NOT EXISTS idx_ref_poem_grade ON ref_poem(grade);

-- 适合小学「看拼音写词语」的二字词，构建题库时由语料筛出
CREATE TABLE IF NOT EXISTS ref_word (
  word  TEXT PRIMARY KEY,
  grade INTEGER NOT NULL,
  freq  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ref_word_grade ON ref_word(grade);

CREATE TABLE IF NOT EXISTS ref_idiom (
  word        TEXT PRIMARY KEY,
  pinyin      TEXT,
  explanation TEXT,
  freq        INTEGER
);

CREATE TABLE IF NOT EXISTS ref_xiehouyu (
  riddle TEXT PRIMARY KEY,
  answer TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_synonym (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  words TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_antonym (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  left  TEXT NOT NULL,
  right TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ref_antonym_left ON ref_antonym(left);

CREATE TABLE IF NOT EXISTS ref_classifier (
  noun       TEXT NOT NULL,
  classifier TEXT NOT NULL,
  PRIMARY KEY (noun, classifier)
);

CREATE TABLE IF NOT EXISTS ref_english_word (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word        TEXT NOT NULL,
  grade       INTEGER NOT NULL,
  volume      TEXT,
  phonetic    TEXT,
  meaning     TEXT NOT NULL,
  sentence    TEXT,
  sentence_zh TEXT
);
CREATE INDEX IF NOT EXISTS idx_ref_english_grade ON ref_english_word(grade);
CREATE INDEX IF NOT EXISTS idx_ref_english_word ON ref_english_word(word);

CREATE TABLE IF NOT EXISTS ref_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`

export const USER_SCHEMA = `
CREATE TABLE IF NOT EXISTS user (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  avatar     TEXT,
  stage      TEXT NOT NULL DEFAULT 'primary',
  grade      INTEGER NOT NULL DEFAULT 1,
  role       TEXT NOT NULL DEFAULT 'student',
  pin        TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(name, stage)
);

CREATE TABLE IF NOT EXISTS practice_record (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  paper_id       INTEGER,
  subject_id     INTEGER,
  grade          INTEGER,
  question_count INTEGER NOT NULL DEFAULT 0,
  correct_count  INTEGER NOT NULL DEFAULT 0,
  duration_sec   INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'doing',
  started_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  finished_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_practice_user ON practice_record(user_id, status);

-- 练习卷快照，放在用户库，避免题库升级覆盖 bank.paper 后历史失效
CREATE TABLE IF NOT EXISTS practice_paper (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  stage       TEXT NOT NULL DEFAULT 'primary',
  grade       INTEGER,
  subject_id  INTEGER,
  type        TEXT NOT NULL DEFAULT 'practice',
  rule        TEXT,
  duration    INTEGER,
  total_score REAL,
  payload     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS practice_paper_question (
  paper_id    INTEGER NOT NULL REFERENCES practice_paper(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  score       REAL NOT NULL DEFAULT 2,
  PRIMARY KEY (paper_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_practice_paper_question ON practice_paper_question(paper_id, sort);

CREATE TABLE IF NOT EXISTS exam_record (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  paper_id     INTEGER NOT NULL,
  total_score  REAL,
  user_score   REAL,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'doing',
  started_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  finished_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_exam_user ON exam_record(user_id, status);

CREATE TABLE IF NOT EXISTS exam_question (
  record_id   INTEGER NOT NULL REFERENCES exam_record(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  score       REAL NOT NULL DEFAULT 2,
  PRIMARY KEY (record_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_question_record ON exam_question(record_id, sort);

CREATE TABLE IF NOT EXISTS print_template (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  name       TEXT NOT NULL,
  subject_id INTEGER,
  grade      INTEGER,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS answer_record (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  record_id   INTEGER NOT NULL,
  record_type TEXT NOT NULL,
  question_id INTEGER NOT NULL,
  user_answer TEXT,
  is_correct  INTEGER,
  score       REAL NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_answer_unique ON answer_record(record_id, record_type, question_id);
CREATE INDEX IF NOT EXISTS idx_answer_user ON answer_record(user_id, record_type);
CREATE INDEX IF NOT EXISTS idx_answer_question ON answer_record(question_id);

-- 自定义组卷实时生成的题目，只属于某次练习，不写入 bank.db
CREATE TABLE IF NOT EXISTS custom_question (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id    INTEGER NOT NULL REFERENCES practice_record(id) ON DELETE CASCADE,
  sort         INTEGER NOT NULL DEFAULT 0,
  subject_id   INTEGER NOT NULL,
  grade        INTEGER NOT NULL,
  knowledge_id INTEGER,
  type         TEXT NOT NULL,
  difficulty   INTEGER NOT NULL DEFAULT 2,
  stem         TEXT NOT NULL,
  options      TEXT,
  answer       TEXT NOT NULL,
  solution     TEXT,
  score        REAL NOT NULL DEFAULT 2,
  source       TEXT
);
CREATE INDEX IF NOT EXISTS idx_custom_question_record ON custom_question(record_id, sort);

-- 错题专练等混合试卷引用已有的生成题，不复制题目内容
CREATE TABLE IF NOT EXISTS practice_custom_question (
  record_id   INTEGER NOT NULL REFERENCES practice_record(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES custom_question(id) ON DELETE CASCADE,
  sort        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (record_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_practice_custom_record ON practice_custom_question(record_id, sort);

CREATE TABLE IF NOT EXISTS wrong_book (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  question_id   INTEGER NOT NULL,
  wrong_count   INTEGER NOT NULL DEFAULT 1,
  last_wrong_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  mastered      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, question_id)
);
`

/** 旧版单库结构中，题库相关表已迁移到 bank.db，这里列出需要清理的表 */
export const LEGACY_TABLES = [
  'paper_question',
  'exam_question',
  'answer_record',
  'wrong_book',
  'practice_record',
  'exam_record',
  'question',
  'knowledge_point',
  'paper',
  'subject'
]
