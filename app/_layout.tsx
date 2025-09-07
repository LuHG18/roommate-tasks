import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSegments } from "expo-router";

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated === null) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";

    if (isAuthenticated && inAuthGroup) {
      // User is authenticated but in auth group, redirect to tabs
      router.replace("/(tabs)/households");
    } else if (!isAuthenticated && !inAuthGroup) {
      // User is not authenticated and not in auth group, redirect to auth
      router.replace("/(auth)");
    }
  }, [isAuthenticated, segments]);

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="households/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="tasks/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
