const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const xcode = require('xcode');
const parser = require('xcode/lib/parser/pbxproj');
const { configureProject } = require('../integrate-ios.cjs');

/** Read source within the mobile project for static native-boundary assertions. */
function source(relative) { return fs.readFileSync(path.join(__dirname, '../../', relative), 'utf8'); }

/** Create an isolated iOS app project without existing target-dependency sections. */
function fixture() {
  const project = xcode.project('/tmp/Shroom.xcodeproj/project.pbxproj');
  project.hash = parser.parse(`// !$*UTF8*$!
  { archiveVersion = 1; classes = {}; objectVersion = 56; objects = {
    /* Begin PBXProject section */
    111111111111111111111111 /* Project */ = { isa = PBXProject; mainGroup = 222222222222222222222222; targets = (333333333333333333333333 /* Shroom */,); };
    /* End PBXProject section */
    /* Begin PBXGroup section */
    222222222222222222222222 = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
    /* End PBXGroup section */
    /* Begin PBXNativeTarget section */
    333333333333333333333333 /* Shroom */ = { isa = PBXNativeTarget; name = Shroom; productName = Shroom; productType = "com.apple.product-type.application"; productReference = 444444444444444444444444; buildConfigurationList = 555555555555555555555555; buildPhases = (); buildRules = (); dependencies = (); };
    /* End PBXNativeTarget section */
    /* Begin PBXFileReference section */
    444444444444444444444444 = { isa = PBXFileReference; path = Shroom.app; explicitFileType = wrapper.application; sourceTree = BUILT_PRODUCTS_DIR; };
    /* End PBXFileReference section */
    /* Begin XCConfigurationList section */
    555555555555555555555555 = { isa = XCConfigurationList; buildConfigurations = (666666666666666666666666 /* Debug */,); defaultConfigurationName = Debug; defaultConfigurationIsVisible = 0; };
    /* End XCConfigurationList section */
    /* Begin XCBuildConfiguration section */
    666666666666666666666666 = { isa = XCBuildConfiguration; name = Debug; buildSettings = {}; };
    /* End XCBuildConfiguration section */
  }; rootObject = 111111111111111111111111; }\n`);
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
  assert.equal(objects.PBXNativeTarget['333333333333333333333333'].dependencies.length, 1);
  const embed = Object.values(objects.PBXCopyFilesBuildPhase).find(value => value?.dstPath === '"$(SYSTEM_EXTENSIONS_FOLDER_PATH)"');
  assert.equal(embed.dstSubfolderSpec, 16);
  assert.equal(embed.files.length, 1);
  assert.equal(configureProject(project, options), null);
  const changed = configureProject(project, { ...options, team: 'FGHIJ67890' });
  const changedObjects = parser.parse(changed).project.objects;
  for (const item of configs) assert.equal(changedObjects.XCBuildConfiguration[item.value].buildSettings.DEVELOPMENT_TEAM, 'FGHIJ67890');
  assert.equal(Object.values(changedObjects.PBXNativeTarget).filter(value => value?.isa === 'PBXNativeTarget').length, 2);
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
