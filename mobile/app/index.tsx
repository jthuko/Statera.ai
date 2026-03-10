import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a1929" }}>
        <ActivityIndicator color="#4db6ac" size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  return user.systemRole === "Staff"
    ? <Redirect href="/(portal)/dashboard" />
    : <Redirect href="/(admin)/dashboard" />;
}
