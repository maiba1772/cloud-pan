const API_URL = 'api/share.php';

class SharePage {
    constructor() {
        this.token = this.getTokenFromUrl();
        this.share = null;
        this.currentDirectory = '';
        this.files = [];
        this.directories = [];
        this.init();
    }

    getTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('token') || '';
    }

    init() {
        if (!this.token) {
            this.showErrorScreen();
            return;
        }

        this.bindEvents();
        this.loadShareInfo();
    }

    bindEvents() {
        document.getElementById('verifyPasswordBtn').addEventListener('click', () => {
            this.verifyPassword();
        });

        document.getElementById('passwordInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.verifyPassword();
            }
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('fileModal').addEventListener('click', (e) => {
            if (e.target.id === 'fileModal') {
                this.closeModal();
            }
        });

        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput.click());
            selectFileBtn.addEventListener('click', () => fileInput.click());

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                this.handleUploadFiles(files);
            });

            fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                this.handleUploadFiles(files);
            });
        }

        document.getElementById('closeUploadModal').addEventListener('click', () => {
            this.closeUploadModal();
        });

        const openUploadModalBtn = document.getElementById('openUploadModalBtn');
        if (openUploadModalBtn) {
            openUploadModalBtn.addEventListener('click', () => {
                this.openUploadModal();
            });
        }
    }

    async loadShareInfo() {
        try {
            const response = await fetch(`${API_URL}?action=get_share&token=${this.token}`);
            const data = await response.json();

            if (data.success) {
                this.share = data.share;

                if (this.share.has_password) {
                    this.showPasswordScreen();
                } else {
                    this.showShareScreen();
                    this.loadFiles();
                }
            } else {
                this.showErrorScreen();
            }
        } catch (error) {
            console.error('加载分享信息失败:', error);
            this.showErrorScreen();
        }
    }

    async verifyPassword() {
        const password = document.getElementById('passwordInput').value;
        const errorElement = document.getElementById('passwordError');

        if (!password) {
            errorElement.textContent = '请输入密码';
            return;
        }

        try {
            const response = await fetch(`${API_URL}?action=verify_password&token=${this.token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (data.success && data.verified) {
                this.showShareScreen();
                this.loadFiles();
            } else {
                errorElement.textContent = '密码错误';
            }
        } catch (error) {
            console.error('验证密码失败:', error);
            errorElement.textContent = '验证失败，请重试';
        }
    }

    showPasswordScreen() {
        document.getElementById('passwordScreen').style.display = 'flex';
        document.getElementById('shareScreen').style.display = 'none';
        document.getElementById('errorScreen').style.display = 'none';
    }

    showShareScreen() {
        document.getElementById('passwordScreen').style.display = 'none';
        document.getElementById('shareScreen').style.display = 'block';
        document.getElementById('errorScreen').style.display = 'none';

        document.getElementById('shareTitle').textContent = this.share.name;

        let badgeText = '';
        if (this.share.allow_download) badgeText += '下载 ';
        if (this.share.allow_preview) badgeText += '预览 ';
        if (this.share.allow_upload) badgeText += '上传 ';
        if (this.share.allow_delete) badgeText += '删除 ';

        document.getElementById('shareBadge').textContent = badgeText;

        if (this.share.root_directory_name) {
            const rootDirInfo = document.createElement('div');
            rootDirInfo.style.cssText = 'margin-top: 8px; padding: 8px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; font-size: 12px; color: #667eea;';
            rootDirInfo.innerHTML = `<strong>📁 根目录:</strong> ${this.escapeHtml(this.share.root_directory_name)}`;
            
            const header = document.querySelector('.header');
            const existingInfo = header.querySelector('.root-dir-info');
            if (existingInfo) {
                existingInfo.remove();
            }
            header.appendChild(rootDirInfo);
        }
    }

    showErrorScreen() {
        document.getElementById('passwordScreen').style.display = 'none';
        document.getElementById('shareScreen').style.display = 'none';
        document.getElementById('errorScreen').style.display = 'flex';
    }

    async loadFiles() {
        try {
            const response = await fetch(`${API_URL}?action=get_files&token=${this.token}&directory=${this.currentDirectory}`);
            const data = await response.json();

            if (data.success) {
                this.files = data.files;
                this.directories = data.directories;
                this.renderFiles();
                this.updateBreadcrumb();
            }
        } catch (error) {
            console.error('加载文件失败:', error);
            this.showError('加载文件失败，请刷新重试');
        }
    }

    renderFiles() {
        const container = document.getElementById('filesGrid');

        if (this.directories.length === 0 && this.files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <p>暂无文件</p>
                </div>
            `;
            return;
        }

        let html = '';

        this.directories.forEach(dir => {
            html += `
                <div class="file-card directory-card" onclick="sharePage.enterDirectory('${dir.id}', '${this.escapeHtml(dir.name)}')">
                    <div class="file-icon">📁</div>
                    <div class="file-name">${this.escapeHtml(dir.name)}</div>
                    <div class="file-info">
                        ${dir.created_at}
                    </div>
                    ${this.share.allow_delete ? `
                        <div class="file-actions">
                            <button class="file-action-btn delete" onclick="event.stopPropagation(); sharePage.deleteDirectory('${dir.id}')" title="删除">
                                🗑️
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        this.files.forEach(file => {
            html += `
                <div class="file-card" onclick="sharePage.previewFile('${file.id}')">
                    <div class="file-icon">${file.icon}</div>
                    <div class="file-name">${this.escapeHtml(file.name)}</div>
                    <div class="file-info">
                        ${file.size_formatted} · ${file.uploaded_at}
                    </div>
                    <div class="file-actions">
                        ${this.share.allow_download ? `
                            <button class="file-action-btn download" onclick="event.stopPropagation(); sharePage.downloadFile('${file.id}')" title="下载">
                                ⬇️
                            </button>
                        ` : ''}
                        ${this.share.allow_delete ? `
                            <button class="file-action-btn delete" onclick="event.stopPropagation(); sharePage.deleteFile('${file.id}')" title="删除">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        let html = `<span class="breadcrumb-item" onclick="sharePage.navigateTo('')" data-path="">首页</span>`;

        if (this.currentDirectory) {
            const dir = this.directories.find(d => d.id === this.currentDirectory);
            if (dir) {
                html += ` <span class="breadcrumb-separator">/</span> <span class="breadcrumb-item active">${this.escapeHtml(dir.name)}</span>`;
            }
        }

        breadcrumb.innerHTML = html;
    }

    navigateTo(directoryId) {
        this.currentDirectory = directoryId;
        this.loadFiles();
    }

    enterDirectory(directoryId, directoryName) {
        this.currentDirectory = directoryId;
        this.loadFiles();
    }

    previewFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        if (!this.share.allow_preview) {
            this.showError('此分享不允许预览');
            return;
        }

        const modal = document.getElementById('fileModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = '文件预览';

        const ext = file.name.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const videoExts = ['mp4', 'webm', 'ogg'];
        const audioExts = ['mp3', 'wav', 'ogg'];

        let previewContent = '';

        if (imageExts.includes(ext)) {
            previewContent = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${file.url}" alt="${this.escapeHtml(file.name)}" 
                        style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                </div>
            `;
        } else if (videoExts.includes(ext)) {
            previewContent = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <video controls style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <source src="${file.url}" type="video/${ext}">
                        您的浏览器不支持视频播放
                    </video>
                </div>
            `;
        } else if (audioExts.includes(ext)) {
            previewContent = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <audio controls style="width: 100%;">
                        <source src="${file.url}" type="audio/${ext}">
                        您的浏览器不支持音频播放
                    </audio>
                </div>
            `;
        } else {
            previewContent = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 64px;">${file.icon}</div>
                </div>
            `;
        }

        let buttons = '';
        if (this.share.allow_download) {
            buttons += `<button class="btn btn-primary" onclick="sharePage.downloadFile('${file.id}'); sharePage.closeModal();" style="flex: 1;">⬇️ 下载</button>`;
        }

        modalBody.innerHTML = `
            ${previewContent}
            <div style="margin-bottom: 12px;">
                <strong>文件名:</strong> ${this.escapeHtml(file.name)}
            </div>
            <div style="margin-bottom: 12px;">
                <strong>大小:</strong> ${file.size_formatted}
            </div>
            <div style="margin-bottom: 20px;">
                <strong>上传时间:</strong> ${file.uploaded_at}
            </div>
            <div style="display: flex; gap: 10px;">
                ${buttons}
            </div>
        `;

        modal.classList.add('active');
    }

    downloadFile(fileId) {
        if (!this.share.allow_download) {
            this.showError('此分享不允许下载');
            return;
        }

        const file = this.files.find(f => f.id === fileId);
        if (file && file.download_url) {
            window.open(file.download_url, '_blank');
        }
    }

    async deleteFile(fileId) {
        if (!this.share.allow_delete) {
            this.showError('此分享不允许删除');
            return;
        }

        if (!confirm('确定要永久删除此文件吗？此操作不可恢复。')) {
            return;
        }

        try {
            const response = await fetch(`api/api.php?action=delete_permanent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: fileId })
            });

            const data = await response.json();

            if (data.success) {
                this.loadFiles();
                this.showSuccess('文件已永久删除');
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            console.error('删除失败:', error);
            this.showError('删除失败，请重试');
        }
    }

    async deleteDirectory(directoryId) {
        if (!this.share.allow_delete) {
            this.showError('此分享不允许删除');
            return;
        }

        if (!confirm('确定要永久删除此目录及其所有内容吗？此操作不可恢复。')) {
            return;
        }

        try {
            const response = await fetch(`api/api.php?action=delete_permanent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    id: directoryId,
                    is_directory: true
                })
            });

            const data = await response.json();

            if (data.success) {
                this.loadFiles();
                this.showSuccess('目录已永久删除');
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            console.error('删除失败:', error);
            this.showError('删除失败，请重试');
        }
    }

    handleUploadFiles(files) {
        if (!this.share.allow_upload) {
            this.showError('此分享不允许上传');
            return;
        }

        const uploadList = document.getElementById('uploadList');

        Array.from(files).forEach(file => {
            this.uploadFile(file, uploadList);
        });
    }

    async uploadFile(file, uploadList) {
        const uploadItem = document.createElement('div');
        uploadItem.className = 'upload-item';
        uploadItem.innerHTML = `
            <div class="upload-item-icon">📄</div>
            <div class="upload-item-info">
                <div class="upload-item-name">${this.escapeHtml(file.name)}</div>
                <div class="upload-item-size">${this.formatFileSize(file.size)}</div>
            </div>
            <div class="upload-item-progress">
                <div class="upload-item-progress-bar" style="width: 0%"></div>
            </div>
            <div class="upload-item-status uploading">准备上传...</div>
        `;
        uploadList.appendChild(uploadItem);
        
        const progressBar = uploadItem.querySelector('.upload-item-progress-bar');
        const status = uploadItem.querySelector('.upload-item-status');
        
        // 大文件分片上传（大于 10MB）
        const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB 分片大小
        if (file.size > CHUNK_SIZE) {
            await this.uploadLargeFile(file, uploadItem, progressBar, status, CHUNK_SIZE);
        } else {
            await this.uploadSmallFile(file, uploadItem, progressBar, status);
        }
    }

    async uploadSmallFile(file, uploadItem, progressBar, status) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            status.textContent = '上传中...';
            
            const xhr = new XMLHttpRequest();
            
            // 监听上传进度
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBar.style.width = percentComplete + '%';
                    status.textContent = `上传中 ${Math.round(percentComplete)}%`;
                }
            });
            
            const response = await new Promise((resolve, reject) => {
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error('上传失败'));
                    }
                });
                
                xhr.addEventListener('error', () => {
                    reject(new Error('上传失败'));
                });
                
                xhr.open('POST', `api/api.php?action=upload`);
                xhr.send(formData);
            });
            
            if (response.success) {
                progressBar.style.width = '100%';
                status.textContent = '处理中...';
                
                // 获取目标目录：优先使用选择的目录，否则使用当前目录
                const selectedDirectory = document.getElementById('uploadDirectory')?.value;
                const targetDirectory = selectedDirectory !== '' ? selectedDirectory : this.currentDirectory;
                
                console.log('上传文件到目录:', targetDirectory || '根目录');
                
                const addResponse = await fetch(`${API_URL}?action=add_file&token=${this.token}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file_id: response.file.id,
                        directory: targetDirectory
                    })
                });
                
                const addData = await addResponse.json();
                
                if (addData.success) {
                    status.textContent = '上传成功';
                    status.className = 'upload-item-status success';
                    setTimeout(() => {
                        uploadItem.remove();
                        this.loadFiles();
                    }, 1000);
                } else {
                    throw new Error(addData.error || '添加文件失败');
                }
            } else {
                throw new Error(response.error || '上传失败');
            }
        } catch (error) {
            console.error('上传失败:', error);
            status.textContent = '上传失败: ' + (error.message || '未知错误');
            status.className = 'upload-item-status error';
        }
    }

    async uploadLargeFile(file, uploadItem, progressBar, status, CHUNK_SIZE = 10 * 1024 * 1024) {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const fileId = 'chunk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // 显示文件大小信息
        const fileSizeFormatted = this.formatFileSize(file.size);
        console.log(`开始上传大文件: ${file.name}, 大小: ${fileSizeFormatted}, 分片数: ${totalChunks}`);
        
        try {
            // 检查是否支持断点续传
            const uploadedChunks = await this.checkUploadedChunks(fileId);
            
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                // 如果该分片已上传，跳过
                if (uploadedChunks.includes(chunkIndex)) {
                    console.log(`分片 ${chunkIndex + 1}/${totalChunks} 已上传，跳过`);
                    const percentComplete = ((chunkIndex + 1) / totalChunks) * 100;
                    progressBar.style.width = percentComplete + '%';
                    status.textContent = `上传中 ${chunkIndex + 1}/${totalChunks} (${Math.round(percentComplete)}%) - 已存在`;
                    continue;
                }
                
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                
                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('file_id', fileId);
                formData.append('chunk_index', chunkIndex);
                formData.append('total_chunks', totalChunks);
                formData.append('file_name', file.name);
                formData.append('file_size', file.size);
                
                const percentComplete = (chunkIndex / totalChunks) * 100;
                progressBar.style.width = percentComplete + '%';
                status.textContent = `上传中 ${chunkIndex + 1}/${totalChunks} (${Math.round(percentComplete)}%) - ${fileSizeFormatted}`;
                
                // 使用 XMLHttpRequest 支持进度监控
                await this.uploadChunkWithRetry(fileId, chunkIndex, formData, 3);
                
                // 更新进度
                const currentPercentComplete = ((chunkIndex + 1) / totalChunks) * 100;
                progressBar.style.width = currentPercentComplete + '%';
            }
            
            status.textContent = '合并文件中...';
            
            // 通知服务器合并文件
            const mergeResponse = await fetch(`api/api.php?action=merge_chunks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_id: fileId,
                    file_name: file.name,
                    file_size: file.size,
                    total_chunks: totalChunks
                })
            });
            
            const mergeData = await mergeResponse.json();
            
            if (mergeData.success) {
                progressBar.style.width = '100%';
                status.textContent = '处理中...';
                
                // 获取目标目录：优先使用选择的目录，否则使用当前目录
                const selectedDirectory = document.getElementById('uploadDirectory')?.value;
                const targetDirectory = selectedDirectory !== '' ? selectedDirectory : this.currentDirectory;
                
                console.log('上传文件到目录:', targetDirectory || '根目录');
                
                const addResponse = await fetch(`${API_URL}?action=add_file&token=${this.token}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file_id: mergeData.file.id,
                        directory: targetDirectory
                    })
                });
                
                const addData = await addResponse.json();
                
                if (addData.success) {
                    status.textContent = '上传成功';
                    status.className = 'upload-item-status success';
                    setTimeout(() => {
                        uploadItem.remove();
                        this.loadFiles();
                    }, 1000);
                } else {
                    throw new Error(addData.error || '添加文件失败');
                }
            } else {
                throw new Error(mergeData.error || '文件合并失败');
            }
        } catch (error) {
            console.error('大文件上传失败:', error);
            status.textContent = '上传失败: ' + (error.message || '未知错误');
            status.className = 'upload-item-status error';
        }
    }

    async checkUploadedChunks(fileId) {
        try {
            const response = await fetch(`api/api.php?action=check_chunks&file_id=${fileId}`);
            const data = await response.json();
            
            if (data.success && data.uploaded_chunks) {
                return data.uploaded_chunks;
            }
        } catch (e) {
            console.log('检查已上传分片失败:', e);
        }
        return [];
    }

    async uploadChunkWithRetry(fileId, chunkIndex, formData, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(`api/api.php?action=upload_chunk`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    return data;
                } else {
                    throw new Error(data.error || '分片上传失败');
                }
            } catch (error) {
                lastError = error;
                console.warn(`分片 ${chunkIndex + 1} 上传失败 (尝试 ${attempt}/${maxRetries}):`, error);
                
                if (attempt < maxRetries) {
                    // 等待后重试（指数退避）
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        
        throw lastError || new Error(`分片 ${chunkIndex + 1} 上传失败，已重试 ${maxRetries} 次`);
    }

    closeModal() {
        document.getElementById('fileModal').classList.remove('active');
    }

    closeUploadModal() {
        document.getElementById('uploadModal').classList.remove('active');
    }

    openUploadModal() {
        document.getElementById('uploadModal').classList.add('active');
        this.loadDirectoryOptions();
    }

    async loadDirectoryOptions() {
        try {
            // 使用分享内的目录结构，而不是全局目录
            const select = document.getElementById('uploadDirectory');
            
            // 默认选项：当前目录
            select.innerHTML = '<option value="">当前目录</option>';
            
            // 如果有当前目录，添加当前目录选项
            if (this.currentDirectory) {
                const currentDir = this.directories.find(d => d.id === this.currentDirectory);
                if (currentDir) {
                    const option = document.createElement('option');
                    option.value = currentDir.id;
                    option.textContent = '📁 ' + currentDir.name;
                    select.appendChild(option);
                }
            }
            
            // 添加所有子目录
            const addDirectoryOption = (dir, prefix = '', level = 0) => {
                // 只显示当前目录下的子目录
                if (level === 0 && dir.id === this.currentDirectory) {
                    // 添加当前目录的子目录
                    const childDirs = this.directories.filter(d => d.parent === dir.id);
                    childDirs.forEach(child => {
                        addDirectoryOption(child, '  └─ ', level + 1);
                    });
                    return;
                }
                
                if (level > 0) {
                    const option = document.createElement('option');
                    option.value = dir.id;
                    option.textContent = prefix + dir.name;
                    select.appendChild(option);
                    
                    // 递归添加子目录
                    const childDirs = this.directories.filter(d => d.parent === dir.id);
                    childDirs.forEach(child => {
                        addDirectoryOption(child, prefix + '  └─ ', level + 1);
                    });
                }
            };
            
            // 从根目录开始遍历
            const rootDirs = this.directories.filter(d => !d.parent);
            rootDirs.forEach(dir => {
                addDirectoryOption(dir, '', 0);
            });
            
            // 如果没有目录，显示提示
            if (select.options.length <= 1) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "（暂无子目录）";
                option.disabled = true;
                select.appendChild(option);
            }
        } catch (error) {
            console.error('加载目录失败:', error);
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        bytes = Math.max(bytes, 0);
        const pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
        const maxPow = Math.min(pow, units.length - 1);
        return (bytes / Math.pow(1024, maxPow)).toFixed(2) + ' ' + units[maxPow];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

const sharePage = new SharePage();
