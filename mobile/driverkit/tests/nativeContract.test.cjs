const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const xcode = require('xcode');
const parser = require('xcode/lib/parser/pbxproj');
const plist = require('plist');
const { configureProject } = require('../integrate-ios.cjs');

/** Read source within the mobile project for static native-boundary assertions. */
function source(relative) { return fs.readFileSync(path.join(__dirname, '../../', relative), 'utf8'); }

/** Create an isolated iOS app project without existing target-dependency sections. */
function fixture() {
  const project = xcode.project('/tmp/Shroom.xcodeproj/project.pbxproj');
  project.hash = parser.parse(`// !$*UTF8*$!
  { archiveVersion = 1; classes = {}; objectVersion = 56; objects = {
    /* Begin PBXProject section */
    A11111111111111111111111 /* Project */ = { isa = PBXProject; mainGroup = B22222222222222222222222; targets = (C33333333333333333333333 /* Shroom */,); };
    /* End PBXProject section */
    /* Begin PBXGroup section */
    B22222222222222222222222 = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
    /* End PBXGroup section */
    /* Begin PBXNativeTarget section */
    C33333333333333333333333 /* Shroom */ = { isa = PBXNativeTarget; name = Shroom; productName = Shroom; productType = "com.apple.product-type.application"; productReference = D44444444444444444444444; buildConfigurationList = E55555555555555555555555; buildPhases = (); buildRules = (); dependencies = (); };
    /* End PBXNativeTarget section */
    /* Begin PBXFileReference section */
    D44444444444444444444444 = { isa = PBXFileReference; path = Shroom.app; explicitFileType = wrapper.application; sourceTree = BUILT_PRODUCTS_DIR; };
    /* End PBXFileReference section */
    /* Begin XCConfigurationList section */
    E55555555555555555555555 = { isa = XCConfigurationList; buildConfigurations = (F66666666666666666666666 /* Debug */,); defaultConfigurationName = Debug; defaultConfigurationIsVisible = 0; };
    /* End XCConfigurationList section */
    /* Begin XCBuildConfiguration section */
    F66666666666666666666666 = { isa = XCBuildConfiguration; name = Debug; buildSettings = {}; };
    /* End XCBuildConfiguration section */
  }; rootObject = A11111111111111111111111; }\n`);
  project.hash.project.objects.PBXBuildFile = {};
  return project;
}

test('driver integration builds and embeds a real DriverKit target, and is idempotent', () => {
  const project = fixture();
  const options = { projectDirectory: '/tmp', team: 'ABCDE12345', bundleID: 'com.shroom.pressure-sensor.mobile' };
  const output = configureProject(project, options);
  const objects = parser.parse(output).project.objects;
  const driver = Object.values(objects.PBXNativeTarget).find(value => value?.name === '"ShroomCH340"');
  assert.equal(driver.productType, '"com.apple.product-type.driver-extension"');
  assert.equal(objects.PBXFileReference[driver.productReference].path, 'ShroomCH340.dext');
  const configs = objects.XCConfigurationList[driver.buildConfigurationList].buildConfigurations;
  for (const item of configs) {
    const settings = objects.XCBuildConfiguration[item.value].buildSettings;
    assert.equal(settings.SDKROOT, 'driverkit');
    assert.equal(settings.DEVELOPMENT_TEAM, 'ABCDE12345');
    assert.equal(JSON.parse(settings.GCC_PREPROCESSOR_DEFINITIONS[1]), 'SHROOM_CLIENT_APPLICATION_ID=ABCDE12345.com.shroom.pressure-sensor.mobile');
  }
  assert.equal(objects.PBXNativeTarget['C33333333333333333333333'].dependencies.length, 1);
  const embed = Object.values(objects.PBXCopyFilesBuildPhase).find(value => value?.dstPath === '"$(SYSTEM_EXTENSIONS_FOLDER_PATH)"');
  assert.equal(embed.dstSubfolderSpec, 16);
  assert.equal(embed.files.length, 1);
  assert.equal(configureProject(project, options), null);
  const changed = configureProject(project, { ...options, team: 'FGHIJ67890' });
  const changedObjects = parser.parse(changed).project.objects;
  for (const item of configs) assert.equal(changedObjects.XCBuildConfiguration[item.value].buildSettings.DEVELOPMENT_TEAM, 'FGHIJ67890');
  assert.equal(Object.values(changedObjects.PBXNativeTarget).filter(value => value?.isa === 'PBXNativeTarget').length, 2);
});

test('driver integration supports an unsigned project before and after team configuration', () => {
  const project = fixture();
  const options = { projectDirectory: '/tmp', team: '', bundleID: 'com.shroom.pressure-sensor.mobile' };
  for (const team of ['', 'ABCDE12345', '']) {
    const output = configureProject(project, { ...options, team });
    project.hash = parser.parse(output);
    const objects = project.hash.project.objects;
    const driver = Object.values(objects.PBXNativeTarget).find(value => value?.name === '"ShroomCH340"');
    for (const item of objects.XCConfigurationList[driver.buildConfigurationList].buildConfigurations) {
      const settings = objects.XCBuildConfiguration[item.value].buildSettings;
      assert.equal(settings.DEVELOPMENT_TEAM.replace(/^"|"$/g, ''), team);
      assert.equal(JSON.parse(settings.GCC_PREPROCESSOR_DEFINITIONS[1]), `SHROOM_CLIENT_APPLICATION_ID=${team}.${options.bundleID}`);
    }
    assert.equal(configureProject(project, { ...options, team }), null);
  }
});

test('driver integration emits Apple-readable groups and typed source references', () => {
  const project = fixture();
  const output = configureProject(project, { projectDirectory: '/tmp', team: '', bundleID: 'com.shroom.pressure-sensor.mobile' });
  if (process.platform === 'darwin') {
    const lint = spawnSync('plutil', ['-lint', '-'], { input: output, encoding: 'utf8' });
    assert.equal(lint.status, 0, lint.stdout + lint.stderr);
  }
  assert.doesNotMatch(output, /= undefined;/);
  const objects = parser.parse(output).project.objects;
  const group = Object.values(objects.PBXGroup).find(value => value?.name === '"Shroom DriverKit"');
  assert.ok(group);
  assert.equal(group.path, undefined);
  const driver = Object.values(objects.PBXNativeTarget).find(value => value?.name === '"ShroomCH340"');
  const sources = driver.buildPhases.map(entry => objects.PBXSourcesBuildPhase[entry.value]).find(Boolean);
  assert.equal(sources.files.length, 4);
  for (const entry of sources.files) {
    const reference = objects.PBXFileReference[objects.PBXBuildFile[entry.value].fileRef];
    assert.equal(reference.lastKnownFileType, reference.path.includes('.iig') ? 'sourcecode.iig' : 'sourcecode.cpp.cpp');
    assert.equal(reference.explicitFileType, undefined);
    assert.ok(group.children.some(child => child.value === objects.PBXBuildFile[entry.value].fileRef));
  }
});

test('development signing is opt-in and can return to manual signing without widening hardware matching', () => {
  const project = fixture();
  const options = { projectDirectory: '/tmp', team: 'ABCDE12345', bundleID: 'com.shroom.pressure-sensor.mobile' };
  for (const developmentSigning of [false, true, false]) {
    const output = configureProject(project, { ...options, developmentSigning });
    assert.notEqual(output, null, 'changing signing mode must update the generated project');
    project.hash = parser.parse(output);
    const objects = project.hash.project.objects;
    const driver = Object.values(objects.PBXNativeTarget).find(value => value?.name === '"ShroomCH340"');
    for (const item of objects.XCConfigurationList[driver.buildConfigurationList].buildConfigurations) {
      const settings = objects.XCBuildConfiguration[item.value].buildSettings;
      assert.equal(settings.CODE_SIGN_STYLE, developmentSigning ? 'Automatic' : 'Manual');
      assert.equal(JSON.parse(settings.CODE_SIGN_ENTITLEMENTS).endsWith('ShroomCH340.development.entitlements'), developmentSigning);
      assert.equal(JSON.parse(settings.GCC_PREPROCESSOR_DEFINITIONS[1]), 'SHROOM_CLIENT_APPLICATION_ID=ABCDE12345.com.shroom.pressure-sensor.mobile');
      if (developmentSigning) {
        assert.ok(!Object.keys(settings).some(key => key.includes('PROVISIONING_PROFILE')));
      } else {
        settings.PROVISIONING_PROFILE_SPECIFIER = '"Production Driver Profile"';
        settings.PROVISIONING_PROFILE = '"OLD-PROFILE-UUID"';
        settings['"PROVISIONING_PROFILE_SPECIFIER[sdk=driverkit*]"'] = '"Conditional Driver Profile"';
      }
    }
    assert.equal(configureProject(project, { ...options, developmentSigning }), null);
  }
  const development = source('driverkit/ShroomCH340/ShroomCH340.development.entitlements');
  assert.match(development, /<key>idVendor<\/key><string>\*<\/string>/);
  assert.doesNotMatch(development, /allow-any-userclient|allow-third-party-userclients/);
});

test('client and driver share a bounded versioned ABI and exact CH340 matching', () => {
  const driverABI = source('driverkit/Shared/ShroomDriverABI.h');
  const clientABI = source('modules/shroom-usb/ios/ShroomDriverABI.h');
  assert.equal(driverABI.slice(driverABI.indexOf('enum {')), clientABI.slice(clientABI.indexOf('enum {')));
  assert.match(driverABI, /ShroomReadCapacity = 2048/);
  for (const filename of ['driverkit/ShroomCH340/Info.plist', 'driverkit/ShroomCH340/ShroomCH340.entitlements']) {
    const plist = source(filename);
    assert.match(plist, /<key>idVendor<\/key><integer>6790<\/integer>/);
    assert.match(plist, /<key>idProduct<\/key><integer>29987<\/integer>/);
  }
});

test('USB interface matching includes the configuration observed on the CH340 sensor', () => {
  const personality = plist.parse(source('driverkit/ShroomCH340/Info.plist')).IOKitPersonalities.ShroomCH340Driver;
  // Apple requires all four keys for VID/PID interface matching; this tuple was read from the sensor with ioreg.
  const observedInterface = { idVendor: 6790, idProduct: 29987, bConfigurationValue: 1, bInterfaceNumber: 0 };
  assert.equal(personality.IOProviderClass, 'IOUSBHostInterface');
  for (const [key, value] of Object.entries(observedInterface)) {
    assert.equal(personality[key], value, `USB interface matching needs ${key}=${value}`);
  }
});

test('native access fails closed and lifecycle cleanup invalidates queued reads', () => {
  const userClient = source('driverkit/ShroomCH340/ShroomCH340UserClient.cpp');
  assert.match(userClient, /CopyClientEntitlements/);
  assert.match(userClient, /strcmp\(applicationID->getCStringNoCopy\(\), expectedApplicationID\) == 0/);
  assert.match(userClient, /if \(!allowed\) return kIOReturnNotPermitted/);
  assert.match(userClient, /ClaimClient\(\)/);
  assert.match(userClient, /ReleaseClient\(\)/);
  assert.doesNotMatch(source('driverkit/ShroomCH340/ShroomCH340.entitlements'), /allow-any-userclient|allow-third-party-userclients/);
  const swift = source('modules/shroom-usb/ios/ShroomUsbSerialModule.swift');
  assert.match(swift, /self\.generation == expectedGeneration/);
  assert.match(swift, /OnAppEntersBackground/);
  assert.match(swift, /OnDestroy/);
  assert.match(swift, /"timestamp": Int64\(/);
  assert.match(source('modules/shroom-usb/ios/ShroomDriverClient.mm'), /未找到已运行的 Shroom CH340 驱动/);
});
