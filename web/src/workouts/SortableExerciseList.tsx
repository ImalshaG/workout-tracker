import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { InlineSeconds } from '../components/SecondsInput';
import { GripVertical, RotateCcw, X } from 'lucide-react';
import { focusRing, IconButton } from '../components/ui';
import { DURATION_MAX_SECONDS, DURATION_MIN_SECONDS, formatShortDuration } from '../time';

export interface SortableItem {
  /** Stable, non-zero key (dnd-kit treats 0 as "no id"). */
  key: number;
  name: string;
  description: string | null;
  /** Effective duration, the exercise default, and whether this entry overrides it. */
  duration?: { seconds: number; defaultSeconds: number; custom: boolean };
}

interface Props {
  items: SortableItem[];
  /** Receives the keys in their new order. */
  onReorder: (keys: number[]) => void;
  onRemove: (key: number) => void;
  /** Disables dragging (e.g. while a save is in flight). */
  dragDisabled?: boolean;
  /** Key of the row whose removal is in flight. */
  removingKey?: number | undefined;
  /** Accessible label for the list. */
  label: string;
  /** Enables per-row duration editing; null clears the override (back to the exercise default). */
  onDurationChange?: (key: number, seconds: number | null) => void;
  /** Key of the row whose duration change is in flight. */
  durationPendingKey?: number | undefined;
}

export function SortableExerciseList({
  items,
  onReorder,
  onRemove,
  dragDisabled = false,
  removingKey,
  label,
  onDurationChange,
  durationPendingKey,
}: Props) {
  const sensors = useSensors(
    // A small distance lets clicks on the handle through without starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const keys = items.map((i) => i.key);
  const describe = (id: UniqueIdentifier) => {
    const index = keys.indexOf(Number(id));
    return `${items[index]?.name ?? 'Exercise'}`;
  };
  const position = (id: UniqueIdentifier | undefined) => (id === undefined ? 0 : keys.indexOf(Number(id)) + 1);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.id)}, position ${position(active.id)} of ${items.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${describe(active.id)} moved to position ${position(over.id)} of ${items.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${describe(active.id)} dropped at position ${position(over.id)} of ${items.length}.` : `${describe(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Reordering cancelled. ${describe(active.id)} returned to position ${position(active.id)}.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(Number(active.id));
    const to = keys.indexOf(Number(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(keys, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To reorder, press Space or Enter to pick up, use the arrow keys to move, Space or Enter to drop, or Escape to cancel.',
        },
      }}
    >
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        <ol aria-label={label} className="space-y-2">
          {items.map((item, index) => (
            <SortableRow
              key={item.key}
              item={item}
              index={index}
              dragDisabled={dragDisabled}
              removing={removingKey === item.key}
              onRemove={() => onRemove(item.key)}
              onDurationChange={onDurationChange && ((s) => onDurationChange(item.key, s))}
              durationPending={durationPendingKey === item.key}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  item,
  index,
  dragDisabled,
  removing,
  onRemove,
  onDurationChange,
  durationPending,
}: {
  item: SortableItem;
  index: number;
  dragDisabled: boolean;
  removing: boolean;
  onRemove: () => void;
  onDurationChange?: ((seconds: number | null) => void) | undefined;
  durationPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled: dragDisabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={
        'relative flex items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-xs ' +
        (isDragging ? 'z-10 shadow-lg ring-2 ring-brand/40' : '')
      }
      data-entry-key={item.key}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.name}, position ${index + 1}`}
        title="Drag to reorder"
        disabled={dragDisabled}
        className={`mt-0.5 cursor-grab touch-none rounded-md p-1 text-muted hover:bg-sunken hover:text-ink active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <span className="mt-0.5 w-6 shrink-0 text-right text-sm text-muted tabular-nums" aria-hidden="true">
        {index + 1}.
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words">{item.name}</p>
        {item.description && (
          <p className="mt-1 text-sm whitespace-pre-line break-words text-muted">{item.description}</p>
        )}
      </div>
      {item.duration && onDurationChange && (
        <div className="flex shrink-0 items-center gap-1" data-testid="entry-duration">
          <InlineSeconds
            value={item.duration.seconds}
            min={DURATION_MIN_SECONDS}
            max={DURATION_MAX_SECONDS}
            label={`Duration for ${item.name}, position ${index + 1}, in seconds`}
            custom={item.duration.custom}
            disabled={durationPending}
            // Matching the exercise default clears the override rather than pinning the same value.
            onCommit={(s) => onDurationChange(s === item.duration!.defaultSeconds ? null : s)}
          />
          {item.duration.custom ? (
            <button
              type="button"
              onClick={() => onDurationChange(null)}
              disabled={durationPending}
              aria-label={`Reset ${item.name} to its default ${formatShortDuration(item.duration.defaultSeconds)}`}
              title={`Reset to default (${formatShortDuration(item.duration.defaultSeconds)})`}
              className={`grid size-6 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink disabled:opacity-50 ${focusRing}`}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </button>
          ) : (
            <span className="w-6" aria-hidden="true" />
          )}
        </div>
      )}
      <IconButton icon={X} variant="ghostDanger" label={`Remove ${item.name}`} onClick={onRemove} disabled={removing} className="-my-1" />
    </li>
  );
}
