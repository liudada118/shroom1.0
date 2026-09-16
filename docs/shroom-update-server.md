# Shroom 更新服务器与上传

目标更新地址：`https://shroom.jq-industries.com/shroom1`。
SFTP/SSH：`root@shroom.jq-industries.com`，端口 `20202`。

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
