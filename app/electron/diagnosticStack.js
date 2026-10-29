/** Keep a script basename or Node module identifier, never a URL, query or local directory. */
function scriptName(location) {
  if (/^node:[A-Za-z0-9_/-]{1,100}$/.test(location)) return location;
  let source = location;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(source)) {
    try { source = new URL(source).pathname; } catch { return '[source]'; }
  }
  const basename = source.split(/[?#]/, 1)[0].split(/[\\/]/).pop();
  return /^[A-Za-z0-9_$.-]{1,128}\.(?:[cm]?js|jsx|tsx?|vue)$/i.test(basename) ? basename : '[source]';
}

/** Compact V8/Firefox stack locations before general redaction removes their source coordinates. */
function compactStackLocations(value) {
  return String(value || '').split(/\r?\n/).map(line => {
    const named = /^(\s*at\s+.+?\s+\()(.+):(\d{1,9}):(\d{1,9})(\)\s*)$/.exec(line);
    if (named) return `${named[1]}${scriptName(named[2])}:${named[3]}:${named[4]}${named[5]}`;
    const bare = /^(\s*at\s+)(.+):(\d{1,9}):(\d{1,9})(\s*)$/.exec(line);
    if (bare) return `${bare[1]}${scriptName(bare[2])}:${bare[3]}:${bare[4]}${bare[5]}`;
    const firefox = /^(.*?)@(.+):(\d{1,9}):(\d{1,9})\s*$/.exec(line);
    if (firefox) return `    at ${firefox[1] || '<anonymous>'} (${scriptName(firefox[2])}:${firefox[3]}:${firefox[4]})`;
    return line;
  }).join('\n');
}

module.exports = { compactStackLocations };
