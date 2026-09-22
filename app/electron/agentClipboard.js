const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { agentError } = require('../../backend/agent-runtime/errors');

/** 只在用户粘贴时读取系统文件列表，不把普通剪贴板文字解释成路径。 */
async function readClipboardFiles(clipboard, platform = process.platform, execute = promisify(execFile)) {
  const formats = clipboard.availableFormats();
  if (platform !== 'win32' || !formats.some((format) => /^(FileNameW?|CF_HDROP|Shell IDList Array)$/i.test(format))) return [];
  try {
    const script = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); Add-Type -AssemblyName System.Windows.Forms; ConvertTo-Json -Compress -InputObject @([System.Windows.Forms.Clipboard]::GetFileDropList())';
    const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], { windowsHide: true, timeout: 5000, maxBuffer: 65536, encoding: 'utf8' });
    const paths = JSON.parse(stdout.trim().replace(/^\uFEFF/, ''));
    if (!Array.isArray(paths) || paths.some((item) => typeof item !== 'string' || !item)) throw new Error('invalid file list');
    return paths;
  } catch { throw agentError('AGENT_CLIPBOARD_FAILED', '无法读取剪贴板文件，请重新复制或使用“添加附件”。'); }
}

module.exports = { readClipboardFiles };
