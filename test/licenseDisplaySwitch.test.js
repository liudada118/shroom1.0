const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('license replacement uses the same complete display-system switch lifecycle', () => {
  assert.match(serverSource, /function switchActiveDisplaySystem\(receiveFile, reason = 'file switch'\)/);
  assert.match(serverSource, /switchActiveDisplaySystem\(nextFile, 'license replacement'\)/);
  assert.match(serverSource, /switchActiveDisplaySystem\(JSON\.parse\(message\)\.file, 'file switch'\)/);
});

test('license category scopes are expanded before frontend filtering and default selection', () => {
  assert.match(serverSource, /const \{ expandLicenseFile \} = require\('\.\/licenseScopes'\)/);
  assert.match(serverSource, /const expanded = expandLicenseFile\(licenseFile\)/);
  assert.match(serverSource, /return expanded\.isAllTypes \? 'all' : expanded\.sensorTypes/);
  assert.match(serverSource, /return expanded\.sensorTypes\[0\] \|\| fallback/);
  assert.match(serverSource, /file: getClientLicenseFile\(licenseFile, file\)/);
});

test('the shared lifecycle resets ports, databases and playback state', () => {
  const start = serverSource.indexOf('function switchActiveDisplaySystem');
  const end = serverSource.indexOf('\nfunction setJqbedAlgorithmStatus', start);
  const lifecycle = serverSource.slice(start, end);

  [
    'sitClose = true',
    'backClose = true',
    'headClose = true',
    'sensorClose = true',
    'closeMinzhenSensorPort(reason)',
    'baudRate = getSensorBaudRate(file)',
    'const nextDb = initDb(file)',
    'stopPlaybackTimer()',
    'localData = []',
    'localDataBack = []',
    'localDataHead = []',
  ].forEach((contract) => assert.ok(lifecycle.includes(contract), `missing ${contract}`));
});
