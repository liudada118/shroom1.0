#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const xcode = require('xcode');

/** Read one named CLI option, falling back to a project default. */
function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

/** Strip the surrounding quotes used by the xcode project parser. */
function unquote(value) { return String(value ?? '').replace(/^"|"$/g, ''); }

/** Omit unset xcode helper fields instead of serializing them as the literal string undefined. */
function omitUnsetProjectFields(object) {
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || value === 'undefined') delete object[key];
  }
}

/** Add a DriverKit target to Expo's generated project, with an original-project backup. */
function integrate() {
  const input = process.argv[2];
  if (!input || input.startsWith('--')) throw new Error('Usage: node driverkit/integrate-ios.cjs ios/Shroom.xcodeproj --team TEAMID [--development-signing] [--check]');
  const projectPath = path.resolve(input);
  const pbxPath = projectPath.endsWith('.pbxproj') ? projectPath : path.join(projectPath, 'project.pbxproj');
  const projectDirectory = path.dirname(path.dirname(pbxPath));
  const team = option('--team', process.env.SHROOM_APPLE_TEAM_ID);
  if (!/^[A-Z0-9]{10}$/.test(team ?? '')) throw new Error('Provide the ten-character Apple team ID with --team or SHROOM_APPLE_TEAM_ID.');
  const mobileConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  const bundleID = option('--app-bundle-id', mobileConfig.expo.ios.bundleIdentifier);
  if (!/^[A-Za-z0-9.-]+$/.test(bundleID ?? '')) throw new Error('Invalid app bundle identifier.');
  const project = xcode.project(pbxPath).parseSync();
  const developmentSigning = process.argv.includes('--development-signing');
  const result = configureProject(project, { projectDirectory, team, bundleID, developmentSigning });
  if (result === null) { console.log('ShroomCH340 target already matches the requested configuration.'); return; }
  if (process.argv.includes('--check')) {
    require('xcode/lib/parser/pbxproj').parse(result);
    console.log('DriverKit target transformation prepared; --check did not write the project. This does not compile or sign the driver.');
    return;
  }
  const backup = `${pbxPath}.before-shroom-driverkit`;
  if (!fs.existsSync(backup)) fs.copyFileSync(pbxPath, backup, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(pbxPath, result);
  console.log(`Configured ShroomCH340 in ${pbxPath} for ${developmentSigning ? 'automatic development' : 'manual'} signing; the host also needs a matching provisioning profile.`);
}

/** Add the complete DriverKit target to an in-memory Xcode project for prebuild or CLI use. */
function configureProject(project, { projectDirectory, team, bundleID, developmentSigning = false }) {
  const objects = project.hash.project.objects;
  objects.PBXContainerItemProxy ??= {};
  objects.PBXTargetDependency ??= {};
  const first = project.getFirstTarget();
  if (unquote(first.firstTarget.productType) !== 'com.apple.product-type.application') throw new Error('The first target must be the Expo iOS application.');
  const previous = project.writeSync();
  const previousGroups = new Set(Object.keys(objects.PBXGroup));
  const existing = Object.entries(project.pbxNativeTargetSection()).find(([, target]) => target?.name && unquote(target.name) === 'ShroomCH340');
  // xcode's target helper lacks DriverKit; create a bundle then set the actual Apple product type.
  const target = existing ? { uuid: existing[0], pbxNativeTarget: existing[1] }
    : project.addTarget('ShroomCH340', 'bundle', 'ShroomCH340', `${bundleID}.driver`);
  target.pbxNativeTarget.productType = '"com.apple.product-type.driver-extension"';
  const product = objects.PBXFileReference[target.pbxNativeTarget.productReference];
  product.path = 'ShroomCH340.dext';
  product.explicitFileType = '"wrapper.driver-extension"';
  product.sourceTree = 'BUILT_PRODUCTS_DIR';
  omitUnsetProjectFields(product);
  if (!existing) {
    const group = project.addPbxGroup([], 'Shroom DriverKit');
    project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    for (const filename of ['ShroomCH340Driver.cpp', 'ShroomCH340Driver.iig', 'ShroomCH340UserClient.cpp', 'ShroomCH340UserClient.iig']) {
      const relative = path.relative(projectDirectory, path.join(__dirname, 'ShroomCH340', filename)).split(path.sep).join('/');
      const file = project.addSourceFile(relative, { target: target.uuid }, group.uuid);
      if (filename.endsWith('.iig')) objects.PBXFileReference[file.fileRef].lastKnownFileType = 'sourcecode.iig';
    }
    project.addFramework('DriverKit.framework', { target: target.uuid });
    project.addFramework('USBDriverKit.framework', { target: target.uuid });
  }
  for (const [key, group] of Object.entries(objects.PBXGroup)) {
    if (!previousGroups.has(key) && group?.isa === 'PBXGroup') omitUnsetProjectFields(group);
  }
  const driverGroup = Object.values(objects.PBXGroup).find(group => group?.name && unquote(group.name) === 'Shroom DriverKit');
  if (driverGroup) {
    driverGroup.name = JSON.stringify('Shroom DriverKit');
    omitUnsetProjectFields(driverGroup);
  }
  // xcode's file map omits C++/IIG; unknown types prevent the native compiler from selecting its rules.
  for (const entry of target.pbxNativeTarget.buildPhases) {
    const phase = objects.PBXSourcesBuildPhase?.[entry.value] ?? objects.PBXFrameworksBuildPhase?.[entry.value];
    for (const file of phase?.files ?? []) {
      const reference = objects.PBXFileReference[objects.PBXBuildFile[file.value].fileRef];
      omitUnsetProjectFields(reference);
      const extension = path.extname(unquote(reference.path));
      if (extension === '.cpp') reference.lastKnownFileType = 'sourcecode.cpp.cpp';
      if (extension === '.iig') reference.lastKnownFileType = 'sourcecode.iig';
    }
  }
  const configurationList = objects.XCConfigurationList[target.pbxNativeTarget.buildConfigurationList];
  const relativeDriver = path.relative(projectDirectory, __dirname).split(path.sep).join('/');
  for (const entry of configurationList.buildConfigurations) {
    const settings = objects.XCBuildConfiguration[entry.value].buildSettings;
    if (developmentSigning) {
      // Explicit profiles conflict with automatic signing, including SDK-specific overrides.
      for (const key of Object.keys(settings)) {
        if (/^PROVISIONING_PROFILE(?:_SPECIFIER)?(?:\[|$)/.test(unquote(key))) delete settings[key];
      }
    }
    Object.assign(settings, {
      SDKROOT: 'driverkit', SUPPORTED_PLATFORMS: 'driverkit', ARCHS: 'arm64',
      DRIVERKIT_DEPLOYMENT_TARGET: '22.0', MACH_O_TYPE: 'mh_execute', WRAPPER_EXTENSION: 'dext',
      CLANG_CXX_LANGUAGE_STANDARD: '"gnu++17"', DEVELOPMENT_TEAM: team || '""',
      CODE_SIGN_STYLE: developmentSigning ? 'Automatic' : 'Manual', CODE_SIGN_IDENTITY: '"Apple Development"',
      CODE_SIGN_ENTITLEMENTS: JSON.stringify(`${relativeDriver}/ShroomCH340/ShroomCH340${developmentSigning ? '.development' : ''}.entitlements`),
      INFOPLIST_FILE: JSON.stringify(`${relativeDriver}/ShroomCH340/Info.plist`),
      PRODUCT_BUNDLE_IDENTIFIER: JSON.stringify(`${bundleID}.driver`),
      HEADER_SEARCH_PATHS: ['"$(inherited)"', '"$(DERIVED_SOURCES_DIR)"', JSON.stringify(`$(SRCROOT)/${relativeDriver}/Shared`)],
      GCC_PREPROCESSOR_DEFINITIONS: ['"$(inherited)"', JSON.stringify(`SHROOM_CLIENT_APPLICATION_ID=${team}.${bundleID}`)],
      SKIP_INSTALL: 'YES',
    });
  }
  if (!existing) {
    const phase = project.addBuildPhase([], 'PBXCopyFilesBuildPhase', 'Embed Shroom Driver', first.uuid, 'products_directory');
    phase.buildPhase.dstSubfolderSpec = 16;
    phase.buildPhase.dstPath = '"$(SYSTEM_EXTENSIONS_FOLDER_PATH)"';
    const buildFileID = project.generateUuid();
    objects.PBXBuildFile[buildFileID] = { isa: 'PBXBuildFile', fileRef: target.pbxNativeTarget.productReference,
      fileRef_comment: 'ShroomCH340.dext', settings: { ATTRIBUTES: ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] } };
    objects.PBXBuildFile[`${buildFileID}_comment`] = 'ShroomCH340.dext in Embed Shroom Driver';
    phase.buildPhase.files.push({ value: buildFileID, comment: 'ShroomCH340.dext in Embed Shroom Driver' });
  }
  const output = project.writeSync();
  return output === previous ? null : output;
}

module.exports = { configureProject };
if (require.main === module) {
  try { integrate(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
