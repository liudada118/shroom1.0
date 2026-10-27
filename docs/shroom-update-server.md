# Shroom 更新服务器与上传

> **2026-10-19 当前线上路由：MinIO。** `/shroom1/` 已代理到 `http://127.0.0.1:9000/data/shroom1/`，即桶 `data`、对象前缀 `shroom1/`。下文 9 月的 `/data/shroom1` 静态目录与 SSH 上传步骤保留作迁移记录，不能当作当前 MinIO 的发布方法；不要把文件写入 MinIO 的磁盘存储目录。

## Windows 1.1.39已发布MinIO（2026-10-26）

服务器恢复响应后，已发布最终修复版到MinIO桶 `data`、对象前缀 `shroom1/`，公网 `latest.yml` 已从回滚后的1.1.36更新为1.1.39，SHA-256 `0ccf266f5cfba2f86362fbaff089e1c6c534c98309003bbc84ea8065b6148867`。EXE、blockmap和版本说明先上传并逐对象通过MinIO接口回读SHA-256，最后才切换清单；未改动Mac清单、MinIO策略或Nginx配置。

公网轻量五项通过：latest、blockmap和说明的大小/哈希/本地字节一致，EXE HEAD200/354815966字节，Range206/前1024字节MZ头与Content-Range正确。整包哈希已由MinIO回读验证，没有重复做完整公网下载。回滚清单 `/data/shroom-update-backups/latest-before-1.1.39-20261026.yml` 和发布摘要 `windows-1.1.39-20261026-publish.json` 已持久备份并复制到本地最终releaseRoot。

本轮恢复后观测 `/tmp` 是838MB的tmpfs，不能作为本机约1.6GB内存服务器的大包暂存位置。本次改用 `/data/shroom-update-staging/` 的磁盘目录，SCP限速8Mbps；MinIO复制单任务、关闭multipart、限速4MiB/s，发布进程使用较低CPU和空闲I/O优先级，避免已存在对象重复整包读取。暂存文件不作为静态更新源，正式发布仍全部通过MinIO接口。已知这是内存压力风险；未取得上次故障的OOM内核证据，不能据此确认失联根因。

截图“当前版本1.1.36已是最新”另有旧客户端文案问题：`autoUpdater` 的无更新事件传出远端info.version，`UpdateNotifier`却将其称为当前版本；底部版本按钮通过app.getVersion读取实际宿主版本。此次现场进程为C:/Shroom/Shroom.exe 1.1.37，之前恢复的C:/Program Files/Shroom/Shroom.exe仍为1.1.39；不能把通知文案误作本机降级。此条只记录定位结果，未在本次已构建安装包中修改通知逻辑。

### 此前本机恢复与服务器失联记录

1.1.38在本机D盘剩余空间为0时发生升级复制中断，旧安装脚本同时存在强制D盘路径。已将Windows推荐清单撤回至先前验证的1.1.36，保留全部版本对象；撤回前备份为 `/data/shroom-update-backups/latest-before-withdrawing-1.1.38-20261026.yml`。撤回后公网GET已确认1.1.36，清单SHA-256为 `22f1ed410e1a1e61613983fde47d452f33e64c7d36889b4196a85bfb2868646e`；这是服务器失联前最后确认状态。

修复版1.1.39增加卸载前磁盘检查、移除强制D盘路径，并将Windows CSV及报告导出改用userData，避免Program Files普通权限启动失败。版本说明见 [1.1.39](../release-notes/windows/1.1.39.md)。从系统临时快照重新构建，前端buildId1793017864101；Full12项、最终产物16项通过。实际安装到 `C:/Program Files/Shroom` 的2806文件哈希均与最终payload一致，普通用户启动的主窗口、前端HTTP200和后台19245/19999端口已实测；尚未连接真实串口设备验收。

最终安装包为354815966字节，SHA-256 `72cc8928e9dc6c74e26e429ae43c46b51a419946522c6fdba0d57bf20b29804a`；尚未发布到MinIO，不能将本地产物校验视为公网发布完成。最终快照及报告在系统TEMP的 `shroom-release-1.1.39-2y6SVj`，本地交付副本保存在用户下载目录 `Shroom-1.1.39-repair`。

发布被目标服务器连接故障阻断：两轮有界检查中HTTPS连接超时、SSH banner阶段超时；DNS正确，绕过代理并固定IP仍失败，对照公网HTTPS正常。只能确认目标服务器或到它的链路不可达，不能据此判断全网宕机。未执行1.1.39对象推广或latest切换；本次停滞SCP及其SSH子进程已精确停止，远端临时目录完整性未知。恢复连接后应先检查staging，再按对象哈希校验、版本文件在前、latest在后的流程发布。

## Windows 1.1.38历史发布（已撤回推荐，2026-10-26）

已从当前工作区的系统临时快照重新构建Windows x64 NSIS安装器，根应用版本由1.1.37递增为1.1.38；前端标识 `buildId=1793013459922`、`appVersion=1.1.38`。本轮小床视角、纯点图与应用工具横幅说明见 [版本说明](../release-notes/windows/1.1.38.md)，同一说明已注入更新清单并单独上传。

MinIO `data/shroom1/` 已发布 `Shroom Setup 1.1.38.exe`（354815139字节）、对应 `.blockmap`、`Shroom-1.1.38-release-notes.md`，逐对象回读SHA-256一致后最后更新 `latest.yml`。线上Windows清单从1.1.36升级至1.1.38；原清单备份为 `/data/shroom-update-backups/latest-before-1.1.38-20261026.yml`，发布摘要为同目录 `windows-1.1.38-20261026-publish.json`。

安装器SHA-256为 `e9b30792f243e7782e412f7e6439ff2a033f73cbc52bf7487fa634299b91ca4f`，清单SHA-256为 `ec04a12abb4faf2f8fc49d153d2797aac3d3869b316553c521b2f82986d9bbde`。Full12项、生产页面浏览器与最终NSIS13项验证通过；最终安装器解出的2806个文件与构建目录逐一一致，真实包内Electron原生模块、空数据库及Python health均通过。构建和解压检查不代表已经在客户电脑安装或连接真机验收。

发布后公网验证：canonical `latest.yml` 返回1.1.38，清单、独立说明及blockmap的大小与SHA-256均匹配本地；EXE HEAD为200/354815139字节，范围请求为206、`Content-Range: bytes 0-1023/354815139`，Windows MZ头正确。完整对象SHA-256已通过MinIO回读；额外的完整HTTPS下载因公网回环吞吐慢主动停止，未完成公网整包SHA-256/SHA-512终检，不将其列为通过项。服务器临时上传目录已清理，旧清单和发布摘要保留于上述备份目录。

## 当前 MinIO 发布边界（2026-10-19）

- Windows 更新入口为 `data/shroom1/latest.yml`；Mac 为 `data/shroom1/latest-mac.yml`。对象名大小写及前缀必须与公开 URL 一致。
- macOS 自动更新必须上传同次正式构建的 `Shroom-<版本>-arm64-mac.zip` 和 `latest-mac.yml`。DMG 供手动安装，不能代替 ZIP；缺少差分 blockmap 可回退整包下载，不能用 DMG 伪造自动更新清单。
- `npm run build-mac-release` 在 Mac 上按既有签名、公证流程生成正式 ZIP、DMG 和清单；详见 [Mac 发布流程](mac_release_flow.md)。当前 `npm run upload` **仅处理 Windows 并写静态 SSH 目录**，不会上传 Mac，也不是 MinIO 上传命令。
- 使用已有 MinIO 控制台或已配置的 `mc` 别名上传。先上传清单引用的 ZIP，再上传清单；版本、ZIP SHA-512 与大小必须匹配，不覆盖同名不同内容的正式安装包。仅让已有更新前缀具备预期读取权限，不为排障开放整个桶。
- 发布后通过公网读取 `https://shroom.jq-industries.com/shroom1/latest-mac.yml`，确认返回 YAML；再核对其 ZIP URL 的状态、大小、SHA-512 与范围请求。最终从兼容的旧版 M 系列 Mac 验收检查、下载、签名校验、收尾及重启安装。元数据上传成功不等同于客户升级成功。
- `/data/html` 与 `/api/frontend/latest` 是**网页签名更新**，不提供 `latest-mac.yml`。网页更新与安装包更新分别发布，后端能力变更仍需安装包。

本轮只读取证：公网 `latest-mac.yml` 返回 MinIO `NoSuchKey`/404；同前缀有 `Shroom-1.1.37-arm64.dmg`，未见 ZIP/清单。Windows 清单返回 1.1.36，网页清单返回发布号 `1792395247824`。这说明 Mac 发布文件缺失，不是密钥或 token 认证错误；取证不代表已经补传 Mac 版本。

客户端 `app/update/updaterErrors.js` 将缺清单、文件不完整、网络、权限、哈希及签名异常转成有限错误码，主进程和更新引擎日志不复制原始 URL、响应头或堆栈。`UpdateNotifier` 兼容旧宿主的长错误，只显示本地化短提示并在详情保留；入口明确为“安装包更新”，不会悄悄改走网页更新。源代码修复需另行打包/发布后才到客户设备。

目标更新地址：`https://shroom.jq-industries.com/shroom1`。
SFTP/SSH：`root@shroom.jq-industries.com`，端口 `20202`。

当前仓库的更新模块入口是 `app/update/autoUpdater.js`，正式构建的更新地址来自
`package.json > build.publish`；开发调试使用 `dev-app-update.yml`。
上传校验测试位于 `backend/tests/packaging/upload-release.test.js`，由后端测试清单执行。
以下服务器与客户端操作记录来自迁移时的验收；合并这些配置本身不会打包或发布新版本。

2026-09-15 已在服务器 `/etc/nginx/conf.d/shroom.conf` 配置 `/shroom1/` 到 `/data/shroom1/` 的静态映射并通过 `nginx -t` 后重载。
原配置备份：`/etc/nginx/backups/shroom.conf.before-downloads-20260915T094339Z`。
验证：latest.yml、EXE 与 blockmap 返回 200，EXE 范围请求返回 206；不存在文件返回 404，隐藏路径返回 403，域名根路径继续提供密钥管理网站。
初次上传的 1.1.35 安装包仍内嵌旧更新地址；迁移版本使用 1.1.36，避免同版本覆盖已发布安装包。
1.1.36 已完整打包并通过 `npm run upload` 发布；直接从 EXE 读取的 `resources/app-update.yml` 已确认使用新 HTTPS 地址。
公网 latest.yml 已返回 1.1.36，EXE 范围请求返回 206，blockmap 返回 200，服务器三份文件 SHA-256 全部校验通过。
发布前的元数据备份位于 `/data/shroom-update-backups/latest-before-1.1.36-20260915.yml`。

## 服务器一次性准备

仅托管更新文件不需要 Node.js、Python 或数据库。已有 SSH/SFTP 用于上传，
已有 HTTPS Nginx 可以复用。不要覆盖现有密钥管理系统的完整站点配置。

先登录服务器检查：

```powershell
ssh -i "D:\server\server.pem" -p 20202 root@shroom.jq-industries.com
```

以下在 Linux 服务器执行：

```sh
command -v nginx
nginx -v
```

如果宿主机上找不到命令，先确认是否由 Docker 或面板管理 Nginx。
不要直接安装第二套并抢占 80/443 端口。

以下以 `/data/shroom1` 为示例存放目录（网址路径不等于服务器磁盘目录）：

```sh
mkdir -p /data/shroom1
chmod 755 /data/shroom1
```

将以下片段合并到现有 `server_name shroom.jq-industries.com` 的 HTTPS `server` 块内，
保留原证书、其他站点路由和反向代理配置：

```nginx
location = /shroom1 {
    return 301 /shroom1/;
}

location ^~ /shroom1/ {
    root /data;
    try_files $uri =404;
    autoindex off;
    default_type application/octet-stream;
    add_header Cache-Control "no-cache" always;
    gzip off;
    sendfile on;

    # 上传暂存目录和发布锁不得通过网址读取。
    location ~ /\. {
        deny all;
    }
}
```

这会将 `/shroom1/latest.yml` 映射到 `/data/shroom1/latest.yml`；不存在的文件返回 404。
确认该路径的 404 未被站点自定义 `error_page` 重写成首页。
如果 Nginx 在容器中，必须将宿主机 `/data/shroom1` 挂载到容器同路径，且确保 worker 有读取权限。
如果 Nginx 在另一台机器，则需要为 `/shroom1/` 配置指向存储服务器的静态服务代理。

备份并编辑实际生效的站点配置后，在对应主机或容器中测试再重载：

```sh
nginx -t && nginx -s reload
```

路径映射参考：[Nginx 静态文件服务](https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/)。

## 本地打包后上传

本机需要 Node.js（项目开发环境已有）、OpenSSH 的 `ssh` 和 `scp`。
服务器需要支持 SSH shell、SFTP，以及常见 Linux 工具 `sha256sum`、`cmp`、`mv`。

默认上传目录为已配置的 `/data/shroom1`。本机使用 `D:\server\server.pem` 进行密钥认证，
可在 Windows PowerShell 中设置一次用户环境变量（已在本机设置）：

```powershell
[Environment]::SetEnvironmentVariable('SHROOM_UPLOAD_DIR', '/data/shroom1', 'User')
[Environment]::SetEnvironmentVariable('SHROOM_SSH_KEY', 'D:\server\server.pem', 'User')
$env:SHROOM_UPLOAD_DIR = '/data/shroom1'
$env:SHROOM_SSH_KEY = 'D:\server\server.pem'
```

后续每次在项目目录执行：

```powershell
npm run build
npm run upload
```

每次发布递增 `package.json` 的版本号，并准备对应 `release-notes/windows/<版本>.md`。
更新地址变更后必须重新打包。脚本会检查 `dist/win-unpacked/resources/app-update.yml`，
拒绝发布仍指向旧地址的现有构建，不会直接修改已生成的安装包。

只验证本地产物，不连接服务器：

```powershell
npm run upload -- --dry-run
```

上传使用 `SHROOM_SSH_KEY` 指定的私钥，SSH/scp 都传入 `-i` 和 `IdentitiesOnly=yes`。
只保存密钥路径，不读取或打印私钥内容；保留主机指纹验证。
不设置该变量时使用 OpenSSH 默认认证配置。此服务器不提供密码登录，需使用有效密钥。

`scripts/upload-release.js` 仅支持当前单个 Windows NSIS 安装包。
它上传 `latest.yml` 指向的 `.exe`、同名 `.blockmap` 与 `latest.yml`，不上传源码、
`win-unpacked` 或构建调试文件。上传前核对版本、内嵌更新地址和安装包 SHA-512；
上传到独立临时目录后由服务器校验三个文件的 SHA-256。
发布锁串行化最终发布；同名历史安装包内容不一致时拒绝覆盖。
先移动安装包和 blockmap，最后原子替换 `latest.yml`。
如上传失败，脚本会报告暂存目录供检查；如果进程意外中断留下 `.publish-lock`，
应先确认没有其他发布任务运行再人工清理。不要同时发布不同版本，以免较旧版本最后覆盖更新入口。

上传结束后检查：

```powershell
curl.exe -f https://shroom.jq-industries.com/shroom1/latest.yml
```

必须返回含 `version`、`files`、`sha512` 的 YAML，而不是 HTML。
再用浏览器下载 YAML 中对应的 `.exe`，并从较低版本客户端完成一次检查更新与安装验证。
脚本成功代表 SSH 文件发布完成，不代表 Nginx 路由和客户端安装已验证。

## 已安装客户端迁移

旧域名已停用，不再通过旧服务器提供过渡更新。旧安装包不会因本仓库改地址而自动切换。
其他电脑需要手动安装新服务器提供的 1.1.36 或更高版本一次，后续再使用新源自动更新。

本机已备份并修改 `D:\Shroom\resources\app-update.yml`，将 `url` 切换为
`https://shroom.jq-industries.com/shroom1`，保留 `updaterCacheDirName`。
原文件备份为 `app-update.yml.before-server-migration-20260915-174647`。
必须完全退出软件后重新打开才能清除进程中缓存的旧更新配置，然后检查新版本。
本机运行时修复只影响本机，不会修改其他电脑的软件或旧 EXE。

Mac 共用新的更新基础地址，但本上传命令只发布 Windows 文件；
Mac 的 `latest-mac.yml`、ZIP、DMG 需要按现有 Mac 发布流程单独迁移。
