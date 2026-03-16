/**
 * Example Drizzle Table Definitions Template
 *
 * This is a reference template. Copy to packages/shared/src/schema/
 * and adapt table names, columns, and relations to your domain.
 *
 * Demonstrates:
 * - Standard table with bigint identity PK, timestamps, FK
 * - Junction table for many-to-many relationships
 * - Drizzle relations definition
 * - drizzle-zod schema generation for DB-layer validation
 * - Inferred TypeScript types
 *
 * Naming conventions:
 * - Table names: plural snake_case (tasks, task_tags)
 * - Column names: snake_case (created_at, user_id)
 * - PKs: id (bigint generated always as identity)
 * - FKs: {table_singular}_id (task_id, user_id)
 * - Indexes: idx_{table}_{columns}
 *
 * See data-patterns.md for the full Drizzle ORM standard.
 */

import {
  pgTable,
  bigint,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

// ============================================================================
// Tables
// ============================================================================

export const tasks = pgTable('tasks', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_tasks_status').on(table.status),
  index('idx_tasks_user_id').on(table.userId),
]);

export const tags = pgTable('tags', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taskTags = pgTable('task_tags', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  taskId: bigint('task_id', { mode: 'number' }).notNull().references(() => tasks.id),
  tagId: bigint('tag_id', { mode: 'number' }).notNull().references(() => tags.id),
}, (table) => [
  index('idx_task_tags_task_id').on(table.taskId),
  index('idx_task_tags_tag_id').on(table.tagId),
]);

// ============================================================================
// Relations
// ============================================================================

export const tasksRelations = relations(tasks, ({ many }) => ({
  taskTags: many(taskTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  taskTags: many(taskTags),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, { fields: [taskTags.taskId], references: [tasks.id] }),
  tag: one(tags, { fields: [taskTags.tagId], references: [tags.id] }),
}));

// ============================================================================
// Drizzle-Zod Schemas (DB-layer validation)
// ============================================================================

export const insertTaskSchema = createInsertSchema(tasks);
export const selectTaskSchema = createSelectSchema(tasks);

export const insertTagSchema = createInsertSchema(tags);
export const selectTagSchema = createSelectSchema(tags);

// ============================================================================
// Inferred Types
// ============================================================================

export type Task = z.infer<typeof selectTaskSchema>;
export type NewTask = z.infer<typeof insertTaskSchema>;
export type Tag = z.infer<typeof selectTagSchema>;
export type NewTag = z.infer<typeof insertTagSchema>;
