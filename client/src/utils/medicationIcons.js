import React from 'react';
import { View } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

/**
 * Get the icon component for a medication type with distinct colors
 * @param {string} type - The medication type (tablet, pill, syrup, injection, etc.)
 * @param {number} size - Icon size
 * @param {string} color - Override color (optional, will use default colors if not provided)
 * @returns {React.Component} Icon component
 */
export const getMedicationIcon = (type, size = 24, color = null) => {
  const iconType = (type || 'tablet').toLowerCase().trim();
  
  
  // Define distinct colors for each medication type
  const iconColors = {
    tablet: '#E53935',      // Red
    pill: '#FFB300',        // Yellow/Amber
    capsule: '#1E88E5',    // Blue
    syrup: '#8E24AA',      // Purple
    injection: '#F4511E',  // Deep Orange
    drops: '#00ACC1',      // Cyan
    cream: '#43A047',      // Green
    spray: '#5C6BC0',     // Indigo
    inhaler: '#00897B',    // Teal
    patch: '#D32F2F',      // Dark Red
    suppository: '#7B1FA2', // Deep Purple
    powder: '#F57C00',     // Orange
  };
  
  const iconColor = color || iconColors[iconType] || '#555';
  
  switch (iconType) {
    case 'tablet':
      return <MaterialIcons name="medication" size={size} color={iconColor} />;
    case 'pill':
      return <MaterialIcons name="circle" size={size} color={iconColor} />;
    case 'syrup':
      return <Ionicons name="flask-outline" size={size} color={iconColor} />;
    case 'injection':
      return <MaterialIcons name="vaccines" size={size} color={iconColor} />;
    case 'capsule':
      return <MaterialIcons name="fiber-manual-record" size={size} color={iconColor} />;
    case 'drops':
      return <Ionicons name="water-outline" size={size} color={iconColor} />;
    case 'cream':
      return <MaterialIcons name="healing" size={size} color={iconColor} />;
    case 'spray':
      return <MaterialIcons name="air" size={size} color={iconColor} />;
    case 'inhaler':
      return <MaterialIcons name="air" size={size} color={iconColor} />;
    case 'patch':
      return <MaterialIcons name="square" size={size} color={iconColor} />;
    case 'suppository':
      return <MaterialIcons name="fiber-manual-record" size={size} color={iconColor} />;
    case 'powder':
      return <MaterialIcons name="grain" size={size} color={iconColor} />;
    case 'other':
      return <MaterialIcons name="more-horiz" size={size} color={iconColor} />;
    default:
      return <MaterialIcons name="medication" size={size} color={iconColor} />;
  }
};

/**
 * Get list of available medication types
 */
export const MEDICATION_TYPES = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'pill', label: 'Pill' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'injection', label: 'Injection' },
  { value: 'drops', label: 'Drops' },
  { value: 'cream', label: 'Cream' },
  { value: 'spray', label: 'Spray' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'patch', label: 'Patch' },
  { value: 'powder', label: 'Powder' },
  { value: 'other', label: 'Other' },
];

