const API_URL = 'api/api.php';
const SHARE_API_URL = 'api/share.php';
const FILE_OPS_API_URL = 'api/file_operations.php';

class CloudDrive {
    constructor() {
        this.currentSection = 'files';
        this.files = [];
        this.trash = [];
        this.shares = [];
        this.directories = [];
        this.currentDirectory = '';
        this.init();
    }

    init() {
        this.currentUser = this.getCurrentUser();
        this.updateUserDisplay();
        this.bindEvents();
        this.loadFiles();
    }

    getCurrentUser() {
        const tokenData = localStorage.getItem('cloudDriveToken') || sessionStorage.getItem('cloudDriveToken');
        if (tokenData) {
            try {
                const loginData = JSON.parse(tokenData);
                return loginData.user || null;
            } catch (e) {
                console.error('解析用户数据失败:', e);
            }
        }
        return null;
    }

    updateUserDisplay() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.username;
            document.getElementById('dropdownUserName').textContent = this.currentUser.username;
            document.getElementById('dropdownUserRole').textContent = 
                this.currentUser.role === 'admin' ? '管理员' : '普通用户';
        }
    }

    logout() {
        if (confirm('确定要退出登录吗？')) {
            localStorage.removeItem('cloudDriveToken');
            sessionStorage.removeItem('cloudDriveToken');
            window.location.href = 'login.html';
        }
    }

    toggleUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchSection(section);
            });
        });

        document.getElementById('settingsBtn').addEventListener('click', () => {
            window.location.href = 'install.html';
        });

        // 用户菜单事件
        document.getElementById('userBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleUserMenu();
        });

        document.getElementById('logoutItem').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        document.getElementById('changePasswordItem').addEventListener('click', (e) => {
            e.preventDefault();
            this.openChangePasswordModal();
        });

        // 点击页面其他地方关闭用户菜单
        document.addEventListener('click', () => {
            document.getElementById('userDropdown').style.display = 'none';
        });

        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');

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
            this.handleFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            this.handleFiles(files);
        });

        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.switchSection('upload');
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadFiles();
        });

        document.getElementById('emptyTrashBtn').addEventListener('click', () => {
            if (confirm('确定要清空回收站吗？此操作不可恢复。')) {
                this.emptyTrash();
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

        document.getElementById('createDirBtn').addEventListener('click', () => {
            this.openCreateDirModal();
        });

        document.getElementById('closeCreateDirModal').addEventListener('click', () => {
            this.closeCreateDirModal();
        });

        document.getElementById('cancelCreateDir').addEventListener('click', () => {
            this.closeCreateDirModal();
        });

        document.getElementById('confirmCreateDir').addEventListener('click', () => {
            this.createDirectory();
        });

        document.getElementById('createShareBtn').addEventListener('click', () => {
            this.openCreateShareModal();
        });

        document.getElementById('closeCreateShareModal').addEventListener('click', () => {
            this.closeCreateShareModal();
        });

        document.getElementById('cancelCreateShare').addEventListener('click', () => {
            this.closeCreateShareModal();
        });

        document.getElementById('confirmCreateShare').addEventListener('click', () => {
            this.createShare();
        });

        document.getElementById('closeShareLinkModal').addEventListener('click', () => {
            this.closeShareLinkModal();
        });

        document.getElementById('copyShareLink').addEventListener('click', () => {
            this.copyShareLink();
        });

        // 修改密码模态框事件
        document.getElementById('closeChangePasswordModal').addEventListener('click', () => {
            this.closeChangePasswordModal();
        });

        document.getElementById('cancelChangePassword').addEventListener('click', () => {
            this.closeChangePasswordModal();
        });

        document.getElementById('confirmChangePassword').addEventListener('click', () => {
            this.changePassword();
        });

        document.getElementById('changePasswordModal').addEventListener('click', (e) => {
            if (e.target.id === 'changePasswordModal') {
                this.closeChangePasswordModal();
            }
        });

        document.getElementById('closeMoveFileModal').addEventListener('click', () => {
            this.closeMoveFileModal();
        });

        document.getElementById('cancelMoveFile').addEventListener('click', () => {
            this.closeMoveFileModal();
        });

        document.getElementById('confirmMoveFile').addEventListener('click', () => {
            this.moveFile();
        });
    }

    switchSection(section) {
        this.currentSection = section;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === section) {
                item.classList.add('active');
            }
        });

        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.remove('active');
        });

        if (section === 'files') {
            document.getElementById('filesSection').classList.add('active');
            this.loadFiles();
        } else if (section === 'upload') {
            document.getElementById('uploadSection').classList.add('active');
        } else if (section === 'shares') {
            document.getElementById('sharesSection').classList.add('active');
            this.loadShares();
        } else if (section === 'trash') {
            document.getElementById('trashSection').classList.add('active');
            this.loadTrash();
        }
    }

    async loadFiles() {
        try {
            const response = await fetch(`${API_URL}?action=get_files_by_directory&directory=${this.currentDirectory}`);
            const data = await response.json();

            if (data.success) {
                this.files = data.files;
                this.directories = data.directories;
                this.renderFiles();
                this.updateBreadcrumb();
                
                const totalSize = this.files.reduce((sum, file) => sum + (file.size || 0), 0);
                document.getElementById('usedStorage').textContent = this.formatFileSize(totalSize);
                
                const storageResponse = await fetch(`${API_URL}?action=list`);
                const storageData = await storageResponse.json();
                
                if (storageData.success && storageData.storage) {
                    const storageInfo = storageData.storage;
                    document.getElementById('usedStorage').textContent = 
                        `${storageInfo.used_formatted} / ${storageInfo.total_formatted}`;
                }
            }
        } catch (error) {
            console.error('加载文件失败:', error);
            this.showError('加载文件失败，请刷新重试');
        }
    }

    async loadTrash() {
        try {
            const response = await fetch(`${API_URL}?action=trash`);
            const data = await response.json();

            if (data.success) {
                this.trash = data.files;
                this.renderTrash(this.trash);
            }
        } catch (error) {
            console.error('加载回收站失败:', error);
            this.showError('加载回收站失败，请刷新重试');
        }
    }

    renderFiles() {
        const container = document.getElementById('filesGrid');

        if (this.directories.length === 0 && this.files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <p>暂无文件</p>
                    <p class="empty-hint">点击"上传文件"开始使用</p>
                </div>
            `;
            return;
        }

        let html = '';

        this.directories.forEach(dir => {
            html += `
                <div class="file-card directory-card" onclick="cloudDrive.enterDirectory('${dir.id}', '${this.escapeHtml(dir.name)}')">
                    <div class="file-icon">📁</div>
                    <div class="file-name">${this.escapeHtml(dir.name)}</div>
                    <div class="file-info">
                        ${dir.created_at}
                    </div>
                    <div class="file-actions">
                        <button class="file-action-btn delete" onclick="event.stopPropagation(); cloudDrive.deleteDirectory('${dir.id}')" title="删除">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });

        this.files.forEach(file => {
            html += `
                <div class="file-card" data-id="${file.id}" onclick="cloudDrive.previewFile('${file.id}')">
                    <div class="file-icon">${file.icon}</div>
                    <div class="file-name">${this.escapeHtml(file.name)}</div>
                    <div class="file-info">
                        ${file.size_formatted} · ${file.uploaded_at}
                    </div>
                    <div class="file-actions">
                        <button class="file-action-btn download" onclick="event.stopPropagation(); cloudDrive.downloadFile('${file.id}')" title="下载">
                            ⬇️
                        </button>
                        <button class="file-action-btn link" onclick="event.stopPropagation(); cloudDrive.getLink('${file.id}')" title="外链">
                            🔗
                        </button>
                        <button class="file-action-btn delete" onclick="event.stopPropagation(); cloudDrive.deleteFile('${file.id}')" title="删除">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderTrash(files) {
        const container = document.getElementById('trashGrid');

        if (files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">♻️</span>
                    <p>回收站为空</p>
                </div>
            `;
            return;
        }

        container.innerHTML = files.map(file => `
            <div class="file-card" data-id="${file.id}">
                <div class="file-icon">${file.icon}</div>
                <div class="file-name">${this.escapeHtml(file.name)}</div>
                <div class="file-info">
                    ${file.size_formatted} · ${file.deleted_at}
                </div>
                <div class="file-actions">
                    <button class="file-action-btn download" onclick="cloudDrive.restoreFile('${file.id}')" title="恢复">
                        ↩️
                    </button>
                    <button class="file-action-btn delete" onclick="cloudDrive.deletePermanent('${file.id}')" title="永久删除">
                        ❌
                    </button>
                </div>
            </div>
        `).join('');
    }

    handleFiles(files) {
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
        const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
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

                xhr.open('POST', `${API_URL}?action=upload`);
                xhr.send(formData);
            });

            if (response.success) {
                progressBar.style.width = '100%';
                status.textContent = '上传成功';
                status.className = 'upload-item-status success';

                setTimeout(() => {
                    uploadItem.remove();
                }, 2000);

                if (this.currentSection === 'files') {
                    this.loadFiles();
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
        
        const fileSizeFormatted = this.formatFileSize(file.size);
        console.log(`开始上传大文件: ${file.name}, 大小: ${fileSizeFormatted}, 分片数: ${totalChunks}`);

        try {
            // 检查已上传的分片
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

                // 上传分片（带重试）
                await this.uploadChunkWithRetry(fileId, chunkIndex, formData, 3);

                // 更新进度
                const currentPercentComplete = ((chunkIndex + 1) / totalChunks) * 100;
                progressBar.style.width = currentPercentComplete + '%';
            }

            status.textContent = '合并文件中...';

            // 通知服务器合并文件
            const mergeResponse = await fetch(`${API_URL}?action=merge_chunks`, {
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
                status.textContent = '上传成功';
                status.className = 'upload-item-status success';

                setTimeout(() => {
                    uploadItem.remove();
                }, 2000);

                if (this.currentSection === 'files') {
                    this.loadFiles();
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
            const response = await fetch(`${API_URL}?action=check_chunks&file_id=${fileId}`);
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
                const response = await fetch(`${API_URL}?action=upload_chunk`, {
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
                    // 指数退避等待后重试
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        throw lastError || new Error(`分片 ${chunkIndex + 1} 上传失败，已重试 ${maxRetries} 次`);
    }

    async deleteFile(fileId) {
        if (!confirm('确定要将此文件移至回收站吗？')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}?action=delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: fileId })
            });

            const data = await response.json();

            if (data.success) {
                this.loadFiles();
                this.showSuccess('文件已移至回收站');
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            console.error('删除失败:', error);
            this.showError('删除失败，请重试');
        }
    }

    async restoreFile(fileId) {
        try {
            const response = await fetch(`${API_URL}?action=restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: fileId })
            });

            const data = await response.json();

            if (data.success) {
                this.loadTrash();
                this.showSuccess('文件已恢复');
            } else {
                throw new Error(data.error || '恢复失败');
            }
        } catch (error) {
            console.error('恢复失败:', error);
            this.showError('恢复失败，请重试');
        }
    }

    async deletePermanent(fileId) {
        if (!confirm('确定要永久删除此文件吗？此操作不可恢复。')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}?action=delete_permanent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: fileId })
            });

            const data = await response.json();

            if (data.success) {
                this.loadTrash();
                this.showSuccess('文件已永久删除');
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            console.error('删除失败:', error);
            this.showError('删除失败，请重试');
        }
    }

    async emptyTrash() {
        try {
            const response = await fetch(`${API_URL}?action=empty_trash`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.loadTrash();
                this.showSuccess('回收站已清空');
            } else {
                throw new Error(data.error || '清空失败');
            }
        } catch (error) {
            console.error('清空回收站失败:', error);
            this.showError('清空回收站失败，请重试');
        }
    }

    downloadFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (file && file.download_url) {
            window.open(file.download_url, '_blank');
        }
    }

    async getLink(fileId) {
        try {
            const response = await fetch(`${API_URL}?action=get_link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: fileId })
            });

            const data = await response.json();

            if (data.success) {
                const modal = document.getElementById('fileModal');
                const modalTitle = document.getElementById('modalTitle');
                const modalBody = document.getElementById('modalBody');

                modalTitle.textContent = '文件外链';
                modalBody.innerHTML = `
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 64px;">🔗</div>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <strong>外链地址:</strong>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <input type="text" value="${data.link}" readonly 
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;">
                    </div>
                    <button class="btn btn-primary" onclick="cloudDrive.copyLink('${data.link}')" style="width: 100%;">
                        📋 复制外链
                    </button>
                `;

                modal.classList.add('active');
            } else {
                throw new Error(data.error || '获取外链失败');
            }
        } catch (error) {
            console.error('获取外链失败:', error);
            this.showError('获取外链失败，请重试');
        }
    }

    copyLink(link) {
        navigator.clipboard.writeText(link).then(() => {
            this.showSuccess('外链已复制到剪贴板');
            this.closeModal();
        }).catch(() => {
            this.showError('复制失败，请手动复制');
        });
    }

    previewFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

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
                <button class="btn btn-primary" onclick="cloudDrive.downloadFile('${file.id}'); cloudDrive.closeModal();" style="flex: 1;">
                    ⬇️ 下载
                </button>
                <button class="btn btn-secondary" onclick="cloudDrive.getLink('${file.id}')" style="flex: 1;">
                    🔗 外链
                </button>
                <button class="btn btn-secondary" onclick="cloudDrive.openMoveFileModal('${file.id}')" style="flex: 1;">
                    📁 移动
                </button>
            </div>
        `;

        modal.classList.add('active');
    }

    openMoveFileModal(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        const modal = document.getElementById('moveFileModal');
        const modalTitle = document.getElementById('moveFileTitle');
        const modalBody = document.getElementById('moveFileBody');

        modalTitle.textContent = '移动文件到目录';
        modalBody.innerHTML = `
            <div style="margin-bottom: 16px;">
                <strong>文件名:</strong> ${this.escapeHtml(file.name)}
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">目标目录</label>
                <select id="moveFileDirectory" 
                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;">
                    <option value="">根目录</option>
                </select>
            </div>
        `;

        modal.classList.add('active');
        this.loadDirectoryOptions();
    }

    closeMoveFileModal() {
        document.getElementById('moveFileModal').classList.remove('active');
    }

    async moveFile() {
        const fileId = document.querySelector('.file-card[data-id]')?.dataset.id;
        const directory = document.getElementById('moveFileDirectory').value;

        if (!fileId) {
            this.showError('请先选择要移动的文件');
            return;
        }

        try {
            const response = await fetch(`${FILE_OPS_API_URL}?action=move_file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_id: fileId,
                    directory: directory
                })
            });

            const data = await response.json();

            if (data.success) {
                this.closeMoveFileModal();
                this.loadFiles();
                this.showSuccess('文件已移动');
            } else {
                throw new Error(data.error || '移动失败');
            }
        } catch (error) {
            console.error('移动失败:', error);
            this.showError('移动失败，请重试');
        }
    }

    showFileDetails(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        const modal = document.getElementById('fileModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = '文件详情';
        modalBody.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 64px;">${file.icon}</div>
            </div>
            <div style="margin-bottom: 12px;">
                <strong>文件名:</strong> ${this.escapeHtml(file.name)}
            </div>
            <div style="margin-bottom: 12px;">
                <strong>大小:</strong> ${file.size_formatted}
            </div>
            <div style="margin-bottom: 12px;">
                <strong>上传时间:</strong> ${file.uploaded_at}
            </div>
            <div style="margin-bottom: 20px;">
                <strong>文件ID:</strong> ${file.id}
            </div>
            <button class="btn btn-primary" onclick="cloudDrive.downloadFile('${file.id}'); cloudDrive.closeModal();" style="width: 100%;">
                ⬇️ 下载文件
            </button>
        `;

        modal.classList.add('active');
    }

    closeModal() {
        document.getElementById('fileModal').classList.remove('active');
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

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        let html = `<span class="breadcrumb-item" onclick="cloudDrive.navigateTo('')" data-path="">首页</span>`;

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

    openCreateDirModal() {
        document.getElementById('createDirModal').classList.add('active');
        document.getElementById('dirNameInput').value = '';
        document.getElementById('dirNameInput').focus();
    }

    closeCreateDirModal() {
        document.getElementById('createDirModal').classList.remove('active');
    }

    async createDirectory() {
        const name = document.getElementById('dirNameInput').value.trim();

        if (!name) {
            this.showError('请输入目录名称');
            return;
        }

        try {
            const response = await fetch(`${API_URL}?action=create_directory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    parent: this.currentDirectory
                })
            });

            const data = await response.json();

            if (data.success) {
                this.closeCreateDirModal();
                this.loadFiles();
                this.showSuccess('目录创建成功');
            } else {
                throw new Error(data.error || '创建失败');
            }
        } catch (error) {
            console.error('创建目录失败:', error);
            this.showError('创建目录失败，请重试');
        }
    }

    async deleteDirectory(directoryId) {
        if (!confirm('确定要删除此目录及其所有内容吗？')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}?action=delete_directory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: directoryId })
            });

            const data = await response.json();

            if (data.success) {
                this.loadFiles();
                this.showSuccess('目录已删除');
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            console.error('删除目录失败:', error);
            this.showError('删除目录失败，请重试');
        }
    }

    async loadShares() {
        try {
            const response = await fetch(`${SHARE_API_URL}?action=get_shares`);
            const data = await response.json();

            if (data.success) {
                this.shares = data.shares;
                this.renderShares();
            }
        } catch (error) {
            console.error('加载外链失败:', error);
            this.showError('加载外链失败，请刷新重试');
        }
    }

    async loadDirectories() {
        try {
            const response = await fetch(`${API_URL}?action=get_directories`);
            const data = await response.json();

            if (data.success) {
                return data.directories;
            }
            return [];
        } catch (error) {
            console.error('加载目录失败:', error);
            return [];
        }
    }

    renderShares() {
        const container = document.getElementById('sharesGrid');

        if (this.shares.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔗</span>
                    <p>暂无外链</p>
                    <p class="empty-hint">点击"创建外链"开始分享</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.shares.map(share => `
            <div class="file-card share-card" data-id="${share.id}">
                <div class="file-icon">🔗</div>
                <div class="file-name">${this.escapeHtml(share.name)}</div>
                <div class="file-info">
                    ${share.root_directory_name ? `根目录: ${this.escapeHtml(share.root_directory_name)}` : '根目录'} · ${share.created_at}
                </div>
                <div class="share-permissions">
                    ${share.has_password ? '<span class="permission-badge">🔐 有密码</span>' : ''}
                    ${share.allow_download ? '<span class="permission-badge">⬇️ 下载</span>' : ''}
                    ${share.allow_preview ? '<span class="permission-badge">👁️ 预览</span>' : ''}
                    ${share.allow_upload ? '<span class="permission-badge">⬆️ 上传</span>' : ''}
                    ${share.allow_delete ? '<span class="permission-badge">🗑️ 删除</span>' : ''}
                </div>
                <div class="file-actions">
                    <button class="file-action-btn link" onclick="cloudDrive.openShareLink('${share.token}')" title="打开外链">
                        🔗
                    </button>
                    <button class="file-action-btn delete" onclick="cloudDrive.deleteShare('${share.id}')" title="删除">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    openCreateShareModal() {
        document.getElementById('createShareModal').classList.add('active');
        document.getElementById('shareNameInput').value = '';
        document.getElementById('sharePasswordInput').value = '';
        document.getElementById('allowDownload').checked = true;
        document.getElementById('allowPreview').checked = true;
        document.getElementById('allowUpload').checked = false;
        document.getElementById('allowDelete').checked = false;
        document.getElementById('shareNameInput').focus();
        this.loadDirectoryOptions();
    }

    async loadDirectoryOptions() {
        const directories = await this.loadDirectories();
        const select = document.getElementById('shareRootDirectory');
        
        select.innerHTML = '<option value="">根目录（所有文件）</option>';
        
        const addDirectoryOption = (dir, prefix = '') => {
            const option = document.createElement('option');
            option.value = dir.id;
            option.textContent = prefix + dir.name;
            select.appendChild(option);
            
            const childDirs = directories.filter(d => d.parent === dir.id);
            childDirs.forEach(child => {
                addDirectoryOption(child, prefix + dir.name + ' / ');
            });
        };
        
        const rootDirs = directories.filter(d => !d.parent);
        rootDirs.forEach(dir => {
            addDirectoryOption(dir);
        });
    }

    closeCreateShareModal() {
        document.getElementById('createShareModal').classList.remove('active');
    }

    async createShare() {
        const name = document.getElementById('shareNameInput').value.trim();
        const password = document.getElementById('sharePasswordInput').value;
        const rootDirectory = document.getElementById('shareRootDirectory').value;
        const allowDownload = document.getElementById('allowDownload').checked;
        const allowPreview = document.getElementById('allowPreview').checked;
        const allowUpload = document.getElementById('allowUpload').checked;
        const allowDelete = document.getElementById('allowDelete').checked;

        if (!name) {
            this.showError('请输入分享名称');
            return;
        }

        try {
            const response = await fetch(`${SHARE_API_URL}?action=create_share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    password: password,
                    root_directory: rootDirectory,
                    allow_download: allowDownload,
                    allow_preview: allowPreview,
                    allow_upload: allowUpload,
                    allow_delete: allowDelete
                })
            });

            const data = await response.json();

            if (data.success) {
                this.closeCreateShareModal();
                this.showShareLinkModal(data.share.url);
                this.loadShares();
            } else {
                throw new Error(data.error || '创建失败');
            }
        } catch (error) {
            console.error('创建外链失败:', error);
            this.showError('创建外链失败，请重试');
        }
    }

    showShareLinkModal(url) {
        document.getElementById('shareLinkInput').value = url;
        document.getElementById('shareLinkModal').classList.add('active');
    }

    closeShareLinkModal() {
        document.getElementById('shareLinkModal').classList.remove('active');
    }

    copyShareLink() {
        const link = document.getElementById('shareLinkInput').value;
        navigator.clipboard.writeText(link).then(() => {
            this.showSuccess('外链已复制到剪贴板');
            this.closeShareLinkModal();
        }).catch(() => {
            this.showError('复制失败，请手动复制');
        });
    }

    openShareLink(token) {
        window.open(`share.html?token=${token}`, '_blank');
    }

    openChangePasswordModal() {
        document.getElementById('changePasswordModal').classList.add('active');
        document.getElementById('currentPasswordInput').value = '';
        document.getElementById('newPasswordInput').value = '';
        document.getElementById('confirmNewPasswordInput').value = '';
        document.getElementById('currentPasswordInput').focus();
    }

    closeChangePasswordModal() {
        document.getElementById('changePasswordModal').classList.remove('active');
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPasswordInput').value;
        const newPassword = document.getElementById('newPasswordInput').value;
        const confirmPassword = document.getElementById('confirmNewPasswordInput').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showError('请填写所有密码字段');
            return;
        }

        if (newPassword.length < 6) {
            this.showError('新密码至少需要6个字符');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showError('两次输入的新密码不一致');
            return;
        }

        if (newPassword === currentPassword) {
            this.showError('新密码不能与当前密码相同');
            return;
        }

        try {
            const tokenData = localStorage.getItem('cloudDriveToken') || sessionStorage.getItem('cloudDriveToken');
            const loginData = tokenData ? JSON.parse(tokenData) : null;
            const token = loginData ? loginData.token : '';

            const response = await fetch('api/auth.php?action=change_password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('✅ 密码修改成功！请使用新密码重新登录');
                this.closeChangePasswordModal();
                
                // 延迟后退出登录
                setTimeout(() => {
                    this.logout();
                }, 2000);
            } else {
                this.showError(data.error || '密码修改失败');
            }
        } catch (error) {
            console.error('修改密码失败:', error);
            this.showError('密码修改失败，请稍后重试');
        }
    }

    async deleteShare(shareId) {
        if (!confirm('确定要删除此外链吗？')) {
            return;
        }

        try {
            const response = await fetch(`${SHARE_API_URL}?action=delete_share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: shareId })
            });

            const data = await response.json();

            if (data.success) {
                this.loadShares();
                this.showSuccess('外链已删除');
            } else {
                throw new Error(data.error || '删除失败');
            }
        } catch (error) {
            console.error('删除外链失败:', error);
            this.showError('删除外链失败，请重试');
        }
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

const cloudDrive = new CloudDrive();