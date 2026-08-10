const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const packageHooks = require('./scripts/package-hooks');

module.exports = {
  packagerConfig: {
    icon: './assets/icons/logo',
    asar: true,
    // ⚠️ 注意：这个文件当前**不生效**。forge 的配置解析是
    // `packageJSON.config.forge` 优先（`@electron-forge/core/dist/util/forge-config.js`
    // 第 136 行：是对象就直接用，不再去找 forge.config.js），而根 package.json 里
    // `config.forge` 就是个对象。真正生效的 packagerConfig 在那边，改打包行为要改那边。
    // 这里跟着改是为了两份不打架 —— 万一哪天 package.json 里那段被删掉，这份接上后行为一致。
    //
    // derefSymlinks 必须显式打开：根 package.json 里 `"@shroom/backend": "file:sdk/backend"`
    // 让 npm 在 node_modules 下建了一条软链。packager 18.3.6 把 `derefSymlinks` 原样传给
    // fs-extra 的 `dereference`（`@electron/packager/dist/platform.js` 第 133 行），
    // 没设置就是 undefined（等于假），于是它会试着**重建**软链 —— Windows 上非管理员
    // 建软链是 EPERM，整个打包直接失败。文档写的默认值是 true，代码里没兜这个默认。
    derefSymlinks: true,
    extraResource: [
      './python'
    ],
    ignore: [
      '^/venv($|/)',        // 排除 venv 文件夹
      '^/python($|/)',      // 如果你环境叫 python
      '^/__pycache__($|/)',
      '\\.pyc$',
      // 两个 SDK 的文档站各自带一份 node_modules（react + vite），一行都不该进安装包。
      // 生效的那份规则在 package.json 的 config.forge.packagerConfig.ignore 里，
      // 这两条是照它抄的 —— 见文件顶部那段说明。
      '^/sdk/frontend/(example|docs)($|/)',
      '^/sdk/backend/docs($|/)',
      '(^|[/\\\\])config\\.txt$'
    ],
    afterComplete: [
      packageHooks.electronForgeAfterComplete
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // An URL to an ICO file to use as the application icon (displayed in Control Panel > Programs and Features).
        iconUrl: 'https://url/to/icon.ico',
        // The ICO file to use as the icon for the generated Setup.exe
        setupIcon: './assets/icons/logo.ico'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {
        options: {
          icon: './assets/icons/logo.icns'
        }
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './assets/icons/logo.ico'
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
      icon: './assets/icons/logo.ico'
      },
    },

  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
