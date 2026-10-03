import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ClipboardList,
  Play,
  Plus,
  UserRound,
  X,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { Dialog } from '../../components/Dialog';
import {
  type ApiError,
  type AssignableMember,
  type TaskStatus,
  type VolunteerTask,
  apiAssignTask,
  apiCreateTask,
  apiListAssignableMembers,
  apiListTasks,
  apiUpdateTaskStatus,
} from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';

import './task-board.css';

const STATUS_COLUMNS: Array<{
  status: TaskStatus;
  label: string;
  emptyMessage: string;
}> = [
  { status: 'not_started', label: 'Not started', emptyMessage: 'No work is waiting to start.' },
  { status: 'in_progress', label: 'In progress', emptyMessage: 'No tasks are underway.' },
  { status: 'done', label: 'Done', emptyMessage: 'Completed tasks will appear here.' },
];

function getErrorMessage(error: unknown): string {
  return (error as ApiError).message ?? 'Something went wrong. Please try again.';
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const label = STATUS_COLUMNS.find((column) => column.status === status)?.label ?? status;
  return <span className={`task-badge task-badge--${status}`}>{label}</span>;
}

function TaskSummary({ tasks }: { tasks: VolunteerTask[] }) {
  const counts = useMemo(
    () => ({
      not_started: tasks.filter((task) => task.status === 'not_started').length,
      in_progress: tasks.filter((task) => task.status === 'in_progress').length,
      done: tasks.filter((task) => task.status === 'done').length,
    }),
    [tasks],
  );
  const icons = {
    not_started: <Circle size={22} aria-hidden="true" />,
    in_progress: <Play size={22} aria-hidden="true" />,
    done: <CheckCircle2 size={22} aria-hidden="true" />,
  };
  return (
    <section className="task-summary" aria-label="Task status summary">
      {STATUS_COLUMNS.map((column) => (
        <article
          className={`task-summary-card task-summary-card--${column.status}`}
          key={column.status}
        >
          {icons[column.status]}
          <span>{column.label}</span>
          <strong>{counts[column.status]}</strong>
        </article>
      ))}
    </section>
  );
}

function MemberTaskActions({
  task,
  isWorking,
  onStatusChange,
}: {
  task: VolunteerTask;
  isWorking: boolean;
  onStatusChange: (status: TaskStatus) => void;
}) {
  if (task.status === 'done') return null;
  return (
    <div className="task-card-actions">
      {task.status === 'not_started' && (
        <button
          className="task-button task-button--secondary"
          disabled={isWorking}
          onClick={() => onStatusChange('in_progress')}
        >
          <Play size={15} aria-hidden="true" /> Start task
        </button>
      )}
      <button
        className="task-button task-button--complete"
        disabled={isWorking}
        onClick={() => onStatusChange('done')}
      >
        <CheckCircle2 size={15} aria-hidden="true" /> Mark done
      </button>
    </div>
  );
}

function OrganizerTaskControls({
  task,
  members,
  isWorking,
  onAssign,
  onStatusChange,
}: {
  task: VolunteerTask;
  members: AssignableMember[];
  isWorking: boolean;
  onAssign: (assigneeId: string | null) => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const currentRank = STATUS_COLUMNS.findIndex((column) => column.status === task.status);
  return (
    <div className="task-organizer-controls">
      <label>
        <span>Assignee</span>
        <select
          aria-label={`Assignee for ${task.title}`}
          value={task.assigneeId ?? ''}
          disabled={isWorking}
          onChange={(event) => onAssign(event.target.value === '' ? null : event.target.value)}
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option value={member.id} key={member.id}>
              {member.displayName}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select
          aria-label={`Status for ${task.title}`}
          value={task.status}
          disabled={isWorking || task.status === 'done'}
          onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
        >
          {STATUS_COLUMNS.map((column, index) => (
            <option value={column.status} disabled={index < currentRank} key={column.status}>
              {column.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function TaskCard({
  task,
  members,
  userId,
  isOrganizer,
  isWorking,
  onAssign,
  onStatusChange,
}: {
  task: VolunteerTask;
  members: AssignableMember[];
  userId: string;
  isOrganizer: boolean;
  isWorking: boolean;
  onAssign: (assigneeId: string | null) => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const isAssignee = task.assigneeId === userId;
  return (
    <article className="task-card">
      <div className="task-card-heading">
        <h3>{task.title}</h3>
        <TaskStatusBadge status={task.status} />
      </div>
      <p className="task-description">{task.description}</p>
      <p className={`task-assignee ${task.assigneeId === null ? 'task-assignee--empty' : ''}`}>
        <UserRound size={16} aria-hidden="true" />
        {task.assigneeName ?? 'Unassigned'}
      </p>
      {isOrganizer ? (
        <OrganizerTaskControls
          task={task}
          members={members}
          isWorking={isWorking}
          onAssign={onAssign}
          onStatusChange={onStatusChange}
        />
      ) : (
        isAssignee && (
          <MemberTaskActions task={task} isWorking={isWorking} onStatusChange={onStatusChange} />
        )
      )}
    </article>
  );
}

function TaskColumn({
  column,
  tasks,
  renderTask,
}: {
  column: (typeof STATUS_COLUMNS)[number];
  tasks: VolunteerTask[];
  renderTask: (task: VolunteerTask) => React.ReactNode;
}) {
  return (
    <section className="task-column" aria-labelledby={`task-column-${column.status}`}>
      <header className="task-column-heading">
        <h2 id={`task-column-${column.status}`}>{column.label}</h2>
        <span>{tasks.length}</span>
      </header>
      <div className="task-column-list">
        {tasks.length === 0 ? (
          <p className="task-column-empty">{column.emptyMessage}</p>
        ) : (
          tasks.map(renderTask)
        )}
      </div>
    </section>
  );
}

function TaskComposer({
  members,
  onClose,
  onCreated,
}: {
  members: AssignableMember[];
  onClose: () => void;
  onCreated: (task: VolunteerTask) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [assigneeId, setAssigneeId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiCreateTask({
        title,
        description,
        status,
        assigneeId: assigneeId === '' ? null : assigneeId,
      });
      onCreated(response.task);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
      setIsSaving(false);
    }
  }

  return (
    <Dialog titleId="task-composer-title" onClose={onClose} busy={isSaving} className="task-dialog">
      <form className="task-composer" onSubmit={(event) => void handleSubmit(event)}>
        <div className="task-dialog-heading">
          <div>
            <h2 id="task-composer-title">Create volunteer task</h2>
            <p>Plan one clear piece of work for a fundraiser or event.</p>
          </div>
          <button
            type="button"
            className="task-icon-button"
            aria-label="Close task composer"
            disabled={isSaving}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <label className="task-field">
          <span>Title</span>
          <input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Set up the fundraiser welcome desk"
          />
        </label>
        <label className="task-field">
          <span>Description</span>
          <textarea
            required
            maxLength={2000}
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Explain what success looks like and any useful details."
          />
        </label>
        <div className="task-form-grid">
          <label className="task-field">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
            >
              {STATUS_COLUMNS.map((column) => (
                <option value={column.status} key={column.status}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <label className="task-field">
            <span>Assignee</span>
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option value={member.id} key={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error !== null && (
          <p className="task-alert" role="alert">
            {error}
          </p>
        )}
        <button className="task-button task-button--primary" disabled={isSaving}>
          <Plus size={17} aria-hidden="true" /> {isSaving ? 'Creating…' : 'Create task'}
        </button>
      </form>
    </Dialog>
  );
}

/** Displays the volunteer board, live status counts, and role-aware task controls. */
export function TaskBoardPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [workingTaskId, setWorkingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOrganizer = user?.role === 'officer' || user?.role === 'admin';

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [taskResponse, memberResponse] = await Promise.all([
        apiListTasks(),
        isOrganizer ? apiListAssignableMembers() : Promise.resolve({ members: [] }),
      ]);
      setTasks(taskResponse.tasks);
      setMembers(memberResponse.members);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [isOrganizer]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  function replaceTask(updated: VolunteerTask) {
    setTasks((current) => current.map((task) => (task._id === updated._id ? updated : task)));
  }

  async function changeAssignment(task: VolunteerTask, assigneeId: string | null) {
    setWorkingTaskId(task._id);
    setError(null);
    try {
      replaceTask((await apiAssignTask(task._id, assigneeId)).task);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setWorkingTaskId(null);
    }
  }

  async function changeStatus(task: VolunteerTask, status: TaskStatus) {
    setWorkingTaskId(task._id);
    setError(null);
    try {
      replaceTask((await apiUpdateTaskStatus(task._id, status)).task);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setWorkingTaskId(null);
    }
  }

  const tasksByStatus = useMemo(
    () =>
      Object.fromEntries(
        STATUS_COLUMNS.map((column) => [
          column.status,
          tasks.filter((task) => task.status === column.status),
        ]),
      ) as Record<TaskStatus, VolunteerTask[]>,
    [tasks],
  );

  return (
    <div className="task-page">
      <header className="task-page-heading">
        <div>
          <h1>Volunteer tasks</h1>
          <p>Keep fundraiser and event work visible, assigned, and moving forward.</p>
        </div>
        {isOrganizer && (
          <button
            className="task-button task-button--primary"
            onClick={() => setIsComposerOpen(true)}
          >
            <Plus size={17} aria-hidden="true" /> New task
          </button>
        )}
      </header>
      <TaskSummary tasks={tasks} />
      {error !== null && (
        <div className="task-page-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>{error}</span>
          <button className="task-button task-button--secondary" onClick={() => void loadBoard()}>
            Retry
          </button>
        </div>
      )}
      {isLoading ? (
        <p className="task-loading">Loading volunteer tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="task-board-empty">
          <ClipboardList size={42} aria-hidden="true" />
          <h2>No volunteer tasks yet</h2>
          <p>Organizers can add the first fundraiser or event task when planning begins.</p>
        </div>
      ) : (
        <div className="task-board">
          {STATUS_COLUMNS.map((column) => (
            <TaskColumn
              key={column.status}
              column={column}
              tasks={tasksByStatus[column.status]}
              renderTask={(task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  members={members}
                  userId={user?.id ?? ''}
                  isOrganizer={isOrganizer}
                  isWorking={workingTaskId === task._id}
                  onAssign={(assigneeId) => void changeAssignment(task, assigneeId)}
                  onStatusChange={(status) => void changeStatus(task, status)}
                />
              )}
            />
          ))}
        </div>
      )}
      {isComposerOpen && (
        <TaskComposer
          members={members}
          onClose={() => setIsComposerOpen(false)}
          onCreated={(task) => {
            setTasks((current) => [task, ...current]);
            setIsComposerOpen(false);
          }}
        />
      )}
    </div>
  );
}
