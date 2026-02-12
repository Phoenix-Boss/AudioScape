// app/(player)/index.tsx
import { Stack } from 'expo-router';
import PlayerScreen from '@/components/player/PlayerScreen';

export default function PlayerPage() {
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
        }} 
      />
      <PlayerScreen />
    </>
  );
}