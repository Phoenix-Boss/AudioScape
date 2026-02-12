// app/(player)/_layout.tsx
import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function PlayerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
          contentStyle: {
            backgroundColor: Colors.background,
          },
          animationDuration: 300,
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            gestureDirection: 'vertical',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}