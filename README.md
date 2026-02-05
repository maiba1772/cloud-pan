# 云端存储系统
# 官网：https://cloud-pan.netlify.app/

## 项目概述

本系统是一个功能完善的云端存储解决方案，支持多种存储后端，提供文件上传、下载、管理、分享等核心功能。系统采用前后端分离架构，界面友好，操作便捷，适用于个人文件管理、团队协作等多种场景。

## 核心功能

### 文件管理
- **文件上传**：支持拖拽上传和点击选择，单文件最大支持 10GB
- **文件下载**：一键下载，支持断点续传
- **文件预览**：内置图片、视频、音频预览功能
- **目录管理**：支持创建多级目录结构
- **回收站机制**：软删除保护，支持恢复和永久删除

### 文件分享
- **外链分享**：生成可访问的分享链接
- **权限控制**：支持设置访问密码、下载权限、预览权限、上传权限、删除权限
- **目录隔离**：可指定分享特定目录
- **分享管理**：查看、编辑、删除已创建的分享链接

### 用户认证
- **登录系统**：基于 JWT 的安全认证机制
- **密码管理**：支持修改密码，首次登录强制修改默认密码
- **会话管理**：支持"记住我"功能，自动登录状态保持

### 存储后端
- **本地存储**：文件保存在服务器本地目录
- **MySQL 存储**：使用 MySQL 数据库存储文件元数据
- **FTP 存储**：支持上传文件到远程 FTP 服务器
- **分片上传**：大文件自动分片，支持断点续传和失败重试

## 系统要求

- PHP 7.4 或更高版本
- Web 服务器（Apache、Nginx 等）
- 现代浏览器（Chrome、Firefox、Edge、Safari 等）
- 数据库（可选）：MySQL 5.7 或更高版本

## 安装步骤

### 1. 环境准备

确保服务器已安装 PHP 并启用以下扩展：
- fileinfo
- mbstring
- mysqli（如使用 MySQL 存储）
- ftp（如使用 FTP 存储）

### 2. 部署文件

将项目文件部署到 Web 服务器目录，确保以下目录具有写入权限：
```
data/          # 数据存储目录
data/cc/       # 文件存储目录
data/chunks/   # 分片上传临时目录
```

### 3. 运行安装向导

1. 访问 `http://your-domain/install.html`
2. 选择数据存储方式：
   - 本地存储（JSON 文件）
   - MySQL 数据库
3. 选择文件存储方式：
   - 本地文件系统
   - FTP 服务器
4. 填写相应的配置信息
5. 完成安装，系统将自动创建必要的配置文件

### 4. 登录系统

1. 安装完成后自动跳转到登录页面
2. 使用默认账号登录：
   - 用户名：admin
   - 密码：admin
3. 首次登录后系统将强制要求修改密码

## 使用指南

### 文件上传

1. 进入主界面，点击"上传文件"或拖拽文件到上传区域
2. 小文件（小于 10MB）直接上传
3. 大文件（大于 10MB）自动分片上传，显示实时进度
4. 上传完成后文件自动出现在文件列表中

### 文件管理

- **查看文件**：点击文件卡片查看详情和预览
- **下载文件**：在文件详情页点击下载按钮
- **删除文件**：点击删除按钮，文件移至回收站
- **创建目录**：点击"新建目录"按钮，输入目录名称
- **移动文件**：选择目标目录，将文件移动至指定位置

### 创建分享链接

1. 点击"创建外链"按钮
2. 填写分享名称（可选）
3. 选择访问根目录（可选，默认为所有文件）
4. 设置访问密码（可选）
5. 配置权限：下载、预览、上传、删除
6. 点击创建，复制生成的分享链接

### 访问分享链接

1. 打开分享链接，如有密码需先输入密码
2. 根据权限设置，可进行文件浏览、下载、上传等操作
3. 上传文件时可选择保存到当前目录或子目录

## 配置说明

### PHP 配置（.user.ini）

```ini
upload_max_filesize = 10G
post_max_size = 10G
max_file_uploads = 50
max_execution_time = 3600
max_input_time = 3600
memory_limit = 512M
```

### 本地存储配置

文件默认存储在 `data/cc/` 目录，可在安装时或安装后修改存储路径。

### MySQL 存储配置

安装时填写以下信息：
- 数据库主机地址
- 数据库端口（默认 3306）
- 数据库名称
- 数据库用户名
- 数据库密码

系统会自动创建所需的文件信息表。

### FTP 存储配置

安装时填写以下信息：
- FTP 服务器地址
- FTP 端口（默认 21）
- FTP 用户名
- FTP 密码
- 远程存储路径
- 是否启用 SSL/TLS 加密

## API 接口文档

### 文件操作接口

#### 上传文件
- **URL**: `POST /api/api.php?action=upload`
- **参数**: `file` (FormData 文件对象)
- **响应**: `{ success: true, file: { id, name, size, url, ... } }`

#### 分片上传
- **URL**: `POST /api/api.php?action=upload_chunk`
- **参数**: `chunk`, `file_id`, `chunk_index`, `total_chunks`, `file_name`, `file_size`
- **响应**: `{ success: true, chunk_index: number }`

#### 合并分片
- **URL**: `POST /api/api.php?action=merge_chunks`
- **参数**: `{ file_id, file_name, file_size, total_chunks }`
- **响应**: `{ success: true, file: { ... } }`

#### 获取文件列表
- **URL**: `GET /api/api.php?action=list`
- **响应**: `{ success: true, files: [...], total_size: number }`

#### 删除文件
- **URL**: `POST /api/api.php?action=delete`
- **参数**: `{ id: fileId }`
- **响应**: `{ success: true }`

### 分享接口

#### 创建分享
- **URL**: `POST /api/share.php?action=create_share`
- **参数**: `{ name, password, root_directory, allow_download, allow_preview, allow_upload, allow_delete }`
- **响应**: `{ success: true, share: { token, url, ... } }`

#### 获取分享信息
- **URL**: `GET /api/share.php?action=get_share&token={token}`
- **响应**: `{ success: true, share: { ... } }`

#### 验证分享密码
- **URL**: `POST /api/share.php?action=verify_password`
- **参数**: `{ token, password }`
- **响应**: `{ success: true, share: { ... } }`

#### 添加文件到分享
- **URL**: `POST /api/share.php?action=add_file&token={token}`
- **参数**: `{ file_id, directory }`
- **响应**: `{ success: true }`

### 用户认证接口

#### 用户登录
- **URL**: `POST /api/auth.php?action=login`
- **参数**: `{ username, password }`
- **响应**: `{ success: true, token: string, user: { ... } }`

#### 修改密码
- **URL**: `POST /api/auth.php?action=change_password`
- **Header**: `Authorization: Bearer {token}`
- **参数**: `{ current_password, new_password }`
- **响应**: `{ success: true }`

#### 验证 Token
- **URL**: `GET /api/auth.php?action=verify`
- **Header**: `Authorization: Bearer {token}`
- **响应**: `{ success: true, user: { ... } }`

## 项目结构

```
cloud-drive/
├── index.html              # 主页面
├── login.html              # 登录页面
├── install.html            # 安装配置页面
├── share.html              # 分享访问页面
├── css/
│   ├── style.css          # 主页面样式
│   ├── login.css          # 登录页面样式
│   ├── install.css        # 安装页面样式
│   └── share.css          # 分享页面样式
├── js/
│   ├── app.js             # 主页面逻辑
│   ├── login.js           # 登录页面逻辑
│   ├── install.js         # 安装页面逻辑
│   └── share.js           # 分享页面逻辑
├── api/
│   ├── api.php            # 主 API 接口
│   ├── auth.php           # 认证接口
│   └── share.php          # 分享接口
├── data/                   # 数据目录（需可写）
│   ├── files.json         # 本地存储数据
│   ├── config.json        # 系统配置
│   ├── users.json         # 用户数据
│   ├── chunks/            # 分片上传临时目录
│   └── cc/                # 文件存储目录
├── .user.ini              # PHP 配置
└── README.md              # 项目说明文档
```

## 常见问题

### Q: 上传大文件时提示"Failed to save chunk"
A: 请检查以下配置：
1. 确保 `data/chunks/` 目录存在且具有写入权限
2. 检查 PHP 配置中的 `upload_max_filesize` 和 `post_max_size`
3. 查看 PHP 错误日志获取详细信息

### Q: 如何修改默认上传大小限制？
A: 编辑 `.user.ini` 文件，修改以下配置：
```ini
upload_max_filesize = 10G
post_max_size = 10G
```

### Q: 忘记管理员密码怎么办？
A: 删除 `data/users.json` 文件，系统会在下次访问时重新创建默认账号（admin/admin）。

### Q: 如何备份数据？
A: 定期备份以下目录和文件：
- `data/files.json` - 文件元数据
- `data/users.json` - 用户数据
- `data/config.json` - 系统配置
- `data/cc/` - 存储的文件

### Q: 分享链接可以设置有效期吗？
A: 当前版本暂不支持自动过期功能，需要手动删除分享链接。

### Q: 支持多用户吗？
A: 当前版本支持单管理员账号，后续版本将支持多用户和权限管理。

## 技术特性

### 前端技术
- 原生 JavaScript（ES6+）
- 模块化架构
- 异步请求处理（Fetch API）
- 响应式设计

### 后端技术
- PHP 7.4+
- RESTful API 设计
- JWT 认证
- 文件分片上传处理

### 安全特性
- 密码哈希存储（bcrypt）
- JWT Token 认证
- 文件类型检查
- 上传大小限制
- SQL 注入防护

## 更新日志

### v1.0.0
- 初始版本发布
- 支持本地存储和 MySQL 存储
- 支持 FTP 远程存储
- 文件上传、下载、预览功能
- 分享链接功能
- 用户认证系统
- 大文件分片上传

## 开源协议

本项目采用 MIT 开源协议。

## 技术支持

如有问题或建议，欢迎提交 Issue 或联系开发团队。
联系方式：openindex@163.com
