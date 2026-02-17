const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Remove AD_ID permission from Android manifest
 * This prevents Google Play Console from detecting advertising ID usage
 */
const withRemoveAdIdPermission = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Find and remove AD_ID permission
    if (androidManifest.manifest && androidManifest.manifest.usesPermission) {
      androidManifest.manifest.usesPermission = androidManifest.manifest.usesPermission.filter(
        (permission) => {
          const permissionName = permission.$['android:name'];
          return permissionName !== 'com.google.android.gms.permission.AD_ID';
        }
      );
    }
    
    return config;
  });
};

module.exports = withRemoveAdIdPermission;

