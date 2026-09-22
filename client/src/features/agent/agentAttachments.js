/** 将浏览器粘贴的附件有界转换为字节载荷，不向主进程传递文件路径。 */
export async function encodePastedFiles(files) {
  if (!files.length || files.length > 6) throw new Error('每次最多粘贴 6 个附件。');
  if (files.some((file) => !file.size || file.size > 8 * 1024 * 1024)) throw new Error('附件须为非空文件且单个不超过 8 MB。');
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}，请重新复制或使用“添加附件”。`));
    reader.onload = () => resolve({ name: file.name, base64: String(reader.result).split(',')[1] });
    reader.readAsDataURL(file);
  })));
}

/** 仅展示主进程生成的本地 PNG 缩略图，拒绝外部地址。 */
export function attachmentThumbnail(attachment) {
  return attachment?.kind === 'image' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(attachment.thumbnail || '') ? attachment.thumbnail : undefined;
}
