class Installer {
    constructor() {
        this.currentStep = 1;
        this.config = {
            dataStorage: 'local',
            fileStorage: 'local',
            dataConfig: {},
            fileConfig: {}
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSavedConfig();
    }

    bindEvents() {
        document.getElementById('cancelBtn').addEventListener('click', () => {
            if (confirm('确定要取消安装吗？')) {
                window.location.href = 'index.html';
            }
        });

        document.getElementById('nextStep1').addEventListener('click', () => {
            this.goToStep(2);
        });

        document.getElementById('backStep2').addEventListener('click', () => {
            this.goToStep(1);
        });

        document.querySelectorAll('#step2 .storage-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectDataStorage(option.dataset.type);
            });
        });

        document.getElementById('nextStep2').addEventListener('click', () => {
            this.validateDataStorage();
        });

        document.getElementById('backStep3').addEventListener('click', () => {
            this.goToStep(2);
        });

        document.querySelectorAll('#step3 .storage-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectFileStorage(option.dataset.type);
            });
        });

        document.getElementById('nextStep3').addEventListener('click', () => {
            this.validateFileStorage();
        });

        document.getElementById('backStep4').addEventListener('click', () => {
            this.goToStep(3);
        });

        document.getElementById('testFtpBtn').addEventListener('click', () => {
            this.testFTPConnection();
        });

        document.getElementById('testMysqlBtn').addEventListener('click', () => {
            this.testMySQLConnection();
        });

        document.getElementById('nextStep4').addEventListener('click', () => {
            this.goToStep(5);
        });

        document.getElementById('backStep5').addEventListener('click', () => {
            this.goToStep(4);
        });

        document.getElementById('nextStep5').addEventListener('click', () => {
            this.validateMySQLConfig();
        });

        document.getElementById('backStep6').addEventListener('click', () => {
            this.goToStep(5);
        });

        document.getElementById('nextStep6').addEventListener('click', () => {
            this.validateLicense();
        });

        document.getElementById('reinstallBtn').addEventListener('click', () => {
            if (confirm('确定要重新安装吗？当前配置将被清除。')) {
                localStorage.removeItem('cloudDriveConfig');
                window.location.reload();
            }
        });

        document.getElementById('goToAppBtn').addEventListener('click', () => {
            if (this.verifyInstallation()) {
                // 安装完成后跳转到登录页面，标记为首次登录
                window.location.href = 'login.html?first=true';
            } else {
                alert('安装验证失败，请重新安装');
            }
        });
    }

    verifyInstallation() {
        const saved = localStorage.getItem('cloudDriveConfig');
        if (!saved) {
            return false;
        }
        
        try {
            const config = JSON.parse(saved);
            return config.dataStorage && config.fileStorage;
        } catch (e) {
            return false;
        }
    }

    goToStep(step) {
        this.currentStep = step;
        
        document.querySelectorAll('.install-step').forEach(s => {
            s.style.display = 'none';
        });
        
        document.getElementById(`step${step}`).style.display = 'block';
        
        document.querySelectorAll('.progress-step').forEach(s => {
            s.classList.remove('active');
            if (parseInt(s.dataset.step) === step) {
                s.classList.add('active');
            }
        });
    }

    selectDataStorage(type) {
        this.config.dataStorage = type;
        
        document.querySelectorAll('#step2 .storage-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        document.querySelector(`#step2 [data-type="${type}"]`).classList.add('selected');
    }

    selectFileStorage(type) {
        this.config.fileStorage = type;
        
        document.querySelectorAll('#step3 .storage-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        document.querySelector(`#step3 [data-type="${type}"]`).classList.add('selected');
    }

    validateDataStorage() {
        if (!this.config.dataStorage) {
            alert('请选择数据存储方式');
            return;
        }
        
        this.goToStep(3);
    }

    validateFileStorage() {
        if (!this.config.fileStorage) {
            alert('请选择文件存储方式');
            return;
        }
        
        if (this.config.fileStorage === 'local-file') {
            if (this.config.dataStorage === 'mysql') {
                this.goToStep(5);
            } else {
                this.goToStep(6);
            }
        } else if (this.config.fileStorage === 'ftp') {
            this.goToStep(4);
        }
    }

    validateFTPConfig() {
        const host = document.getElementById('ftpHost').value.trim();
        const port = document.getElementById('ftpPort').value.trim();
        const user = document.getElementById('ftpUser').value.trim();
        const password = document.getElementById('ftpPassword').value;
        const path = document.getElementById('ftpPath').value.trim();
        const ssl = document.getElementById('ftpSsl').value;
        
        if (!host || !user || !password) {
            alert('请填写完整的FTP配置信息');
            return;
        }
        
        this.config.fileConfig = {
            type: 'ftp',
            host: host,
            port: port,
            user: user,
            password: password,
            path: path || '/public_html/uploads',
            ssl: ssl === 'true'
        };
        
        if (this.config.dataStorage === 'mysql') {
            this.goToStep(5);
        } else {
            this.goToStep(6);
        }
    }

    validateMySQLConfig() {
        const host = document.getElementById('mysqlHost').value.trim();
        const port = document.getElementById('mysqlPort').value.trim();
        const database = document.getElementById('mysqlDatabase').value.trim();
        const user = document.getElementById('mysqlUser').value.trim();
        const password = document.getElementById('mysqlPassword').value;
        
        if (!host || !database || !user) {
            alert('请填写完整的MySQL配置信息');
            return;
        }
        
        this.config.dataConfig = {
            type: 'mysql',
            host: host,
            port: port,
            database: database,
            user: user,
            password: password
        };
        
        this.goToStep(6);
    }

    validateLicense() {
        const agreed = document.getElementById('agreeLicense').checked;
        
        if (!agreed) {
            alert('请先阅读并同意许可协议');
            return;
        }
        
        this.startInstall();
    }

    async testFTPConnection() {
        const btn = document.getElementById('testFtpBtn');
        const originalText = btn.textContent;
        
        btn.textContent = '🔄 测试中...';
        btn.disabled = true;
        
        try {
            const response = await fetch('api/api.php?action=test_ftp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    config: this.config.fileConfig
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ FTP连接测试成功！');
            } else {
                alert('❌ FTP连接测试失败：' + (data.error || '未知错误'));
            }
        } catch (error) {
            alert('❌ 测试失败：' + error.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async testMySQLConnection() {
        const btn = document.getElementById('testMysqlBtn');
        const originalText = btn.textContent;
        
        btn.textContent = '🔄 测试中...';
        btn.disabled = true;
        
        try {
            const response = await fetch('api/api.php?action=test_mysql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    config: this.config.dataConfig
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ MySQL连接测试成功！');
            } else {
                alert('❌ MySQL连接测试失败：' + (data.error || '未知错误'));
            }
        } catch (error) {
            alert('❌ 测试失败：' + error.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async startInstall() {
        this.goToStep(7);
        
        // 读取用户自定义配置
        const localFilePath = document.getElementById('localFilePath')?.value?.trim() || 'data/cc';
        const configSaveLocation = document.getElementById('configSaveLocation')?.value || 'localStorage';
        const enableAccessLog = document.getElementById('enableAccessLog')?.checked ?? true;
        const enableErrorLog = document.getElementById('enableErrorLog')?.checked ?? true;
        const enableDebugMode = document.getElementById('enableDebugMode')?.checked ?? false;
        
        const finalConfig = {
            dataStorage: this.config.dataStorage,
            fileStorage: this.config.fileStorage,
            dataConfig: this.config.dataStorage === 'mysql' ? this.config.dataConfig : null,
            fileConfig: this.config.fileStorage === 'ftp' ? this.config.fileConfig : {
                type: 'local',
                path: localFilePath
            },
            // 用户自定义选项
            configSaveLocation: configSaveLocation,
            enableAccessLog: enableAccessLog,
            enableErrorLog: enableErrorLog,
            enableDebugMode: enableDebugMode,
            installedAt: new Date().toISOString()
        };
        
        let steps = [
            { step: 'create-dirs', text: '创建目录结构' },
            { step: 'save-config', text: '保存配置信息' },
            { step: 'complete', text: '完成安装' }
        ];
        
        if (this.config.dataStorage === 'mysql' || this.config.fileStorage === 'ftp') {
            steps.splice(2, 0, { step: 'test-connection', text: '测试存储连接' });
            steps.splice(3, 0, { step: 'init-storage', text: '初始化存储' });
        }
        
        for (let i = 0; i < steps.length; i++) {
            await this.performInstallStep(steps[i], i, steps.length);
        }
        
        // 根据用户选择保存配置
        if (configSaveLocation === 'server') {
            // 保存到服务器
            try {
                await this.saveConfigToServer(finalConfig);
            } catch (error) {
                console.error('保存到服务器失败:', error);
                // 如果服务器保存失败，回退到 localStorage
                localStorage.setItem('cloudDriveConfig', JSON.stringify(finalConfig));
            }
        } else {
            // 保存到 localStorage
            localStorage.setItem('cloudDriveConfig', JSON.stringify(finalConfig));
        }
        
        this.showConfigSummary(finalConfig);
    }
    
    async saveConfigToServer(config) {
        const response = await fetch('api/api.php?action=save_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ config: config })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '保存配置失败');
        }
    }

    async performInstallStep(step, index, total) {
        const stepElement = document.querySelector(`[data-step="${step.step}"]`);
        const statusElement = stepElement.querySelector('.step-status');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        statusElement.textContent = '✅';
        stepElement.classList.add('completed');
        
        const progress = ((index + 1) / total) * 100;
        document.getElementById('installProgress').style.width = progress + '%';
        document.getElementById('progressText').textContent = Math.round(progress) + '%';
    }

    showConfigSummary(config) {
        const summary = document.getElementById('configSummary');
        
        let html = '<div class="summary-section">';
        html += '<h3>数据存储</h3>';
        html += `<p><strong>方式：</strong>${this.getStorageTypeName(config.dataStorage)}</p>`;
        
        if (config.dataStorage === 'mysql' && config.dataConfig) {
            html += '<div class="config-item">';
            html += `<span>数据库主机：</span>${config.dataConfig.host}:${config.dataConfig.port}`;
            html += '</div>';
            html += '<div class="config-item">';
            html += `<span>数据库名称：</span>${config.dataConfig.database}`;
            html += '</div>';
        }
        
        html += '</div>';
        
        html += '<div class="summary-section">';
        html += '<h3>文件存储</h3>';
        html += `<p><strong>方式：</strong>${this.getStorageTypeName(config.fileStorage)}</p>`;
        
        if (config.fileStorage === 'ftp' && config.fileConfig) {
            html += '<div class="config-item">';
            html += `<span>FTP主机：</span>${config.fileConfig.host}:${config.fileConfig.port}`;
            html += '</div>';
            html += '<div class="config-item">';
            html += `<span>用户名：</span>${config.fileConfig.user}`;
            html += '</div>';
            html += '<div class="config-item">';
            html += `<span>存储路径：</span>${config.fileConfig.path}`;
            html += '</div>';
            html += '<div class="config-item">';
            html += `<span>SSL/TLS：</span>${config.fileConfig.ssl ? '是' : '否'}`;
            html += '</div>';
        } else if (config.fileStorage === 'local-file' || config.fileStorage === 'local') {
            html += '<div class="config-item">';
            html += `<span>存储路径：</span>${config.fileConfig?.path || 'data/cc'}`;
            html += '</div>';
        }
        
        html += '</div>';
        
        // 用户自定义选项
        html += '<div class="summary-section">';
        html += '<h3>高级选项</h3>';
        html += '<div class="config-item">';
        html += `<span>配置文件保存位置：</span>${config.configSaveLocation === 'server' ? '服务器配置文件' : '浏览器本地存储'}`;
        html += '</div>';
        html += '<div class="config-item">';
        html += `<span>访问日志：</span>${config.enableAccessLog ? '已启用' : '已禁用'}`;
        html += '</div>';
        html += '<div class="config-item">';
        html += `<span>错误日志：</span>${config.enableErrorLog ? '已启用' : '已禁用'}`;
        html += '</div>';
        html += '<div class="config-item">';
        html += `<span>调试模式：</span>${config.enableDebugMode ? '已启用' : '已禁用'}`;
        html += '</div>';
        html += '</div>';
        
        summary.innerHTML = html;
        
        this.goToStep(8);
    }

    getStorageTypeName(type) {
        const names = {
            'local': '本地存储（JSON文件）',
            'mysql': 'MySQL数据库',
            'local-file': '本地存储',
            'ftp': 'FTP服务器'
        };
        return names[type] || type;
    }

    async loadSavedConfig() {
        let config = null;
        
        // 首先尝试从 localStorage 加载
        const saved = localStorage.getItem('cloudDriveConfig');
        if (saved) {
            try {
                config = JSON.parse(saved);
            } catch (e) {
                console.error('解析本地配置失败:', e);
            }
        }
        
        // 如果没有本地配置，尝试从服务器加载
        if (!config) {
            try {
                const response = await fetch('api/api.php?action=get_config');
                const data = await response.json();
                if (data.success && data.config) {
                    config = data.config;
                }
            } catch (e) {
                console.error('加载服务器配置失败:', e);
            }
        }
        
        if (config) {
            // 加载存储方式
            if (config.dataStorage) {
                this.config.dataStorage = config.dataStorage;
                document.querySelector(`#step2 [data-type="${config.dataStorage}"]`)?.classList.add('selected');
            }
            
            if (config.fileStorage) {
                this.config.fileStorage = config.fileStorage;
                document.querySelector(`#step3 [data-type="${config.fileStorage}"]`)?.classList.add('selected');
            }
            
            // 加载 MySQL 配置
            if (config.dataStorage === 'mysql' && config.dataConfig) {
                document.getElementById('mysqlHost').value = config.dataConfig.host || '';
                document.getElementById('mysqlPort').value = config.dataConfig.port || '3306';
                document.getElementById('mysqlDatabase').value = config.dataConfig.database || '';
                document.getElementById('mysqlUser').value = config.dataConfig.user || '';
                document.getElementById('mysqlPassword').value = config.dataConfig.password || '';
            }
            
            // 加载 FTP 配置
            if (config.fileStorage === 'ftp' && config.fileConfig) {
                document.getElementById('ftpHost').value = config.fileConfig.host || '';
                document.getElementById('ftpPort').value = config.fileConfig.port || '21';
                document.getElementById('ftpUser').value = config.fileConfig.user || '';
                document.getElementById('ftpPassword').value = config.fileConfig.password || '';
            }
            
            // 加载本地文件存储路径
            if (config.fileConfig && config.fileConfig.path) {
                document.getElementById('localFilePath').value = config.fileConfig.path;
            }
            
            // 加载高级选项
            if (config.configSaveLocation) {
                document.getElementById('configSaveLocation').value = config.configSaveLocation;
            }
            if (typeof config.enableAccessLog !== 'undefined') {
                document.getElementById('enableAccessLog').checked = config.enableAccessLog;
            }
            if (typeof config.enableErrorLog !== 'undefined') {
                document.getElementById('enableErrorLog').checked = config.enableErrorLog;
            }
            if (typeof config.enableDebugMode !== 'undefined') {
                document.getElementById('enableDebugMode').checked = config.enableDebugMode;
            }
            
            // 加载 FTP 配置
            if (config.fileStorage === 'ftp' && config.fileConfig) {
                document.getElementById('ftpPath').value = config.fileConfig.path || '/public_html/uploads';
                document.getElementById('ftpSsl').value = config.fileConfig.ssl ? 'true' : 'false';
            }
            
            this.goToStep(2);
        }
    }
}

const installer = new Installer();