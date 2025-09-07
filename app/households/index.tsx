import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function HouseholdsScreen() {
  const router = useRouter();
  const [households, setHouseholds] = useState<any[]>([]);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  // Get logged in user
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace('/auth');
        return;
      }

      setUserId(session.user.id);
    };

    getSession();
  }, []);

  // Fetch households the user is in
  useEffect(() => {
    if (!userId) return;

    const fetchHouseholds = async () => {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, households(name)')
        .eq('id', userId); // 👈 changed from user_id to id

      if (error) {
        Alert.alert('Error fetching households', error.message);
        return;
      }

      const formatted = data.map((item) => ({
        id: item.household_id,
        name: item.households?.name ?? 'Unnamed',
      }));

      setHouseholds(formatted);
    };

    fetchHouseholds();
  }, [userId]);

  const createHousehold = async () => {
    if (!newHouseholdName.trim() || !userId) {
      console.log('Missing name or user ID');
      return;
    }

    const { data, error } = await supabase
      .from('households')
      .insert({ name: newHouseholdName, created_by: userId })
      .select()
      .single();

    if (error || !data) {
      Alert.alert('Error creating household', error?.message || 'Unknown error');
      return;
    }

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: data.id, id: userId }); // 👈 insert using id

    if (memberError) {
      Alert.alert('Error joining household', memberError.message);
      return;
    }

    setNewHouseholdName('');
    setHouseholds((prev) => [...prev, { id: data.id, name: data.name }]);
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Your Households</Text>

      <FlatList
        data={households}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ padding: 10, borderBottomWidth: 1 }}>
            <Text
              onPress={() => router.push(`/households/${item.id}`)}
              style={{ fontSize: 18, color: 'blue' }}
            >
              {item.name}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text>No households yet.</Text>}
      />

      <View style={{ marginTop: 20 }}>
        <TextInput
          placeholder="New household name"
          value={newHouseholdName}
          onChangeText={setNewHouseholdName}
          style={{
            borderWidth: 1,
            padding: 10,
            borderRadius: 5,
            marginBottom: 10,
          }}
        />
        <Button title="Create Household" onPress={createHousehold} />
      </View>
    </View>
  );
}
