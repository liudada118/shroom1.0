const assert = require('assert');
const fs = require('fs');
const path = require('path');

const hostRoot = path.resolve(__dirname, '../../extension-host');

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listJavaScriptFiles(entryPath) : entryPath.endsWith('.js') ? [entryPath] : [];
  });
}

function relativeImports(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return [...source.matchAll(/require\(['"](\.{1,2}\/[^'"]+)['"]\)/g)].map((match) => match[1]);
}

function assertNoImports(directoryName, forbiddenSegments) {
  const directory = path.join(hostRoot, directoryName);
  for (const filePath of listJavaScriptFiles(directory)) {
    for (const request of relativeImports(filePath)) {
      const resolved = path.normalize(path.resolve(path.dirname(filePath), request));
      for (const segment of forbiddenSegments) {
        const forbiddenRoot = path.normalize(path.join(hostRoot, segment));
        assert(
          resolved !== forbiddenRoot && !resolved.startsWith(`${forbiddenRoot}${path.sep}`),
          `${path.relative(hostRoot, filePath)} must not depend on ${segment}: ${request}`,
        );
      }
    }
  }
}

assertNoImports('manifest', ['runtime', 'workspace']);
assertNoImports('workspace', ['runtime']);

for (const filePath of [
  path.join(hostRoot, 'appRuntimeFactory.js'),
  path.join(hostRoot, 'runtime/displaySystemRuntimeFactory.js'),
]) {
  assert(
    !relativeImports(filePath).some((request) => /(?:^|\/)index$/.test(request)),
    `${path.relative(hostRoot, filePath)} must import internal modules directly instead of the public index`,
  );
}

console.log('extension-host dependency boundaries tests passed');
