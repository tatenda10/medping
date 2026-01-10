import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

const BottomTabBar = () => {
  const navigation = useNavigation();

  const tabs = [
    { name: 'Dashboard', label: 'Dashboard', icon: (color, size) => <MaterialIcons name="dashboard" size={size} color={color} /> },
    { name: 'Calendar', label: 'Calendar', icon: (color, size) => <Ionicons name="calendar-outline" size={size} color={color} /> },
    { name: 'Metrics', label: 'Metrics', icon: (color, size) => <MaterialIcons name="analytics" size={size} color={color} /> },
    { name: 'ProfileTab', label: 'Profile', icon: (color, size) => <Ionicons name="person-circle-outline" size={size} color={color} /> },
    { name: 'Settings', label: 'Settings', icon: (color, size) => <Ionicons name="settings-outline" size={size} color={color} /> },
  ];

  const handleTabPress = (tab) => {
    try {
      const currentState = navigation.getState();
      const currentRouteName = currentState?.routes[currentState?.index]?.name;
      
      // Check if we're already in a MainTabs tab screen
      if (['Dashboard', 'Calendar', 'Metrics', 'ProfileTab', 'Settings'].includes(currentRouteName)) {
        // We're already in MainTabs, navigate directly to the tab
        navigation.navigate(tab.name);
        return;
      }
      
      // We're in a Drawer screen (MedicationDetail, EditMedicine, AddMedicine, etc.)
      // Find the Drawer navigator by going up the navigation tree
      let drawerNav = null;
      let currentNav = navigation;
      
      // Try to find the Drawer navigator (parent that has MainTabs)
      for (let i = 0; i < 5; i++) {
        const parent = currentNav.getParent?.();
        if (!parent) break;
        
        try {
          const parentState = parent.getState?.();
          if (parentState?.routes?.some(route => route.name === 'MainTabs')) {
            drawerNav = parent;
            break;
          }
        } catch (e) {
          // Continue searching
        }
        currentNav = parent;
      }
      
      if (drawerNav) {
        // Navigate using the Drawer navigator
        drawerNav.navigate('MainTabs', { screen: tab.name });
      } else {
        // Fallback: try navigating directly (should work if we're in Drawer context)
        navigation.navigate('MainTabs', { screen: tab.name });
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Last resort: use CommonActions with a reset
      try {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                name: 'MainTabs',
                params: {
                  screen: tab.name,
                },
              },
            ],
          })
        );
      } catch (e) {
        console.error('Final navigation error:', e);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => handleTabPress(tab)}
            activeOpacity={0.7}
          >
            <View style={styles.tabIconWrapper}>
              {tab.icon('#4285F4', 22)}
            </View>
            <Text style={styles.tabLabel}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    height: 80,
    paddingBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapper: {
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
  },
});

export default BottomTabBar;

