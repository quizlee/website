import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import type { Activity } from '../../lib/types';
import {
  Lock,
  Unlock,
  Edit,
  Trash2,
  Plus,
  Gamepad2,
  FlaskConical,
  GripVertical,
  CheckCircle2,
  XCircle,
  Palette,
} from 'lucide-react';

// ─── Preset colour swatches ──────────────────────────────────────────────────
const PRESETS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#64748b',
];

// ─── Sortable Activity Card ──────────────────────────────────────────────────
interface ActivityCardProps {
  activity: Activity;
  isToggling: boolean;
  onToggleLock: (a: Activity) => void;
  onToggleActive: (a: Activity) => void;
  onEdit: (a: Activity) => void;
  onDelete: (a: Activity) => void;
}

function SortableActivityCard({
  activity,
  isToggling,
  onToggleLock,
  onToggleActive,
  onEdit,
  onDelete,
}: ActivityCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: activity.id });

  const cardColor = activity.color || '#6366f1';

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-white rounded-2xl border-2 transition-all duration-150 overflow-hidden select-none ${
        isDragging
          ? 'border-primary-300 shadow-xl shadow-primary-200/40 rotate-1 scale-[1.02]'
          : activity.is_locked
          ? 'border-danger-200 bg-danger-50/30'
          : activity.is_active
          ? 'border-surface-200 hover:border-primary-200'
          : 'border-surface-100 opacity-60'
      }`}
    >
      {activity.is_locked && !isDragging && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-danger-400 to-danger-600" />
      )}

      <div className="p-4 flex items-start gap-3">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="mt-1 shrink-0 cursor-grab active:cursor-grabbing text-surface-300 hover:text-surface-500 transition-colors touch-none"
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </div>

        {/* Emoji */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 mt-0.5 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${cardColor}cc, ${cardColor})` }}
        >
          {activity.emoji || '🎯'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-surface-900 text-sm">{activity.label}</span>
            {activity.is_locked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-danger-100 text-danger-700 px-2 py-0.5 rounded-full border border-danger-200">
                <Lock size={9} /> Locked
              </span>
            )}
            {!activity.is_active && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-surface-100 text-surface-500 px-2 py-0.5 rounded-full border border-surface-200">
                Hidden
              </span>
            )}
          </div>
          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{activity.description}</p>
          <p className="text-[10px] text-surface-400 mt-1 font-mono">
            key: {activity.key} · order: {activity.sort_order}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleActive(activity)}
            title={activity.is_active ? 'Hide from students' : 'Show to students'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              activity.is_active
                ? 'text-success-600 hover:bg-success-50'
                : 'text-surface-400 hover:bg-surface-100'
            }`}
          >
            {activity.is_active ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          </button>

          <button
            onClick={() => onToggleLock(activity)}
            disabled={isToggling}
            title={activity.is_locked ? 'Unlock activity' : 'Lock activity'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              activity.is_locked
                ? 'text-danger-600 hover:bg-danger-50'
                : 'text-surface-500 hover:bg-surface-100'
            } disabled:opacity-40`}
          >
            {isToggling ? <Spinner size="sm" /> : activity.is_locked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>

          <button
            onClick={() => onEdit(activity)}
            title="Edit activity"
            className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-900 cursor-pointer transition-colors"
          >
            <Edit size={15} />
          </button>

          <button
            onClick={() => onDelete(activity)}
            title="Delete activity"
            className="p-1.5 rounded-lg text-surface-400 hover:bg-danger-50 hover:text-danger-600 cursor-pointer transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────
interface ActivityForm {
  key: string;
  label: string;
  description: string;
  emoji: string;
  color: string;
  zone: 'play' | 'test';
  sort_order: number;
}

const emptyForm: ActivityForm = {
  key: '',
  label: '',
  description: '',
  emoji: '',
  color: '#6366f1',
  zone: 'play',
  sort_order: 0,
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ActivityManagerPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => { fetchActivities(); }, []);

  async function fetchActivities() {
    setLoading(true);
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('zone')
      .order('sort_order');
    if (error) toast(error.message, 'error');
    else setActivities((data as Activity[]) || []);
    setLoading(false);
  }


  // ── Drag-and-drop order ────────────────────────────────────────────────────
  async function persistOrder(reordered: Activity[]) {
    setSavingOrder(true);
    try {
      await Promise.all(
        reordered.map((a, idx) =>
          supabase
            .from('activities')
            .update({ sort_order: idx + 1, updated_at: new Date().toISOString() })
            .eq('id', a.id)
        )
      );
      toast('Order saved! Student portal updated.', 'success');
    } catch {
      toast('Failed to save order.', 'error');
    } finally {
      setSavingOrder(false);
    }
  }

  function handleDragEnd(event: DragEndEvent, zone: 'play' | 'test') {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setActivities((prev) => {
      const zoneItems = prev.filter((a) => a.zone === zone);
      const otherItems = prev.filter((a) => a.zone !== zone);
      const oldIdx = zoneItems.findIndex((a) => a.id === active.id);
      const newIdx = zoneItems.findIndex((a) => a.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reordered = arrayMove(zoneItems, oldIdx, newIdx).map((a, i) => ({ ...a, sort_order: i + 1 }));
      persistOrder(reordered);
      return [...otherItems, ...reordered].sort((a, b) =>
        a.zone === b.zone ? a.sort_order - b.sort_order : a.zone.localeCompare(b.zone)
      );
    });
  }

  // ── Lock / hide ────────────────────────────────────────────────────────────
  async function handleToggleLock(activity: Activity) {
    setTogglingId(activity.id);
    const newLocked = !activity.is_locked;
    const { error } = await supabase
      .from('activities')
      .update({ is_locked: newLocked, updated_at: new Date().toISOString() })
      .eq('id', activity.id);
    if (error) toast(error.message, 'error');
    else {
      setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, is_locked: newLocked } : a)));
      toast(newLocked ? `"${activity.label}" locked.` : `"${activity.label}" unlocked.`, newLocked ? 'info' : 'success');
    }
    setTogglingId(null);
  }

  async function handleToggleActive(activity: Activity) {
    const newActive = !activity.is_active;
    const { error } = await supabase
      .from('activities')
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq('id', activity.id);
    if (error) toast(error.message, 'error');
    else {
      setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, is_active: newActive } : a)));
      toast(newActive ? `"${activity.label}" visible on student portal.` : `"${activity.label}" hidden.`, 'info');
    }
  }

  // ── Add / Edit ─────────────────────────────────────────────────────────────
  function openAddModal() { setEditingActivity(null); setForm(emptyForm); setShowModal(true); }

  function openEditModal(activity: Activity) {
    setEditingActivity(activity);
    setForm({
      key: activity.key,
      label: activity.label,
      description: activity.description || '',
      emoji: activity.emoji || '',
      color: activity.color || '#6366f1',
      zone: activity.zone,
      sort_order: activity.sort_order,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.label.trim()) { toast('Label is required.', 'error'); return; }
    if (!editingActivity && !form.key.trim()) { toast('Key is required.', 'error'); return; }
    setSaving(true);
    try {
      if (editingActivity) {
        const { error } = await supabase
          .from('activities')
          .update({
            label: form.label.trim(),
            description: form.description.trim() || null,
            emoji: form.emoji.trim() || null,
            color: form.color,
            zone: form.zone,
            sort_order: Number(form.sort_order),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingActivity.id);
        if (error) throw error;
        toast('Activity updated!', 'success');
      } else {
        const { error } = await supabase.from('activities').insert({
          key: form.key.trim().toLowerCase().replace(/\s+/g, ''),
          label: form.label.trim(),
          description: form.description.trim() || null,
          emoji: form.emoji.trim() || null,
          color: form.color,
          zone: form.zone,
          sort_order: Number(form.sort_order),
        });
        if (error) throw error;
        toast('Activity added!', 'success');
      }
      setShowModal(false);
      fetchActivities();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(activity: Activity) {
    if (!confirm(`Delete "${activity.label}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('activities').delete().eq('id', activity.id);
    if (error) toast(error.message, 'error');
    else {
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
      toast(`"${activity.label}" removed.`, 'info');
    }
  }

  const playActivities = activities.filter((a) => a.zone === 'play');
  const testActivities = activities.filter((a) => a.zone === 'test');

  function ZonePanel({ zone, items, title, icon, gradient }: {
    zone: 'play' | 'test'; items: Activity[]; title: string; icon: React.ReactNode; gradient: string;
  }) {
    return (
      <Card className="bg-white">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-surface-100">
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            {icon}
          </div>
          <div>
            <h2 className="font-bold text-surface-900 text-sm">{title}</h2>
            <p className="text-[11px] text-surface-400">{items.length} activities · drag to reorder</p>
          </div>
          {savingOrder && (
            <span className="ml-auto text-[11px] text-primary-500 flex items-center gap-1">
              <Spinner size="sm" /> Saving…
            </span>
          )}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, zone)}>
          <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-8">No activities yet.</p>
              ) : (
                items.map((a) => (
                  <SortableActivityCard
                    key={a.id}
                    activity={a}
                    isToggling={togglingId === a.id}
                    onToggleLock={handleToggleLock}
                    onToggleActive={handleToggleActive}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Activity Manager</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Drag to reorder · click <Palette size={12} className="inline" /> to change logo colour · all changes reflect instantly on student portal.
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAddModal}>Add Activity</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ZonePanel zone="play" items={playActivities} title="Play Zone"
            icon={<Gamepad2 size={16} className="text-white" />} gradient="from-primary-500 to-indigo-600" />
          <ZonePanel zone="test" items={testActivities} title="Test Zone"
            icon={<FlaskConical size={16} className="text-white" />} gradient="from-amber-500 to-orange-600" />
        </div>
      )}

      {/* Legend */}
      {!loading && (
        <div className="mt-6 flex flex-wrap items-center gap-5 text-xs text-surface-500 bg-white border border-surface-200 rounded-2xl px-5 py-3">
          <span className="font-bold text-surface-400 uppercase tracking-wider text-[10px]">Legend:</span>
          <div className="flex items-center gap-1.5"><GripVertical size={13} className="text-surface-400" /><span>Drag to reorder</span></div>
          <div className="flex items-center gap-1.5"><Palette size={13} className="text-primary-500" /><span>Click to change logo colour</span></div>
          <div className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-success-500" /><span>Active — visible &amp; clickable</span></div>
          <div className="flex items-center gap-1.5"><Lock size={13} className="text-danger-500" /><span>Locked — disabled on student portal</span></div>
          <div className="flex items-center gap-1.5"><XCircle size={13} className="text-surface-400" /><span>Hidden — not shown to students</span></div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editingActivity ? `Edit: ${editingActivity.label}` : 'Add New Activity'} size="md">
        <div className="flex flex-col gap-4">
          {!editingActivity && (
            <div>
              <label className="block text-xs font-bold text-surface-600 uppercase tracking-wider mb-1.5">
                Activity Key <span className="text-danger-500">*</span>
              </label>
              <input type="text" value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="e.g. quiz, groupsort"
                className="w-full px-3 py-2.5 rounded-xl border-2 border-surface-200 bg-white text-surface-800 text-sm font-mono focus:outline-none focus:border-primary-400" />
              <p className="text-[10px] text-surface-400 mt-1">Must match activity_type in content records.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-surface-600 uppercase tracking-wider mb-1.5">
              Display Label <span className="text-danger-500">*</span>
            </label>
            <input type="text" value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Quiz Quest"
              className="w-full px-3 py-2.5 rounded-xl border-2 border-surface-200 bg-white text-surface-800 text-sm focus:outline-none focus:border-primary-400" />
          </div>

          <div>
            <label className="block text-xs font-bold text-surface-600 uppercase tracking-wider mb-1.5">Description</label>
            <input type="text" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description"
              className="w-full px-3 py-2.5 rounded-xl border-2 border-surface-200 bg-white text-surface-800 text-sm focus:outline-none focus:border-primary-400" />
          </div>

          {/* Emoji + colour preview */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-surface-600 uppercase tracking-wider mb-1.5">Emoji</label>
              <input type="text" value={form.emoji}
                onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                placeholder="⚡" maxLength={4}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-surface-200 bg-white text-surface-800 text-xl text-center focus:outline-none focus:border-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-600 uppercase tracking-wider mb-1.5">Logo Colour</label>
              <div className="flex items-center gap-2">
                {/* Preview */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${form.color}cc, ${form.color})` }}
                >
                  {form.emoji || '🎯'}
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-8 gap-1 mb-1.5">
                    {PRESETS.map((c) => (
                      <button key={c} type="button"
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className="w-5 h-5 rounded-full hover:scale-125 transition-transform cursor-pointer border-2 shadow-sm"
                        style={{ backgroundColor: c, borderColor: c === form.color ? 'white' : 'transparent', boxShadow: c === form.color ? `0 0 0 2px ${c}` : undefined }}
                      />
                    ))}
                  </div>
                  <input type="color" value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-full h-7 rounded-lg cursor-pointer border-0" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-surface-600 uppercase tracking-wider mb-1.5">Zone</label>
              <select value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value as 'play' | 'test' }))}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-surface-200 bg-white text-surface-800 text-sm focus:outline-none focus:border-primary-400">
                <option value="play">Play Zone</option>
                <option value="test">Test Zone</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-600 uppercase tracking-wider mb-1.5">Order</label>
              <input type="number" value={form.sort_order} min={0}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-surface-200 bg-white text-surface-800 text-sm focus:outline-none focus:border-primary-400" />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-surface-100">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingActivity ? 'Save Changes' : 'Add Activity'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
