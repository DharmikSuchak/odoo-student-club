import { ObjectId, type Collection } from 'mongodb';

import {
  taskDocumentSchema,
  type TaskDocument,
  type TaskStatus,
} from '../../db/schemas/task.schema.js';
import type { UserRole } from '../../db/schemas/user.schema.js';
import { AppError } from '../../middleware/error-handler.js';

export type StoredTask = TaskDocument & { _id: ObjectId };

export interface VolunteerTaskView extends StoredTask {
  assigneeName: string | null;
  createdByName: string;
}

export interface TaskStatusSummary {
  notStarted: number;
  inProgress: number;
  done: number;
  total: number;
}

export interface AssignableMember {
  id: string;
  displayName: string;
  role: UserRole;
}

interface UserRecord {
  _id: ObjectId;
  displayName: string;
  role: UserRole;
  deletedAt?: Date;
}

interface CreateTaskInput {
  clubId: string;
  createdBy: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
}

interface TaskActor {
  userId: string;
  role: UserRole;
}

function parseObjectId(value: string, fieldName: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}: must be a 24-character hex string.`, 400);
  }
  return new ObjectId(value);
}

function isOrganizer(role: UserRole): boolean {
  return role === 'officer' || role === 'admin';
}

async function requireActiveUser(users: Collection, userId: string): Promise<UserRecord> {
  const user = await users.findOne<UserRecord>({ _id: parseObjectId(userId, 'assigneeId') });
  if (user === null || user.deletedAt !== undefined) {
    throw new AppError('Assignee not found or inactive.', 404);
  }
  return user;
}

async function getDisplayName(
  users: Collection,
  userId: string,
  fallback: string,
): Promise<string> {
  const user = await users.findOne<UserRecord>({ _id: parseObjectId(userId, 'userId') });
  return user?.displayName ?? fallback;
}

async function toTaskView(users: Collection, task: StoredTask): Promise<VolunteerTaskView> {
  const [createdByName, assigneeName] = await Promise.all([
    getDisplayName(users, task.createdBy, 'Club organizer'),
    task.assigneeId === null
      ? Promise.resolve(null)
      : getDisplayName(users, task.assigneeId, 'Former member'),
  ]);
  return { ...task, createdByName, assigneeName };
}

function summarizeTasks(tasks: StoredTask[]): TaskStatusSummary {
  const summary = { notStarted: 0, inProgress: 0, done: 0, total: tasks.length };
  for (const task of tasks) {
    if (task.status === 'not_started') summary.notStarted += 1;
    if (task.status === 'in_progress') summary.inProgress += 1;
    if (task.status === 'done') summary.done += 1;
  }
  return summary;
}

async function findTask(tasks: Collection, clubId: string, taskId: string): Promise<StoredTask> {
  const task = await tasks.findOne<StoredTask>({
    _id: parseObjectId(taskId, 'taskId'),
    clubId: parseObjectId(clubId, 'clubId').toHexString(),
  });
  if (task === null) throw new AppError('Volunteer task not found.', 404);
  return task;
}

export async function createTask(
  tasks: Collection,
  users: Collection,
  input: CreateTaskInput,
): Promise<VolunteerTaskView> {
  if (input.assigneeId !== null) await requireActiveUser(users, input.assigneeId);
  const now = new Date();
  const document = taskDocumentSchema.parse({
    ...input,
    clubId: parseObjectId(input.clubId, 'clubId').toHexString(),
    createdBy: parseObjectId(input.createdBy, 'createdBy').toHexString(),
    assigneeId:
      input.assigneeId === null
        ? null
        : parseObjectId(input.assigneeId, 'assigneeId').toHexString(),
    ...(input.status === 'done' ? { completedAt: now } : {}),
    createdAt: now,
    updatedAt: now,
  });
  const result = await tasks.insertOne(document);
  const created = await tasks.findOne<StoredTask>({ _id: result.insertedId });
  if (created === null) throw new AppError('Failed to retrieve the new task.', 500, false);
  return toTaskView(users, created);
}

export async function listTasks(
  tasks: Collection,
  users: Collection,
  clubId: string,
): Promise<{ tasks: VolunteerTaskView[]; summary: TaskStatusSummary }> {
  const documents = await tasks
    .find<StoredTask>(
      { clubId: parseObjectId(clubId, 'clubId').toHexString() },
      { sort: { createdAt: -1 } },
    )
    .toArray();
  return {
    tasks: await Promise.all(documents.map((task) => toTaskView(users, task))),
    summary: summarizeTasks(documents),
  };
}

export async function listAssignableMembers(users: Collection): Promise<AssignableMember[]> {
  const records = await users
    .find<UserRecord>({}, { projection: { displayName: 1, role: 1, deletedAt: 1 } })
    .toArray();
  return records
    .filter((user) => user.deletedAt === undefined)
    .map((user) => ({ id: user._id.toHexString(), displayName: user.displayName, role: user.role }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function assignTask(
  tasks: Collection,
  users: Collection,
  clubId: string,
  taskId: string,
  assigneeId: string | null,
): Promise<VolunteerTaskView> {
  const existing = await findTask(tasks, clubId, taskId);
  if (assigneeId !== null) await requireActiveUser(users, assigneeId);
  const normalizedAssignee =
    assigneeId === null ? null : parseObjectId(assigneeId, 'assigneeId').toHexString();
  await tasks.updateOne(
    { _id: existing._id, clubId: existing.clubId },
    { $set: { assigneeId: normalizedAssignee, updatedAt: new Date() } },
  );
  return getUpdatedTask(tasks, users, existing._id);
}

export async function updateTaskStatus(
  tasks: Collection,
  users: Collection,
  clubId: string,
  taskId: string,
  actor: TaskActor,
  status: TaskStatus,
): Promise<VolunteerTaskView> {
  const existing = await findTask(tasks, clubId, taskId);
  const actorId = parseObjectId(actor.userId, 'userId').toHexString();
  if (!isOrganizer(actor.role) && existing.assigneeId !== actorId) {
    throw new AppError('Only the assignee or an organizer can update this task.', 403);
  }
  const rank: Record<TaskStatus, number> = { not_started: 0, in_progress: 1, done: 2 };
  if (rank[status] < rank[existing.status]) {
    throw new AppError('Completed progress cannot be moved backward.', 409);
  }
  if (status === existing.status) return toTaskView(users, existing);
  const now = new Date();
  await tasks.updateOne(
    { _id: existing._id, clubId: existing.clubId, status: existing.status },
    { $set: { status, updatedAt: now, ...(status === 'done' ? { completedAt: now } : {}) } },
  );
  return getUpdatedTask(tasks, users, existing._id);
}

async function getUpdatedTask(
  tasks: Collection,
  users: Collection,
  taskId: ObjectId,
): Promise<VolunteerTaskView> {
  const updated = await tasks.findOne<StoredTask>({ _id: taskId });
  if (updated === null) throw new AppError('Failed to retrieve the updated task.', 500, false);
  return toTaskView(users, updated);
}
