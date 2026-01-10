import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

const { width } = Dimensions.get('window');

const BodyMap = ({ onSiteSelect, selectedSites = [], viewMode = 'front' }) => {
  const [hoveredSite, setHoveredSite] = useState(null);

  // Body regions with coordinates (normalized 0-1, will be scaled to viewBox)
  const bodyRegions = {
    front: {
      head: { path: 'M 50 5 L 60 5 L 65 15 L 60 25 L 50 25 L 45 15 Z', label: 'Head', x: 50, y: 15 },
      leftShoulder: { path: 'M 35 25 L 45 25 L 45 35 L 40 40 L 35 35 Z', label: 'Left Shoulder', x: 40, y: 30 },
      rightShoulder: { path: 'M 55 25 L 65 25 L 65 35 L 70 40 L 65 35 Z', label: 'Right Shoulder', x: 60, y: 30 },
      leftArm: { path: 'M 30 35 L 40 40 L 40 60 L 35 65 L 30 60 Z', label: 'Left Arm', x: 35, y: 50 },
      rightArm: { path: 'M 60 35 L 70 40 L 70 60 L 75 65 L 70 60 Z', label: 'Right Arm', x: 65, y: 50 },
      chest: { path: 'M 40 35 L 60 35 L 60 50 L 40 50 Z', label: 'Chest', x: 50, y: 42 },
      abdomen: { path: 'M 40 50 L 60 50 L 60 70 L 40 70 Z', label: 'Abdomen', x: 50, y: 60 },
      leftThigh: { path: 'M 40 70 L 50 70 L 50 90 L 45 95 L 40 90 Z', label: 'Left Thigh', x: 45, y: 80 },
      rightThigh: { path: 'M 50 70 L 60 70 L 60 90 L 65 95 L 60 90 Z', label: 'Right Thigh', x: 55, y: 80 },
      leftKnee: { path: 'M 42 90 L 48 90 L 48 95 L 42 95 Z', label: 'Left Knee', x: 45, y: 92 },
      rightKnee: { path: 'M 52 90 L 58 90 L 58 95 L 52 95 Z', label: 'Right Knee', x: 55, y: 92 },
      leftCalf: { path: 'M 40 95 L 50 95 L 50 100 L 40 100 Z', label: 'Left Calf', x: 45, y: 97 },
      rightCalf: { path: 'M 50 95 L 60 95 L 60 100 L 50 100 Z', label: 'Right Calf', x: 55, y: 97 },
    },
    back: {
      head: { path: 'M 50 5 L 60 5 L 65 15 L 60 25 L 50 25 L 45 15 Z', label: 'Head', x: 50, y: 15 },
      leftShoulder: { path: 'M 35 25 L 45 25 L 45 35 L 40 40 L 35 35 Z', label: 'Left Shoulder', x: 40, y: 30 },
      rightShoulder: { path: 'M 55 25 L 65 25 L 65 35 L 70 40 L 65 35 Z', label: 'Right Shoulder', x: 60, y: 30 },
      leftArm: { path: 'M 30 35 L 40 40 L 40 60 L 35 65 L 30 60 Z', label: 'Left Arm', x: 35, y: 50 },
      rightArm: { path: 'M 60 35 L 70 40 L 70 60 L 75 65 L 70 60 Z', label: 'Right Arm', x: 65, y: 50 },
      upperBack: { path: 'M 40 35 L 60 35 L 60 50 L 40 50 Z', label: 'Upper Back', x: 50, y: 42 },
      lowerBack: { path: 'M 40 50 L 60 50 L 60 70 L 40 70 Z', label: 'Lower Back', x: 50, y: 60 },
      leftThigh: { path: 'M 40 70 L 50 70 L 50 90 L 45 95 L 40 90 Z', label: 'Left Thigh', x: 45, y: 80 },
      rightThigh: { path: 'M 50 70 L 60 70 L 60 90 L 65 95 L 60 90 Z', label: 'Right Thigh', x: 55, y: 80 },
      leftCalf: { path: 'M 40 95 L 50 95 L 50 100 L 40 100 Z', label: 'Left Calf', x: 45, y: 97 },
      rightCalf: { path: 'M 50 95 L 60 95 L 60 100 L 50 100 Z', label: 'Right Calf', x: 55, y: 97 },
    },
  };

  const regions = bodyRegions[viewMode] || bodyRegions.front;

  const handleRegionPress = (regionKey) => {
    if (onSiteSelect) {
      onSiteSelect(regionKey, regions[regionKey].label);
    }
  };

  const isSelected = (regionKey) => {
    return selectedSites.some(site => site.region === regionKey);
  };

  const getRegionColor = (regionKey) => {
    if (isSelected(regionKey)) {
      return '#4285F4'; // Blue for selected
    }
    if (hoveredSite === regionKey) {
      return '#E3F2FD'; // Light blue for hover
    }
    return '#E0E0E0'; // Gray for unselected
  };

  return (
    <View style={styles.container}>
      <View style={styles.svgContainer}>
        <Svg
          width={width - 64}
          height={400}
          viewBox="0 0 100 100"
          style={styles.svg}
        >
          {/* Render body regions */}
          {Object.entries(regions).map(([key, region]) => (
            <G key={key}>
              <Path
                d={region.path}
                fill={getRegionColor(key)}
                stroke="#999"
                strokeWidth="0.5"
                opacity={isSelected(key) ? 0.8 : 0.5}
                onPress={() => handleRegionPress(key)}
              />
              {isSelected(key) && (
                <Circle
                  cx={region.x}
                  cy={region.y}
                  r="2"
                  fill="#4285F4"
                />
              )}
            </G>
          ))}
        </Svg>
        
        {/* Overlay touchable areas */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
          {Object.entries(regions).map(([key, region]) => {
            // Calculate approximate touch area from path coordinates
            const pathBounds = region.path.match(/\d+\.?\d*/g) || [];
            const xCoords = pathBounds.filter((_, i) => i % 2 === 0).map(Number);
            const yCoords = pathBounds.filter((_, i) => i % 2 === 1).map(Number);
            const minX = Math.min(...xCoords);
            const maxX = Math.max(...xCoords);
            const minY = Math.min(...yCoords);
            const maxY = Math.max(...yCoords);
            
            const svgWidth = width - 64;
            const svgHeight = 400;
            const scaleX = svgWidth / 100;
            const scaleY = svgHeight / 100;
            
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.7}
                onPress={() => handleRegionPress(key)}
                style={{
                  position: 'absolute',
                  left: minX * scaleX,
                  top: minY * scaleY,
                  width: (maxX - minX) * scaleX,
                  height: (maxY - minY) * scaleY,
                }}
              />
            );
          })}
        </View>
      </View>

      {/* Region labels */}
      <View style={styles.labelsContainer}>
        {Object.entries(regions).map(([key, region]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.labelButton,
              isSelected(key) && styles.labelButtonSelected,
            ]}
            onPress={() => handleRegionPress(key)}
          >
            <Text
              style={[
                styles.labelText,
                isSelected(key) && styles.labelTextSelected,
              ]}
            >
              {region.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
  },
  svgContainer: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },
  svg: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 8,
  },
  labelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  labelButtonSelected: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  labelText: {
    fontSize: 12,
    color: '#666',
  },
  labelTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default BodyMap;

