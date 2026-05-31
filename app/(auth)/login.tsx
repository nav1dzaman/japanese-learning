import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, RADIUS, SPACING } from '../../src/constants/colors';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, signUp, loading } = useAuthStore();

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (password.length !== 6) {
      Alert.alert('Error', 'Password must be exactly 6 digits');
      return;
    }

    const { error } = isLogin
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);

    if (error) {
      Alert.alert('Error', error);
    }
    // Navigation handled automatically by root layout redirect guard
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🎌</Text>
          </View>
          <Text style={styles.appName}>日本語</Text>
          <Text style={styles.appSubtitle}>Japanese Learning</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
          <Text style={styles.cardSubtitle}>
            {isLogin ? 'Sign in to continue your journey' : 'Start your Japanese journey'}
          </Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={(t) => setPassword(t.replace(/\D/g, '').slice(0, 6))}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <Text style={styles.inputHint}>6-digit numeric PIN</Text>
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setIsLogin((v) => !v)} style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Decorative Japanese characters */}
        <Text style={styles.decorative}>学ぶ · 覚える · 上達する</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    padding: SPACING.xl,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
  },
  logoEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.heavy,
    color: COLORS.text,
    letterSpacing: 4,
  },
  appSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginTop: SPACING.xs,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xxl,
  },
  form: {
    gap: SPACING.lg,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  input: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  submitText: {
    color: '#fff',
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
  },
  switchRow: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  switchText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  switchLink: {
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold,
  },
  inputHint: {
    fontSize: FONTS.sizes.xs ?? 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  decorative: {
    textAlign: 'center',
    marginTop: SPACING.xxl,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
});
