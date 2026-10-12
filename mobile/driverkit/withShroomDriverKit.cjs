const { withXcodeProject } = require('@expo/config-plugins');
const { configureProject } = require('./integrate-ios.cjs');

/** Embed the DriverKit target during Expo prebuild; unsigned generation is allowed, device use requires a team. */
module.exports = function withShroomDriverKit(config, options = {}) {
  const team = options.teamId ?? process.env.SHROOM_APPLE_TEAM_ID ?? '';
  if (team !== '' && !/^[A-Z0-9]{10}$/.test(team)) throw new Error('SHROOM_APPLE_TEAM_ID must be the ten-character Apple team ID.');
  const bundleID = config.ios?.bundleIdentifier;
  if (!/^[A-Za-z0-9.-]+$/.test(bundleID ?? '')) throw new Error('Shroom DriverKit requires ios.bundleIdentifier.');
  config.ios = config.ios ?? {};
  config.ios.entitlements = { ...config.ios.entitlements, 'com.apple.developer.driverkit.communicates-with-drivers': true };
  return withXcodeProject(config, (mod) => {
    configureProject(mod.modResults, { projectDirectory: mod.modRequest.platformProjectRoot, team, bundleID });
    return mod;
  });
};
