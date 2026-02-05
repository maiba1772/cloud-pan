<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../data/php_error.log');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/../data/';
$usersFile = $dataDir . 'users.json';
$configFile = $dataDir . 'config.json';

// 确保数据目录存在
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

// 初始化用户数据
function initUsers() {
    global $usersFile;
    if (!file_exists($usersFile)) {
        $defaultUsers = [
            'users' => [
                [
                    'id' => 'admin',
                    'username' => 'admin',
                    'password' => password_hash('admin', PASSWORD_DEFAULT),
                    'role' => 'admin',
                    'created_at' => date('Y-m-d H:i:s'),
                    'require_password_change' => true,
                    'last_login' => null
                ]
            ]
        ];
        file_put_contents($usersFile, json_encode($defaultUsers, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

// 获取用户数据
function getUsers() {
    global $usersFile;
    initUsers();
    $content = file_get_contents($usersFile);
    return json_decode($content, true) ?: ['users' => []];
}

// 保存用户数据
function saveUsers($data) {
    global $usersFile;
    file_put_contents($usersFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// 生成 JWT Token
function generateToken($user) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $time = time();
    $payload = json_encode([
        'iss' => 'cloud_drive',
        'iat' => $time,
        'exp' => $time + (24 * 60 * 60), // 24小时过期
        'sub' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role']
    ]);
    
    $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    
    $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, 'cloud_drive_secret', true);
    $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    return $base64Header . "." . $base64Payload . "." . $base64Signature;
}

// 验证 Token
function verifyToken($token) {
    if (empty($token)) {
        return false;
    }
    
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }
    
    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
    if (!$payload || !isset($payload['exp'])) {
        return false;
    }
    
    if ($payload['exp'] < time()) {
        return false;
    }
    
    return $payload;
}

// 获取请求数据
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($action) {
        case 'login':
            if ($method !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $username = $input['username'] ?? '';
            $password = $input['password'] ?? '';
            
            if (empty($username) || empty($password)) {
                throw new Exception('用户名和密码不能为空');
            }
            
            $users = getUsers();
            $user = null;
            
            foreach ($users['users'] as $u) {
                if ($u['username'] === $username) {
                    $user = $u;
                    break;
                }
            }
            
            if (!$user || !password_verify($password, $user['password'])) {
                throw new Exception('用户名或密码错误');
            }
            
            // 更新最后登录时间
            $user['last_login'] = date('Y-m-d H:i:s');
            foreach ($users['users'] as &$u) {
                if ($u['id'] === $user['id']) {
                    $u['last_login'] = $user['last_login'];
                    break;
                }
            }
            saveUsers($users);
            
            $token = generateToken($user);
            
            echo json_encode([
                'success' => true,
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'role' => $user['role'],
                    'require_password_change' => $user['require_password_change'] ?? false
                ]
            ]);
            break;
            
        case 'logout':
            echo json_encode([
                'success' => true,
                'message' => '退出登录成功'
            ]);
            break;
            
        case 'change_password':
            if ($method !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $currentPassword = $input['current_password'] ?? '';
            $newPassword = $input['new_password'] ?? '';
            
            if (empty($currentPassword) || empty($newPassword)) {
                throw new Exception('请填写所有密码字段');
            }
            
            if (strlen($newPassword) < 6) {
                throw new Exception('新密码至少需要6个字符');
            }
            
            // 获取当前登录用户
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? '';
            $token = str_replace('Bearer ', '', $authHeader);
            
            $payload = verifyToken($token);
            if (!$payload) {
                throw new Exception('未登录或登录已过期');
            }
            
            $users = getUsers();
            $user = null;
            $userIndex = -1;
            
            foreach ($users['users'] as $index => $u) {
                if ($u['id'] === $payload['sub']) {
                    $user = $u;
                    $userIndex = $index;
                    break;
                }
            }
            
            if (!$user) {
                throw new Exception('用户不存在');
            }
            
            if (!password_verify($currentPassword, $user['password'])) {
                throw new Exception('当前密码错误');
            }
            
            // 更新密码
            $users['users'][$userIndex]['password'] = password_hash($newPassword, PASSWORD_DEFAULT);
            $users['users'][$userIndex]['require_password_change'] = false;
            $users['users'][$userIndex]['password_changed_at'] = date('Y-m-d H:i:s');
            
            saveUsers($users);
            
            echo json_encode([
                'success' => true,
                'message' => '密码修改成功'
            ]);
            break;
            
        case 'verify':
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? '';
            $token = str_replace('Bearer ', '', $authHeader);
            
            $payload = verifyToken($token);
            
            if ($payload) {
                echo json_encode([
                    'success' => true,
                    'user' => [
                        'id' => $payload['sub'],
                        'username' => $payload['username'],
                        'role' => $payload['role']
                    ]
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => 'Token无效或已过期'
                ]);
            }
            break;
            
        case 'get_users':
            // 管理员获取所有用户
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? '';
            $token = str_replace('Bearer ', '', $authHeader);
            
            $payload = verifyToken($token);
            if (!$payload || $payload['role'] !== 'admin') {
                throw new Exception('权限不足');
            }
            
            $users = getUsers();
            $userList = [];
            
            foreach ($users['users'] as $u) {
                $userList[] = [
                    'id' => $u['id'],
                    'username' => $u['username'],
                    'role' => $u['role'],
                    'created_at' => $u['created_at'],
                    'last_login' => $u['last_login'],
                    'require_password_change' => $u['require_password_change'] ?? false
                ];
            }
            
            echo json_encode([
                'success' => true,
                'users' => $userList
            ]);
            break;
            
        case 'create_user':
            if ($method !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            // 验证管理员权限
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? '';
            $token = str_replace('Bearer ', '', $authHeader);
            
            $payload = verifyToken($token);
            if (!$payload || $payload['role'] !== 'admin') {
                throw new Exception('权限不足');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $username = $input['username'] ?? '';
            $password = $input['password'] ?? '';
            $role = $input['role'] ?? 'user';
            
            if (empty($username) || empty($password)) {
                throw new Exception('用户名和密码不能为空');
            }
            
            if (strlen($password) < 6) {
                throw new Exception('密码至少需要6个字符');
            }
            
            $users = getUsers();
            
            // 检查用户名是否已存在
            foreach ($users['users'] as $u) {
                if ($u['username'] === $username) {
                    throw new Exception('用户名已存在');
                }
            }
            
            $newUser = [
                'id' => uniqid('user_'),
                'username' => $username,
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'role' => $role,
                'created_at' => date('Y-m-d H:i:s'),
                'require_password_change' => true,
                'last_login' => null
            ];
            
            $users['users'][] = $newUser;
            saveUsers($users);
            
            echo json_encode([
                'success' => true,
                'message' => '用户创建成功',
                'user' => [
                    'id' => $newUser['id'],
                    'username' => $newUser['username'],
                    'role' => $newUser['role']
                ]
            ]);
            break;
            
        case 'reset_password':
            if ($method !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            // 验证管理员权限
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? '';
            $token = str_replace('Bearer ', '', $authHeader);
            
            $payload = verifyToken($token);
            if (!$payload || $payload['role'] !== 'admin') {
                throw new Exception('权限不足');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $userId = $input['user_id'] ?? '';
            $newPassword = $input['new_password'] ?? '';
            
            if (empty($userId) || empty($newPassword)) {
                throw new Exception('请提供用户ID和新密码');
            }
            
            if (strlen($newPassword) < 6) {
                throw new Exception('密码至少需要6个字符');
            }
            
            $users = getUsers();
            $found = false;
            
            foreach ($users['users'] as &$u) {
                if ($u['id'] === $userId) {
                    $u['password'] = password_hash($newPassword, PASSWORD_DEFAULT);
                    $u['require_password_change'] = true;
                    $u['password_reset_at'] = date('Y-m-d H:i:s');
                    $found = true;
                    break;
                }
            }
            
            if (!$found) {
                throw new Exception('用户不存在');
            }
            
            saveUsers($users);
            
            echo json_encode([
                'success' => true,
                'message' => '密码重置成功，用户下次登录需要修改密码'
            ]);
            break;
            
        default:
            throw new Exception('Unknown action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
