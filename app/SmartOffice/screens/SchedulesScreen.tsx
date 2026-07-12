import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ScrollView, StatusBar, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import ToggleSwitch from '../components/ToggleSwitch';
import FadeInView from '../components/FadeInView';
import WheelTimePicker from '../components/WheelTimePicker';
import * as api from '../api/devices';
import { Schedule, ScheduleCreate } from '../api/devices';
import { useAuth } from '../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

// Fallback device set (rooms 1–6, matching the deployed hardware) used only until
// the real list is fetched from the backend's /states endpoint.
const ALL_DEVICES = [
  ...Array.from({ length: 6 }, (_, i) => `r${i + 1}/l1`),
  ...Array.from({ length: 6 }, (_, i) => `r${i + 1}/f1`),
];

// Order device ids by room number, then lights before fans.
const sortDeviceIds = (ids: string[]): string[] =>
  [...ids].sort((a, b) => {
    const [ra, da] = a.split('/');
    const [rb, db] = b.split('/');
    const na = parseInt(ra.replace('r', ''), 10) || 0;
    const nb = parseInt(rb.replace('r', ''), 10) || 0;
    if (na !== nb) return na - nb;
    return (da || '').localeCompare(db || '');
  });

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAYS_LABEL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const DEFAULT_FORM: ScheduleCreate = {
  device_ids: [ALL_DEVICES[0]],
  action: 1,
  hour: 8,
  minute: 0,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  enabled: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// `names` maps a room prefix (e.g. "r1") to its admin-defined display name,
// as returned by GET /states. Falls back to "Room N" when a room is unnamed.
const formatDevice = (id: string, names: Record<string, string> = {}) => {
  const [room, dev] = id.split('/');
  const num = room?.replace('r', '') ?? '?';
  const roomLabel = (room && names[room]) || `Room ${num}`;
  return `${roomLabel} · ${dev?.startsWith('l') ? 'Light' : 'Fan'}`;
};

// One-line summary for a schedule that may target several devices.
const summarizeDevices = (ids: string[], names: Record<string, string> = {}) =>
  ids.length === 0 ? 'No devices'
  : ids.length === 1 ? formatDevice(ids[0], names)
  : `${ids.length} devices`;

// Icon to represent a device set: bulb if all lights, fan if all fans, grid if mixed.
const deviceSetIcon = (ids: string[]): keyof typeof Ionicons.glyphMap => {
  const allLight = ids.length > 0 && ids.every((id) => id.includes('/l'));
  const allFan = ids.length > 0 && ids.every((id) => !id.includes('/l'));
  return allLight ? 'bulb-outline' : allFan ? 'sync-outline' : 'grid-outline';
};

// Pull a human-readable message out of a thrown error. The API client throws the
// raw fetch Response on non-2xx, so read its JSON `detail`; otherwise fall back.
const describeError = async (e: unknown, fallback: string): Promise<string> => {
  if (e instanceof Response) {
    try {
      const json = await e.json();
      const detail = json?.detail;
      if (typeof detail === 'string') return detail;
      // FastAPI validation errors come back as an array of { msg, loc }.
      if (Array.isArray(detail)) {
        return detail.map((d: any) => d?.msg ?? JSON.stringify(d)).join('\n') || fallback;
      }
    } catch (_) {}
    return `${fallback} (HTTP ${e.status})`;
  }
  return fallback;
};

const formatTime = (h: number, m: number) => {
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

// ─── Schedule Form Modal ──────────────────────────────────────────────────────

interface ScheduleFormProps {
  visible: boolean;
  initial: ScheduleCreate;
  editId: number | null;
  availableDevices: string[];
  roomNames: Record<string, string>;
  onSave: (form: ScheduleCreate, editId: number | null) => Promise<void>;
  onClose: () => void;
}

const ScheduleFormModal: React.FC<ScheduleFormProps> = ({
  visible, initial, editId, availableDevices, roomNames, onSave, onClose,
}) => {
  const { colors } = useTheme();
  const fm = useMemo(() => createFmStyles(colors), [colors]);
  const [form, setForm] = useState<ScheduleCreate>(initial);
  const [deviceExpanded, setDeviceExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset form each time the modal opens
  useEffect(() => {
    if (visible) {
      setForm(initial);
      setDeviceExpanded(false);
    }
  }, [visible]);

  const toggleDay = (day: string) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter((x) => x !== day) : [...f.days, day],
    }));

  const isEditing = editId !== null;

  const toggleDevice = (id: string) =>
    setForm((f) => ({
      ...f,
      device_ids: f.device_ids.includes(id)
        ? f.device_ids.filter((x) => x !== id)
        : [...f.device_ids, id],
    }));

  const allDevicesSelected =
    availableDevices.length > 0 && availableDevices.every((id) => form.device_ids.includes(id));

  // Select every available device, or clear the selection if all are already picked.
  const toggleAllDevices = () =>
    setForm((f) => ({ ...f, device_ids: allDevicesSelected ? [] : [...availableDevices] }));

  const handleSave = async () => {
    if (!isEditing && form.device_ids.length === 0) { Alert.alert('Validation', 'Select at least one device.'); return; }
    if (!form.days.length) { Alert.alert('Validation', 'Select at least one day.'); return; }
    setSaving(true);
    await onSave(form, editId);
    setSaving(false);
  };

  const editAllLight = form.device_ids.length > 0 && form.device_ids.every((id) => id.includes('/l'));
  const deviceSummary =
    form.device_ids.length === 0 ? 'Select devices'
    : form.device_ids.length === 1 ? formatDevice(form.device_ids[0], roomNames)
    : `${form.device_ids.length} devices selected`;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={fm.overlay}>
        <View style={fm.sheet}>

          {/* Handle */}
          <View style={fm.handle} />

          {/* Header */}
          <View style={fm.header}>
            <View>
              <Text style={fm.title}>{editId ? 'Edit Schedule' : 'New Schedule'}</Text>
              <Text style={fm.subtitle}>{editId ? 'Update automation settings' : 'Set up a new automation'}</Text>
            </View>
            <TouchableOpacity style={fm.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Scrollable body — no flex:1, sheet height is content-driven + maxHeight cap */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={fm.body}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Device(s) ── */}
            <Text style={fm.label}>{isEditing ? 'DEVICE' : 'DEVICES'}</Text>
            {isEditing ? (
              // A schedule's devices can't be reassigned — show them read-only.
              <View style={fm.deviceField}>
                <View style={[fm.deviceIcon, editAllLight ? fm.iconLight : fm.iconFan]}>
                  <Ionicons
                    name={deviceSetIcon(form.device_ids)}
                    size={16}
                    color={editAllLight ? colors.accent : colors.blue}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fm.deviceName}>{summarizeDevices(form.device_ids, roomNames)}</Text>
                  <Text style={fm.deviceSub}>
                    {form.device_ids.length > 1
                      ? form.device_ids.map((id) => formatDevice(id, roomNames)).join(', ')
                      : 'Device can’t be changed'}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[fm.deviceField, deviceExpanded && fm.deviceFieldOpen]}
                  onPress={() => setDeviceExpanded((v) => !v)}
                  activeOpacity={0.75}
                >
                  <View style={[fm.deviceIcon, fm.iconLight]}>
                    <Ionicons name="grid-outline" size={16} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={fm.deviceName}>{deviceSummary}</Text>
                    <Text style={fm.deviceSub}>{form.device_ids.length} selected · tap to choose</Text>
                  </View>
                  <Ionicons
                    name={deviceExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                {/* Inline multi-select device list */}
                {deviceExpanded && (
                  <View style={fm.deviceList}>
                    {/* Select all / Deselect all */}
                    <TouchableOpacity
                      style={fm.selectAllRow}
                      onPress={toggleAllDevices}
                      activeOpacity={0.7}
                    >
                      <Text style={fm.selectAllText}>
                        {allDevicesSelected ? 'Deselect all' : 'Select all'}
                      </Text>
                      <Ionicons
                        name={allDevicesSelected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={allDevicesSelected ? colors.accent : colors.textMuted}
                      />
                    </TouchableOpacity>
                    {availableDevices.map((id) => {
                      const active = form.device_ids.includes(id);
                      const light = id.includes('/l');
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[fm.deviceOption, active && fm.deviceOptionActive]}
                          onPress={() => toggleDevice(id)}
                          activeOpacity={0.7}
                        >
                          <View style={[fm.deviceOptionIcon, light ? fm.iconLight : fm.iconFan]}>
                            <Ionicons
                              name={light ? 'bulb-outline' : 'sync-outline'}
                              size={13}
                              color={light ? colors.accent : colors.blue}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[fm.deviceOptionName, active && fm.deviceOptionNameActive]}>
                              {formatDevice(id, roomNames)}
                            </Text>
                            <Text style={fm.deviceOptionId}>{id}</Text>
                          </View>
                          <Ionicons
                            name={active ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={active ? colors.accent : colors.textMuted}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* ── Time ── */}
            <Text style={[fm.label, { marginTop: SPACING.xl }]}>TIME</Text>
            <WheelTimePicker
              hour={form.hour}
              minute={form.minute}
              onChange={(hour, minute) => setForm((f) => ({ ...f, hour, minute }))}
            />

            {/* ── Days ── */}
            <Text style={[fm.label, { marginTop: SPACING.xl }]}>REPEAT ON</Text>
            <View style={fm.daysRow}>
              {DAYS.map((day, i) => {
                const active = form.days.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[fm.dayChip, active && fm.dayChipActive]}
                    onPress={() => toggleDay(day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[fm.dayChipText, active && fm.dayChipTextActive]}>
                      {DAYS_LABEL[i]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Action ── */}
            <Text style={[fm.label, { marginTop: SPACING.xl }]}>ACTION</Text>
            <View style={fm.actionRow}>
              <TouchableOpacity
                style={[fm.actionBtn, form.action === 1 && fm.actionBtnOn]}
                onPress={() => setForm((f) => ({ ...f, action: 1 }))}
                activeOpacity={0.75}
              >
                <View style={[fm.actionIcon, form.action === 1 && fm.actionIconOn]}>
                  <Ionicons name="power" size={15} color={form.action === 1 ? colors.accent : colors.textMuted} />
                </View>
                <Text style={[fm.actionText, form.action === 1 && fm.actionTextOn]}>Turn ON</Text>
                {form.action === 1 && (
                  <Ionicons name="checkmark-circle" size={15} color={colors.accent} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[fm.actionBtn, form.action === 0 && fm.actionBtnOff]}
                onPress={() => setForm((f) => ({ ...f, action: 0 }))}
                activeOpacity={0.75}
              >
                <View style={[fm.actionIcon, form.action === 0 && fm.actionIconOff]}>
                  <Ionicons name="power-outline" size={15} color={form.action === 0 ? '#FF4D4D' : colors.textMuted} />
                </View>
                <Text style={[fm.actionText, form.action === 0 && fm.actionTextOff]}>Turn OFF</Text>
                {form.action === 0 && (
                  <Ionicons name="checkmark-circle" size={15} color="#FF4D4D" style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            </View>

            {/* ── Enabled ── */}
            <View style={[fm.enabledRow, { marginTop: SPACING.xl }]}>
              <View>
                <Text style={fm.enabledLabel}>Enable Schedule</Text>
                <Text style={fm.enabledSub}>Run automatically at scheduled time</Text>
              </View>
              <ToggleSwitch
                isOn={form.enabled}
                onToggle={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
              />
            </View>

            {/* ── Save ── */}
            <TouchableOpacity
              style={[fm.saveBtn, saving && fm.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Ionicons
                name={saving ? 'hourglass-outline' : editId ? 'checkmark-circle-outline' : 'add-circle-outline'}
                size={18}
                color="#fff"
              />
              <Text style={fm.saveBtnText}>
                {saving ? 'Saving…' : editId ? 'Update Schedule' : 'Create Schedule'}
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createFmStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.glassBorder,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: SPACING.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: colors.glassBorder,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  // ScrollView body - no flex:1, driven by content up to sheet's maxHeight
  body: { padding: SPACING.xl, paddingBottom: 48 },
  label: {
    color: colors.textMuted, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.4, marginBottom: SPACING.sm,
  },
  // Device field
  deviceField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  deviceFieldOpen: {
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    borderColor: colors.accentGlow,
  },
  deviceIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
    borderWidth: 1,
  },
  iconLight: { backgroundColor: 'rgba(47,128,237,0.12)', borderColor: 'rgba(47,128,237,0.25)' },
  iconFan:   { backgroundColor: 'rgba(96,165,250,0.12)', borderColor: 'rgba(96,165,250,0.25)' },
  deviceName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  deviceSub:  { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  // Inline device list
  deviceList: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.accentGlow,
    borderBottomLeftRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md,
    paddingVertical: SPACING.xs, marginBottom: SPACING.sm,
  },
  selectAllRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.xs, marginBottom: SPACING.xs,
    borderBottomWidth: 1, borderBottomColor: colors.glassBorder,
  },
  selectAllText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  deviceOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.xs, borderRadius: RADIUS.sm,
  },
  deviceOptionActive: { backgroundColor: 'rgba(47,128,237,0.08)' },
  deviceOptionIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.sm, borderWidth: 1,
  },
  deviceOptionName:       { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  deviceOptionNameActive: { color: colors.text, fontWeight: '600' },
  deviceOptionId:         { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  // Days
  daysRow:         { flexDirection: 'row', justifyContent: 'space-between' },
  dayChip:         { flex: 1, marginHorizontal: 3, aspectRatio: 1, maxWidth: 42, borderRadius: RADIUS.full, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  dayChipActive:   { backgroundColor: 'rgba(47,128,237,0.15)', borderColor: 'rgba(47,128,237,0.45)' },
  dayChipText:     { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  dayChipTextActive: { color: colors.accent },
  // Action
  actionRow:    { flexDirection: 'row', gap: SPACING.sm },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm },
  actionBtnOn:  { backgroundColor: 'rgba(47,128,237,0.10)', borderColor: 'rgba(47,128,237,0.35)' },
  actionBtnOff: { backgroundColor: 'rgba(255,77,77,0.08)',  borderColor: 'rgba(255,77,77,0.30)'  },
  actionIcon:    { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  actionIconOn:  { backgroundColor: 'rgba(47,128,237,0.15)' },
  actionIconOff: { backgroundColor: 'rgba(255,77,77,0.12)' },
  actionText:    { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  actionTextOn:  { color: colors.accent },
  actionTextOff: { color: '#FF4D4D' },
  // Enabled row
  enabledRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.md, padding: SPACING.md },
  enabledLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  enabledSub:   { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  // Save button
  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: colors.accent, borderRadius: RADIUS.md, height: 52, marginTop: SPACING.xl },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Schedule Card ─────────────────────────────────────────────────────────────

interface ScheduleCardProps {
  schedule: Schedule;
  index: number;
  roomNames: Record<string, string>;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (v: boolean) => void;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({ schedule, index, roomNames, onEdit, onDelete, onToggleEnabled }) => {
  const { colors } = useTheme();
  const sc = useMemo(() => createScStyles(colors), [colors]);
  const isLight = schedule.device_ids.every((id) => id.includes('/l'));
  const isOn = schedule.action === 1;

  return (
    <FadeInView delay={Math.min(index, 8) * 50} distance={12}>
    <View style={[sc.card, !schedule.enabled && sc.cardDisabled]}>
      {/* Row 1: time + enabled toggle */}
      <View style={sc.row1}>
        <View style={sc.timeGroup}>
          <Text style={[sc.time, !schedule.enabled && sc.timeDimmed]}>
            {formatTime(schedule.hour, schedule.minute)}
          </Text>
          <View style={[sc.badge, isOn ? sc.badgeOn : sc.badgeOff]}>
            <Ionicons name={isOn ? 'power' : 'power-outline'} size={9} color={isOn ? colors.accent : '#FF4D4D'} />
            <Text style={[sc.badgeText, isOn ? sc.badgeTextOn : sc.badgeTextOff]}>{isOn ? 'ON' : 'OFF'}</Text>
          </View>
        </View>
        <ToggleSwitch
          isOn={schedule.enabled}
          onToggle={() => onToggleEnabled(!schedule.enabled)}
          size="sm"
        />
      </View>

      {/* Row 2: device(s) */}
      <View style={sc.deviceRow}>
        <View style={[sc.deviceDot, isLight ? sc.dotLight : sc.dotFan]}>
          <Ionicons
            name={deviceSetIcon(schedule.device_ids)}
            size={11}
            color={isLight ? colors.accent : colors.blue}
          />
        </View>
        <Text style={sc.deviceText}>{summarizeDevices(schedule.device_ids, roomNames)}</Text>
      </View>

      {/* Row 3: day chips */}
      <View style={sc.daysRow}>
        {DAYS.map((day, i) => {
          const active = schedule.days.includes(day);
          return (
            <View key={day} style={[sc.dayDot, active && sc.dayDotActive]}>
              <Text style={[sc.dayText, active && sc.dayTextActive]}>{DAYS_LABEL[i]}</Text>
            </View>
          );
        })}
      </View>

      {/* Divider */}
      <View style={sc.divider} />

      {/* Row 4: created by + actions */}
      <View style={sc.footer}>
        <View style={sc.metaGroup}>
          <Ionicons name="person-outline" size={11} color={colors.textMuted} />
          <Text style={sc.metaText}>{schedule.created_by}</Text>
        </View>
        <View style={sc.btnGroup}>
          <TouchableOpacity style={sc.editBtn} onPress={onEdit} activeOpacity={0.7}>
            <Ionicons name="pencil-outline" size={13} color={colors.textSecondary} />
            <Text style={sc.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sc.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={13} color="#FF4D4D" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
    </FadeInView>
  );
};

const createScStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md },
  cardDisabled: { opacity: 0.5 },
  row1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm },
  timeGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  time: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  timeDimmed: { color: colors.textSecondary },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, alignSelf: 'center' },
  badgeOn:       { backgroundColor: 'rgba(47,128,237,0.12)', borderColor: 'rgba(47,128,237,0.3)' },
  badgeOff:      { backgroundColor: 'rgba(255,77,77,0.10)', borderColor: 'rgba(255,77,77,0.25)' },
  badgeText:     { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  badgeTextOn:   { color: colors.accent },
  badgeTextOff:  { color: '#FF4D4D' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.xs },
  deviceDot: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  dotLight: { backgroundColor: 'rgba(47,128,237,0.12)' },
  dotFan:   { backgroundColor: 'rgba(96,165,250,0.12)' },
  deviceText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  daysRow:      { flexDirection: 'row', gap: 5, marginBottom: SPACING.md },
  dayDot:       { width: 26, height: 26, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  dayDotActive: { backgroundColor: 'rgba(47,128,237,0.15)' },
  dayText:      { color: colors.textMuted, fontSize: 9, fontWeight: '800' },
  dayTextActive:{ color: colors.accent },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: SPACING.md },
  footer:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaGroup:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.textMuted, fontSize: 11 },
  btnGroup: { flexDirection: 'row', gap: SPACING.xs },
  editBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingVertical: 6, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: RADIUS.sm },
  editBtnText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  deleteBtn: { width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: 'rgba(255,77,77,0.07)', borderWidth: 1, borderColor: 'rgba(255,77,77,0.22)', alignItems: 'center', justifyContent: 'center' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

const SchedulesScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const isAdmin = user?.role === 'admin';

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  // The real devices the backend knows about. Sourced from /states so the picker
  // never offers a device that doesn't exist (which would fail schedule creation).
  const [knownDevices, setKnownDevices] = useState<string[]>(ALL_DEVICES);
  // Room-prefix → display-name map (from /states) so device labels show the
  // admin-defined room names instead of the generic "Room N".
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});

  const assignedCabinIds = user?.assignedCabinIds ?? [];
  const availableDevices = useMemo(() => {
    if (isAdmin) return knownDevices;
    const rooms = assignedCabinIds.map((id) => `r${id.replace('cabin-', '')}`);
    return knownDevices.filter((d) => rooms.some((r) => d.startsWith(`${r}/`)));
  }, [isAdmin, knownDevices, assignedCabinIds.join(',')]);

  // Non-admin users only see schedules that touch at least one of their devices.
  const visibleSchedules = useMemo(
    () => isAdmin ? schedules : schedules.filter((s) => s.device_ids.some((id) => availableDevices.includes(id))),
    [schedules, isAdmin, availableDevices]
  );

  const fetchSchedules = useCallback(async () => {
    try {
      const data = await api.listSchedules();
      setSchedules(data);
    } catch (_) {}
    // Refresh the real device set from the backend. Keys of /states are the
    // actual device ids (e.g. "r1/l1"); only these can be scheduled.
    try {
      const { states, names } = await api.getStates();
      const ids = Object.keys(states).filter((k) => k.includes('/l') || k.includes('/f'));
      if (ids.length) setKnownDevices(sortDeviceIds(ids));
      setRoomNames(names ?? {});
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSchedules();
    setRefreshing(false);
  }, [fetchSchedules]);

  const handleSave = async (form: ScheduleCreate, editId: number | null) => {
    try {
      if (editId !== null) {
        const updated = await api.updateSchedule(editId, {
          action: form.action, hour: form.hour, minute: form.minute,
          days: form.days, enabled: form.enabled,
        });
        setSchedules((prev) => prev.map((s) => (s.id === editId ? updated : s)));
      } else {
        // The server creates a single schedule (returned as a one-item array).
        const created = await api.createSchedule(form);
        setSchedules((prev) => [...prev, ...created]);
      }
      setFormVisible(false);
      setEditTarget(null);
    } catch (e) {
      Alert.alert('Error', await describeError(e, 'Could not save schedule. Please try again.'));
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Schedule', 'This automation will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSchedule(id);
            setSchedules((prev) => prev.filter((s) => s.id !== id));
          } catch (_) {
            Alert.alert('Error', 'Could not delete schedule.');
          }
        },
      },
    ]);
  };

  const handleToggleEnabled = async (schedule: Schedule, enabled: boolean) => {
    setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, enabled } : s)));
    try {
      await api.updateSchedule(schedule.id, { enabled });
    } catch (_) {
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, enabled: !enabled } : s)));
    }
  };

  const openCreate = () => { setEditTarget(null); setFormVisible(true); };
  const openEdit   = (s: Schedule) => { setEditTarget(s); setFormVisible(true); };

  const formInitial: ScheduleCreate = editTarget
    ? { device_ids: [...editTarget.device_ids], action: editTarget.action, hour: editTarget.hour, minute: editTarget.minute, days: [...editTarget.days], enabled: editTarget.enabled }
    : { ...DEFAULT_FORM, device_ids: [availableDevices[0] ?? ALL_DEVICES[0]] };

  return (
    <View style={s.root}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={s.glowTR} />
      <View style={s.glowBL} />

      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Schedules</Text>
            <Text style={s.subtitle}>
              {loading ? 'Loading…' : `${visibleSchedules.length} automation${visibleSchedules.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.badge}>
              <Text style={s.badgeText}>{loading ? '–' : visibleSchedules.length}</Text>
            </View>
            {/* + button in top-right, consistent with rest of app */}
            <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View style={s.center}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="time-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>Loading schedules…</Text>
          </View>
        ) : visibleSchedules.length === 0 ? (
          <View style={s.center}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No schedules yet</Text>
            <Text style={s.emptySubtitle}>
              Tap the + button above to create{'\n'}your first automation.
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={openCreate} activeOpacity={0.8}>
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={s.emptyBtnText}>Create Schedule</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={visibleSchedules}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, index }) => (
              <ScheduleCard
                schedule={item}
                index={index}
                roomNames={roomNames}
                onEdit={() => openEdit(item)}
                onDelete={() => handleDelete(item.id)}
                onToggleEnabled={(v) => handleToggleEnabled(item, v)}
              />
            )}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
            }
          />
        )}
      </SafeAreaView>

      <ScheduleFormModal
        visible={formVisible}
        initial={formInitial}
        editId={editTarget?.id ?? null}
        availableDevices={availableDevices.length > 0 ? availableDevices : ALL_DEVICES}
        roomNames={roomNames}
        onSave={handleSave}
        onClose={() => { setFormVisible(false); setEditTarget(null); }}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  glowTR: { position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(47,128,237,0.07)' },
  glowBL: { position: 'absolute', bottom: 100, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(47,128,237,0.04)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg },
  title:    { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  badge: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  list:   { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xxxl },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  emptyTitle:    { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: SPACING.sm },
  emptySubtitle: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderWidth: 1, borderColor: 'rgba(47,128,237,0.35)', backgroundColor: 'rgba(47,128,237,0.08)', borderRadius: RADIUS.full, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
  emptyBtnText:  { color: colors.accent, fontSize: 14, fontWeight: '600' },
});

export default SchedulesScreen;
