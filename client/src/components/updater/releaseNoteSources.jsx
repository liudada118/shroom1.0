/**
 * 三种语言的版本说明原文，Vite 构建时编译进前端，运行时不读磁盘。
 * ⚠️ 本文件必须是 `.jsx`：混淆插件只处理 `.js`/`.ts`，且排在 Vite 解析 `import.meta.glob` 之前，改回 `.js` 生产构建直接失败（单元测试不会报）。
 * ⚠️ `import.meta.glob` 的路径和选项都必须是字面量：新增语言要整条照抄，不能用变量拼。
 * ⚠️ 中文留在 `release-notes/windows/` 根目录不能搬：打包脚本按这个路径把它注入 `latest.yml`。
 */
export const RELEASE_NOTE_MODULES = {
  zh: import.meta.glob("../../../../release-notes/windows/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  en: import.meta.glob("../../../../release-notes/windows/en/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ja: import.meta.glob("../../../../release-notes/windows/ja/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};
