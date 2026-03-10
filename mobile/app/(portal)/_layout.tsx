import { Redirect, Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth/AuthContext";
import { ActivityIndicator, View } from "react-native";

function TabIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <MaterialCommunityIcons name={name} color={color} size={size} />;
}

export default function PortalLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a1929" }}>
        <ActivityIndicator color="#4db6ac" size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  if (user.systemRole !== "Staff") return <Redirect href="/(admin)/dashboard" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0d2137" },
        headerTintColor: "#4db6ac",
        headerTitleStyle: { fontWeight: "600" },
        tabBarStyle: { backgroundColor: "#0d2137", borderTopColor: "rgba(255,255,255,0.08)" },
        tabBarActiveTintColor: "#4db6ac",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <TabIcon name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => <TabIcon name="calendar-month-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="openShifts"
        options={{
          title: "Open Shifts",
          tabBarIcon: ({ color, size }) => <TabIcon name="briefcase-clock-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="timeclock"
        options={{
          title: "Time Clock",
          tabBarIcon: ({ color, size }) => <TabIcon name="clock-check-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="timeoff"
        options={{
          title: "Time Off",
          tabBarIcon: ({ color, size }) => <TabIcon name="beach" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => <TabIcon name="chat-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <TabIcon name="account-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
