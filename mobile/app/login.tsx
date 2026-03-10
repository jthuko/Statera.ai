import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const me = await login(email.trim(), password);
      if (me.systemRole === "Staff") {
        router.replace("/(portal)/dashboard");
      } else {
        router.replace("/(admin)/dashboard");
      }
    } catch (e: any) {
      const status = e?.response?.status;
      setError(status === 401 ? "Invalid email or password." : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBox}>
          <Text variant="headlineLarge" style={styles.logo}>Statera</Text>
          <Text variant="bodyMedium" style={styles.sub}>Staff Portal</Text>
        </View>

        <View style={styles.card}>
          <Text variant="titleMedium" style={styles.heading}>Sign in to your account</Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            mode="outlined"
            style={styles.input}
            outlineColor="rgba(255,255,255,0.2)"
            activeOutlineColor="#4db6ac"
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            mode="outlined"
            style={styles.input}
            outlineColor="rgba(255,255,255,0.2)"
            activeOutlineColor="#4db6ac"
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(v => !v)}
              />
            }
          />

          {!!error && <HelperText type="error" visible>{error}</HelperText>}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.btn}
            buttonColor="#00897b"
            textColor="#fff"
          >
            Sign In
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1929" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoBox: { alignItems: "center", marginBottom: 36 },
  logo: { color: "#4db6ac", fontWeight: "bold" },
  sub: { color: "rgba(255,255,255,0.5)", marginTop: 4 },
  card: {
    backgroundColor: "#0d2137",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heading: { color: "#e0f2f1", marginBottom: 20, fontWeight: "600" },
  input: { marginBottom: 12, backgroundColor: "#112240" },
  btn: { marginTop: 8, borderRadius: 8 },
});
