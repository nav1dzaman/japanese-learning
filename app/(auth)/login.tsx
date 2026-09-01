import React, { useState, useMemo } from 'react';
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
import { useColors } from '../../src/hooks/useColors';
import { useThemeStore } from '../../src/stores/themeStore';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/constants/colors';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, signUp, loading } = useAuthStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const isDark = useThemeStore((st) => st.scheme) === 'dark';

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
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View style={s.logoSection}>
          <View style={s.logoCircle}>
            <Text style={s.logoEmoji}>🎌</Text>
          </View>
          <Text style={s.appName}>日本語</Text>
          <Text style={s.appSubtitle}>Japanese Learning</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
          <Text style={s.cardSubtitle}>
            {isLogin ? 'Sign in to continue your journey' : 'Start your Japanese journey'}
          </Text>

          <View style={s.form}>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Email</Text>
              <TextInput
                style={s.input}
                placeholder="you@example.com"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Password</Text>
              <TextInput
                style={s.input}
                placeholder="••••••"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={(t) => setPassword(t.replace(/\D/g, '').slice(0, 6))}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <Text style={s.inputHint}>6-digit numeric PIN</Text>
            </View>

            <TouchableOpacity
              style={s.submitButton}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setIsLogin((v) => !v)} style={s.switchRow}>
            <Text style={s.switchText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={s.switchLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Decorative Japanese characters */}
        <Text style={s.decorative}>学ぶ · 覚える · 上達する</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
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
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: C.borderActive,
    },
    logoEmoji: {
      fontSize: 40,
    },
    appName: {
      fontSize: FONTS.sizes.xxxl,
      fontWeight: FONTS.weights.heavy,
      color: C.text,
      letterSpacing: 4,
    },
    appSubtitle: {
      fontSize: FONTS.sizes.sm,
      color: C.textSecondary,
      letterSpacing: 2,
      marginTop: SPACING.xs,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xxl,
      padding: SPACING.xxl,
      borderWidth: 1,
      borderColor: C.border,
    },
    cardTitle: {
      fontSize: FONTS.sizes.xxl,
      fontWeight: FONTS.weights.bold,
      color: C.text,
      marginBottom: SPACING.xs,
    },
    cardSubtitle: {
      fontSize: FONTS.sizes.sm,
      color: C.textSecondary,
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
      color: C.textSecondary,
      fontWeight: FONTS.weights.medium,
    },
    input: {
      backgroundColor: C.bgInput,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      color: C.text,
      fontSize: FONTS.sizes.md,
      borderWidth: 1,
      borderColor: C.border,
    },
    submitButton: {
      backgroundColor: C.primary,
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
      color: C.textSecondary,
    },
    switchLink: {
      color: C.primary,
      fontWeight: FONTS.weights.semibold,
    },
    inputHint: {
      fontSize: FONTS.sizes.xs ?? 11,
      color: C.textMuted,
      marginTop: 2,
    },
    decorative: {
      textAlign: 'center',
      marginTop: SPACING.xxl,
      fontSize: FONTS.sizes.sm,
      color: C.textMuted,
      letterSpacing: 2,
    },
  });
}
