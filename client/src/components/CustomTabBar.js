import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const CustomTabBar = ({ state, descriptors, navigation, onBeforeAddMedicine }) => {
  const { isAuthenticated, isLoaded } = useAuth();
  const settingsLabel = isLoaded && !isAuthenticated ? 'ACCOUNT' : 'SETTINGS';

  const tabs = [
    { 
      name: 'Dashboard', 
      label: 'HOME', 
      icon: (color, size) => <MaterialIcons name="home" size={size} color={color} /> 
    },
    { 
      name: 'Calendar', 
      label: 'CALENDAR', 
      icon: (color, size) => <Ionicons name="calendar-outline" size={size} color={color} /> 
    },
    { 
      name: 'AddMedicine', 
      label: '', 
      icon: (color, size) => <MaterialIcons name="add" size={32} color="white" />, 
      isCenter: true 
    },
    { 
      name: 'Metrics', 
      label: 'VITALS', 
      icon: (color, size) => <MaterialIcons name="favorite" size={size} color={color} /> 
    },
    { 
      name: 'Settings', 
      label: settingsLabel, 
      icon: (color, size) => <Ionicons name="settings-outline" size={size} color={color} /> 
    },
  ];

  const openRootScreen = (screenName) => {
    navigation.getParent()?.navigate(screenName);
  };

  const openAddMedicine = () => {
    onBeforeAddMedicine?.();
    openRootScreen('AddMedicine');
  };

  return (
    <SafeAreaView className="bg-white" edges={['bottom']} style={{ paddingTop: 0 }}>
      <View className="flex-row pt-2 pb-2 border-t border-gray-200 bg-white items-center" style={{ minHeight: 58 }}>
        {tabs.map((tab) => {
          const route = state.routes.find(r => r.name === tab.name);
          if (!route) {
            // For AddMedicine, it's not in the tab routes but we still want to show it
            if (tab.isCenter) {
              return (
                <TouchableOpacity
                  key={tab.name}
                  className="w-15 h-15 items-center justify-center mb-4"
                  onPress={openAddMedicine}
                  activeOpacity={0.7}
                >
                  <View 
                    className="w-14 h-14 rounded-full items-center justify-center"
                    style={{ 
                      backgroundColor: '#90CDF4',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 3.84,
                      elevation: 5,
                    }}
                  >
                    {tab.icon('#90CDF4', 32)}
                  </View>
                </TouchableOpacity>
              );
            }
            return null;
          }
          
          const isFocused = state.routes[state.index]?.name === tab.name;
          const descriptor = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (tab.isCenter) {
            return (
              <TouchableOpacity
                key={tab.name}
                className="w-15 h-15 items-center justify-center mb-4"
                onPress={openAddMedicine}
                activeOpacity={0.7}
              >
                <View 
                  className="w-14 h-14 rounded-full items-center justify-center"
                  style={{ 
                    backgroundColor: '#90CDF4',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                  }}
                >
                  {tab.icon('#90CDF4', 32)}
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.name}
              className="flex-1 items-center justify-center"
              onPress={onPress}
              activeOpacity={0.7}
            >
              <View className="mb-1">
                {tab.icon(isFocused ? '#90CDF4' : '#999', 22)}
              </View>
              <Text 
                className="text-[10px] font-semibold uppercase"
                style={{ color: isFocused ? '#90CDF4' : '#999' }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

export default CustomTabBar;

