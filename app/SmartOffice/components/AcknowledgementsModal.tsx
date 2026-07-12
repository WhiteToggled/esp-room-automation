import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, StatusBar, Image, Linking } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import FadeInView from './FadeInView';
import {
  PROJECT_TITLE,
  PROJECT_SUBTITLE,
  PROJECT_DETAIL,
  CONTRIBUTORS,
  SUPERVISOR,
} from '../constants/acknowledgements';

interface AcknowledgementsModalProps {
  visible: boolean;
  onClose: () => void;
  // Resolved by the always-mounted Header (outside this Modal's separate native
  // window) and passed in — measuring insets from inside a RN <Modal> directly
  // is unreliable and is what caused the page to visibly jump on open.
  insets: EdgeInsets;
}

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const AcknowledgementsModal: React.FC<AcknowledgementsModalProps> = ({ visible, onClose, insets }) => {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Bump this each time the modal opens so the entrance animations below replay every visit.
  const [sessionKey, setSessionKey] = useState(0);
  useEffect(() => {
    if (visible) setSessionKey((k) => k + 1);
  }, [visible]);

  // Avatars whose image failed to load (e.g. placeholder not yet replaced with a
  // real photo). We fall back to showing the contributor's initials for these.
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={styles.glowTopLeft} />
        <View style={styles.glowBottomRight} />

        <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Acknowledgements</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            key={sessionKey}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {/* Hero */}
            <FadeInView distance={18} duration={450}>
              <View style={styles.hero}>
                <View style={styles.logoCircle}>
                  <Ionicons name="flash" size={30} color={colors.accent} />
                </View>
                <Text style={styles.projectTitle}>{PROJECT_TITLE}</Text>
                <Text style={styles.projectSubtitle}>{PROJECT_SUBTITLE}</Text>
                {!!PROJECT_DETAIL && <Text style={styles.projectDetail}>{PROJECT_DETAIL}</Text>}
              </View>
            </FadeInView>

            {/* Contributors */}
            <Text style={styles.sectionLabel}>BUILT BY</Text>
            <View style={styles.contributorList}>
              {CONTRIBUTORS.map((c, idx) => (
                <FadeInView key={c.name + idx} delay={120 + idx * 70} distance={10}>
                  <View
                    style={[styles.contributorRow, idx < CONTRIBUTORS.length - 1 && styles.contributorRowBorder]}
                  >
                    <View style={styles.avatar}>
                      {c.avatar && !failedAvatars[c.name] ? (
                        <Image
                          source={c.avatar}
                          style={styles.avatarImage}
                          onError={() => setFailedAvatars((prev) => ({ ...prev, [c.name]: true }))}
                        />
                      ) : (
                        <Text style={styles.avatarText}>{getInitials(c.name)}</Text>
                      )}
                    </View>
                    <View style={styles.contributorInfo}>
                      <Text style={styles.contributorName}>{c.name}</Text>
                      <Text style={styles.contributorRole}>{c.role}</Text>
                    </View>
                    {!!c.linkedin && (
                      <TouchableOpacity
                        style={styles.linkedinBtn}
                        activeOpacity={0.6}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => Linking.openURL(c.linkedin!).catch(() => {})}
                      >
                        <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
                      </TouchableOpacity>
                    )}
                  </View>
                </FadeInView>
              ))}
            </View>

            {/* Supervisor */}
            {!!SUPERVISOR && (
              <View style={styles.supervisorRow}>
                <Ionicons name="ribbon-outline" size={14} color={colors.accent} />
                <Text style={styles.supervisorText}>Supervised by {SUPERVISOR}</Text>
              </View>
            )}

            {/* Footer */}
            <Text style={styles.footerText}>Built with React Native &amp; Expo</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  glowTopLeft: {
    position: 'absolute', top: -60, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(47,128,237,0.08)',
  },
  glowBottomRight: {
    position: 'absolute', bottom: 80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(47,128,237,0.05)',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg,
  },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },

  hero: { alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.xxl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(47,128,237,0.12)',
    borderWidth: 1, borderColor: 'rgba(47,128,237,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  projectTitle: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6 },
  projectSubtitle: { color: colors.textSecondary, fontSize: 14, fontWeight: '300', marginTop: 4 },
  projectDetail: { color: colors.textMuted, fontSize: 12, marginTop: SPACING.sm },

  sectionLabel: {
    color: colors.textMuted, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.4, marginBottom: SPACING.sm,
  },
  contributorList: {
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl,
  },
  contributorRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md,
  },
  contributorRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(47,128,237,0.15)',
    borderWidth: 1, borderColor: 'rgba(47,128,237,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 21 },
  contributorInfo: { flex: 1 },
  contributorName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  contributorRole: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  linkedinBtn: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(10,102,194,0.1)', borderWidth: 1, borderColor: 'rgba(10,102,194,0.3)',
    alignItems: 'center', justifyContent: 'center', marginLeft: SPACING.sm,
  },

  supervisorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginBottom: SPACING.xxl,
  },
  supervisorText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },

  footerText: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
});

export default AcknowledgementsModal;
