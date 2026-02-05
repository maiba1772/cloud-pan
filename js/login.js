class LoginPage {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkFirstLogin();
    }

    bindEvents() {
        // 登录表单提交
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // 显示/隐藏密码
        document.getElementById('togglePassword').addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        // 忘记密码
        document.getElementById('forgotPassword').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });

        // 强制修改密码
        document.getElementById('confirmChangePassword').addEventListener('click', () => {
            this.handleChangePassword();
        });

        // 新密码输入时检查强度
        document.getElementById('newPassword').addEventListener('input', (e) => {
            this.checkPasswordStrength(e.target.value);
        });
    }

    async handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!username || !password) {
            this.showError('请输入用户名和密码');
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch('api/auth.php?action=login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (data.success) {
                // 保存登录状态
                this.saveLoginState(data.token, data.user, rememberMe);
                
                // 检查是否需要强制修改密码
                if (data.user.require_password_change) {
                    this.showChangePasswordModal(username);
                } else {
                    // 跳转到主界面
                    window.location.href = 'index.html';
                }
            } else {
                this.showError(data.error || '登录失败，请检查用户名和密码');
            }
        } catch (error) {
            console.error('登录失败:', error);
            this.showError('登录失败，请稍后重试');
        } finally {
            this.setLoading(false);
        }
    }

    saveLoginState(token, user, rememberMe) {
        const loginData = {
            token: token,
            user: user,
            loginTime: new Date().toISOString()
        };

        if (rememberMe) {
            localStorage.setItem('cloudDriveToken', JSON.stringify(loginData));
        } else {
            sessionStorage.setItem('cloudDriveToken', JSON.stringify(loginData));
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        const errorText = errorDiv.querySelector('.error-text');
        errorText.textContent = message;
        errorDiv.style.display = 'flex';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }

    setLoading(loading) {
        const loginBtn = document.getElementById('loginBtn');
        const btnText = loginBtn.querySelector('.btn-text');
        const btnLoading = loginBtn.querySelector('.btn-loading');

        loginBtn.disabled = loading;
        btnText.style.display = loading ? 'none' : 'inline';
        btnLoading.style.display = loading ? 'inline' : 'none';
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const toggleBtn = document.getElementById('togglePassword');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = '👁️';
        }
    }

    handleForgotPassword() {
        alert('请联系管理员重置密码');
    }

    checkFirstLogin() {
        // 检查是否是首次登录（从安装页面跳转过来）
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('first') === 'true') {
            document.getElementById('username').value = 'admin';
            document.getElementById('password').value = 'admin';
            this.showError('请使用默认账号登录，首次登录后需要修改密码');
        }
    }

    showChangePasswordModal(username) {
        const modal = document.getElementById('forceChangePasswordModal');
        document.getElementById('currentPassword').value = 'admin';
        modal.style.display = 'flex';
    }

    checkPasswordStrength(password) {
        const strengthBar = document.getElementById('passwordStrength');
        const strengthBarInner = strengthBar.querySelector('.strength-bar');
        const strengthText = strengthBar.querySelector('.strength-text');

        // 检查各项要求
        const hasLength = password.length >= 6;
        const hasNumber = /\d/.test(password);
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        // 更新要求列表
        this.updateRequirement('req-length', hasLength);
        this.updateRequirement('req-number', hasNumber);
        this.updateRequirement('req-letter', hasLetter);
        this.updateRequirement('req-special', hasSpecial);

        // 计算强度
        let strength = 0;
        if (hasLength) strength++;
        if (hasNumber) strength++;
        if (hasLetter) strength++;
        if (hasSpecial) strength++;

        // 更新强度条
        strengthBarInner.className = 'strength-bar';
        if (strength <= 1) {
            strengthBarInner.classList.add('weak');
            strengthText.textContent = '密码强度：弱';
            strengthText.style.color = '#dc3545';
        } else if (strength <= 3) {
            strengthBarInner.classList.add('medium');
            strengthText.textContent = '密码强度：中';
            strengthText.style.color = '#ffc107';
        } else {
            strengthBarInner.classList.add('strong');
            strengthText.textContent = '密码强度：强';
            strengthText.style.color = '#28a745';
        }
    }

    updateRequirement(id, met) {
        const element = document.getElementById(id);
        if (met) {
            element.classList.add('met');
            element.classList.remove('not-met');
            element.textContent = '✓ ' + element.textContent.substring(2);
        } else {
            element.classList.remove('met');
            element.classList.add('not-met');
            element.textContent = '○ ' + element.textContent.substring(2);
        }
    }

    async handleChangePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // 验证密码
        if (!newPassword || !confirmPassword) {
            alert('请填写所有密码字段');
            return;
        }

        if (newPassword.length < 6) {
            alert('新密码至少需要6个字符');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('两次输入的新密码不一致');
            return;
        }

        if (newPassword === currentPassword) {
            alert('新密码不能与当前密码相同');
            return;
        }

        try {
            const response = await fetch('api/auth.php?action=change_password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ 密码修改成功！请使用新密码重新登录');
                // 清除登录状态
                localStorage.removeItem('cloudDriveToken');
                sessionStorage.removeItem('cloudDriveToken');
                // 刷新页面
                window.location.reload();
            } else {
                alert('❌ ' + (data.error || '密码修改失败'));
            }
        } catch (error) {
            console.error('修改密码失败:', error);
            alert('❌ 密码修改失败，请稍后重试');
        }
    }
}

// 初始化登录页面
const loginPage = new LoginPage();
