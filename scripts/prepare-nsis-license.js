const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'docs', 'EULA.txt');
const targetPath = path.join(rootDir, 'docs', 'EULA.nsis.txt');

const text = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');

fs.writeFileSync(targetPath, `\uFEFF${text}`, 'utf8');
console.log(`Prepared NSIS license: ${path.relative(rootDir, targetPath)}`);
