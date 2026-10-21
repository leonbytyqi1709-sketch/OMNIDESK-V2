import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
export const sharedRooms = pgTable(
  'v2_shared_rooms',
  {
    id: uuid('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    creationHash: text('creation_hash').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    closed: boolean('closed').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('v2_shared_rooms_owner').on(t.ownerId)],
)
export const roomMembers = pgTable(
  'v2_room_members',
  {
    id: uuid('id').primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => sharedRooms.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    role: text('role').$type<'reader' | 'editor'>().notNull(),
    revoked: boolean('revoked').notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    unique('v2_room_members_room_id_user_id_key').on(t.roomId, t.userId),
    index('v2_room_members_user').on(t.userId),
  ],
)
export const roomInvites = pgTable('v2_room_invites', {
  id: uuid('id').primaryKey(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => sharedRooms.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  role: text('role').$type<'reader' | 'editor'>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revoked: boolean('revoked').notNull().default(false),
  consumedBy: text('consumed_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
export const roomItems = pgTable(
  'v2_room_items',
  {
    id: uuid('id').primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => sharedRooms.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<'list' | 'pin'>().notNull(),
    text: text('text').notNull(),
    done: boolean('done').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('v2_room_items_room').on(t.roomId)],
)
