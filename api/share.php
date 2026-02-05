<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../data/php_error.log');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/../data/';
$sharesFile = $dataDir . 'shares.json';
$filesFile = $dataDir . 'files.json';
$accessLogFile = $dataDir . 'access.log';

if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

if (!file_exists($sharesFile)) {
    file_put_contents($sharesFile, json_encode([]));
}

function logAccess($token, $action, $details = []) {
    global $accessLogFile;
    $logEntry = [
        'timestamp' => date('Y-m-d H:i:s'),
        'token' => $token,
        'action' => $action,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'details' => $details
    ];
    $logLine = json_encode($logEntry) . "\n";
    file_put_contents($accessLogFile, $logLine, FILE_APPEND);
}

function validateDirectoryPath($path) {
    if (empty($path)) {
        return true;
    }
    
    if (strpos($path, '..') !== false) {
        return false;
    }
    
    if (strpos($path, './') !== false) {
        return false;
    }
    
    if (strpos($path, '\\') !== false) {
        return false;
    }
    
    if (preg_match('/[^\w\-\/]/', $path)) {
        return false;
    }
    
    return true;
}

function isDirectoryInAllowedPath($directoryId, $rootDirectoryId, $directories) {
    if (empty($rootDirectoryId)) {
        return true;
    }
    
    if ($directoryId === $rootDirectoryId) {
        return true;
    }
    
    $currentDir = $directoryId;
    $visited = [];
    
    while ($currentDir && !in_array($currentDir, $visited)) {
        $visited[] = $currentDir;
        
        if ($currentDir === $rootDirectoryId) {
            return true;
        }
        
        $found = false;
        foreach ($directories as $dir) {
            if ($dir['id'] === $currentDir) {
                $currentDir = $dir['parent'] ?? '';
                $found = true;
                break;
            }
        }
        
        if (!$found) {
            break;
        }
    }
    
    return false;
}

function getSharesData() {
    global $sharesFile;
    $content = file_get_contents($sharesFile);
    return json_decode($content, true) ?: [];
}

function saveSharesData($data) {
    global $sharesFile;
    file_put_contents($sharesFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function getFilesData() {
    global $filesFile;
    $content = file_get_contents($filesFile);
    return json_decode($content, true) ?: ['files' => [], 'trash' => []];
}

function formatFileSize($bytes) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, 2) . ' ' . $units[$pow];
}

function getFileIcon($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $icons = [
        'pdf' => '📄',
        'doc' => '📝',
        'docx' => '📝',
        'xls' => '📊',
        'xlsx' => '📊',
        'ppt' => '📽️',
        'pptx' => '📽️',
        'jpg' => '🖼️',
        'jpeg' => '🖼️',
        'png' => '🖼️',
        'gif' => '🖼️',
        'webp' => '🖼️',
        'svg' => '🖼️',
        'mp4' => '🎬',
        'webm' => '🎬',
        'ogg' => '🎬',
        'mp3' => '🎵',
        'wav' => '🎵',
        'zip' => '📦',
        'rar' => '📦',
        'txt' => '📃',
        'default' => '📁'
    ];
    return $icons[$ext] ?? $icons['default'];
}

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'create_share':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $name = $input['name'] ?? '';
            $password = $input['password'] ?? '';
            $rootDirectoryId = $input['root_directory'] ?? '';
            $allowDelete = $input['allow_delete'] ?? false;
            $allowDownload = $input['allow_download'] ?? true;
            $allowPreview = $input['allow_preview'] ?? true;
            $allowUpload = $input['allow_upload'] ?? false;

            if (empty($name)) {
                throw new Exception('分享名称不能为空');
            }

            $filesData = getFilesData();
            $directories = $filesData['directories'] ?? [];

            if (!empty($rootDirectoryId)) {
                $directoryExists = false;
                foreach ($directories as $dir) {
                    if ($dir['id'] === $rootDirectoryId) {
                        $directoryExists = true;
                        break;
                    }
                }
                if (!$directoryExists) {
                    throw new Exception('指定的目录不存在');
                }
            }

            $shares = getSharesData();
            $shareId = uniqid('share_');
            $shareToken = bin2hex(random_bytes(16));

            $shareData = [
                'id' => $shareId,
                'token' => $shareToken,
                'name' => $name,
                'password' => $password ? password_hash($password, PASSWORD_DEFAULT) : '',
                'root_directory' => $rootDirectoryId,
                'allow_delete' => $allowDelete,
                'allow_download' => $allowDownload,
                'allow_preview' => $allowPreview,
                'allow_upload' => $allowUpload,
                'created_at' => date('Y-m-d H:i:s'),
                'files' => [],
                'directories' => []
            ];

            $shares[$shareId] = $shareData;
            saveSharesData($shares);

            logAccess($shareToken, 'create_share', [
                'share_id' => $shareId,
                'root_directory' => $rootDirectoryId,
                'permissions' => [
                    'delete' => $allowDelete,
                    'download' => $allowDownload,
                    'preview' => $allowPreview,
                    'upload' => $allowUpload
                ]
            ]);

            $baseUrl = 'http://' . $_SERVER['HTTP_HOST'];
            $shareUrl = $baseUrl . '/share.html?token=' . $shareToken;

            echo json_encode([
                'success' => true,
                'share' => [
                    'id' => $shareId,
                    'name' => $name,
                    'token' => $shareToken,
                    'url' => $shareUrl,
                    'created_at' => $shareData['created_at']
                ]
            ]);
            break;

        case 'get_shares':
            $shares = getSharesData();
            $shareList = [];

            foreach ($shares as $shareId => $share) {
                $shareList[] = [
                    'id' => $shareId,
                    'name' => $share['name'],
                    'token' => $share['token'],
                    'root_directory' => $share['root_directory'] ?? '',
                    'has_password' => !empty($share['password']),
                    'allow_delete' => $share['allow_delete'],
                    'allow_download' => $share['allow_download'],
                    'allow_preview' => $share['allow_preview'],
                    'allow_upload' => $share['allow_upload'],
                    'created_at' => $share['created_at'],
                    'files_count' => count($share['files']),
                    'directories_count' => count($share['directories'])
                ];
            }

            echo json_encode([
                'success' => true,
                'shares' => $shareList
            ]);
            break;

        case 'get_share':
            $token = $_GET['token'] ?? '';

            if (empty($token)) {
                throw new Exception('Token is required');
            }

            $shares = getSharesData();
            $share = null;

            foreach ($shares as $shareData) {
                if ($shareData['token'] === $token) {
                    $share = $shareData;
                    break;
                }
            }

            if (!$share) {
                logAccess($token, 'access_denied', ['reason' => 'share_not_found']);
                throw new Exception('分享不存在');
            }

            $filesData = getFilesData();
            $rootDirectoryName = '';
            
            if (!empty($share['root_directory'])) {
                foreach (($filesData['directories'] ?? []) as $dir) {
                    if ($dir['id'] === $share['root_directory']) {
                        $rootDirectoryName = $dir['name'];
                        break;
                    }
                }
            }

            logAccess($token, 'get_share', ['share_id' => $share['id']]);

            echo json_encode([
                'success' => true,
                'share' => [
                    'id' => $share['id'],
                    'name' => $share['name'],
                    'root_directory' => $share['root_directory'] ?? '',
                    'root_directory_name' => $rootDirectoryName,
                    'has_password' => !empty($share['password']),
                    'allow_delete' => $share['allow_delete'],
                    'allow_download' => $share['allow_download'],
                    'allow_preview' => $share['allow_preview'],
                    'allow_upload' => $share['allow_upload'],
                    'created_at' => $share['created_at']
                ]
            ]);
            break;

        case 'verify_password':
            $token = $_GET['token'] ?? '';
            $input = json_decode(file_get_contents('php://input'), true);
            $password = $input['password'] ?? '';

            if (empty($token)) {
                throw new Exception('Token is required');
            }

            $shares = getSharesData();
            $share = null;

            foreach ($shares as $shareData) {
                if ($shareData['token'] === $token) {
                    $share = $shareData;
                    break;
                }
            }

            if (!$share) {
                throw new Exception('分享不存在');
            }

            if (empty($share['password'])) {
                echo json_encode(['success' => true, 'verified' => true]);
                break;
            }

            $verified = password_verify($password, $share['password']);

            echo json_encode([
                'success' => true,
                'verified' => $verified
            ]);
            break;

        case 'get_files':
            $token = $_GET['token'] ?? '';
            $directory = $_GET['directory'] ?? '';

            if (empty($token)) {
                throw new Exception('Token is required');
            }

            if (!validateDirectoryPath($directory)) {
                logAccess($token, 'path_traversal_attempt', [
                    'directory' => $directory,
                    'reason' => 'invalid_path_characters'
                ]);
                throw new Exception('非法的目录路径');
            }

            $shares = getSharesData();
            $share = null;

            foreach ($shares as $shareData) {
                if ($shareData['token'] === $token) {
                    $share = $shareData;
                    break;
                }
            }

            if (!$share) {
                logAccess($token, 'access_denied', ['reason' => 'share_not_found']);
                throw new Exception('分享不存在');
            }

            $rootDirectoryId = $share['root_directory'] ?? '';

            if (!empty($directory)) {
                $filesData = getFilesData();
                $directories = $filesData['directories'] ?? [];
                
                if (!isDirectoryInAllowedPath($directory, $rootDirectoryId, $directories)) {
                    logAccess($token, 'path_traversal_attempt', [
                        'requested_directory' => $directory,
                        'root_directory' => $rootDirectoryId,
                        'reason' => 'directory_not_in_allowed_path'
                    ]);
                    throw new Exception('无法访问此目录');
                }
            }

            $files = [];
            $directories = [];

            if (empty($directory)) {
                if (empty($rootDirectoryId)) {
                    $filesData = getFilesData();
                    foreach (($filesData['files'] ?? []) as $file) {
                        if (empty($file['directory'])) {
                            $files[] = $file;
                        }
                    }
                    foreach (($filesData['directories'] ?? []) as $dir) {
                        if (empty($dir['parent'])) {
                            $directories[] = $dir;
                        }
                    }
                } else {
                    $filesData = getFilesData();
                    foreach (($filesData['files'] ?? []) as $file) {
                        if ($file['directory'] === $rootDirectoryId) {
                            $files[] = $file;
                        }
                    }
                    foreach (($filesData['directories'] ?? []) as $dir) {
                        if ($dir['parent'] === $rootDirectoryId) {
                            $directories[] = $dir;
                        }
                    }
                }
            } else {
                $filesData = getFilesData();
                foreach (($filesData['files'] ?? []) as $file) {
                    if ($file['directory'] === $directory) {
                        $files[] = $file;
                    }
                }
                foreach (($filesData['directories'] ?? []) as $dir) {
                    if ($dir['parent'] === $directory) {
                        $directories[] = $dir;
                    }
                }
            }

            logAccess($token, 'list_files', [
                'directory' => $directory,
                'files_count' => count($files),
                'directories_count' => count($directories)
            ]);

            echo json_encode([
                'success' => true,
                'files' => $files,
                'directories' => $directories,
                'current_directory' => $directory,
                'root_directory' => $rootDirectoryId
            ]);
            break;

        case 'add_file':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $token = $_GET['token'] ?? '';
            $input = json_decode(file_get_contents('php://input'), true);
            $fileId = $input['file_id'] ?? '';
            $directory = $input['directory'] ?? '';

            if (empty($token)) {
                throw new Exception('Token is required');
            }

            if (empty($fileId)) {
                throw new Exception('File ID is required');
            }

            $shares = getSharesData();
            $shareId = null;

            foreach ($shares as $id => $shareData) {
                if ($shareData['token'] === $token) {
                    $shareId = $id;
                    break;
                }
            }

            if (!$shareId) {
                throw new Exception('分享不存在');
            }

            $filesData = getFilesData();
            $file = null;

            foreach ($filesData['files'] as $f) {
                if ($f['id'] === $fileId) {
                    $file = $f;
                    break;
                }
            }

            if (!$file) {
                throw new Exception('文件不存在');
            }

            $shareFile = [
                'id' => $file['id'],
                'name' => $file['name'],
                'size' => $file['size'],
                'size_formatted' => $file['size_formatted'],
                'icon' => $file['icon'],
                'url' => $file['url'],
                'download_url' => $file['download_url'],
                'uploaded_at' => $file['uploaded_at'],
                'directory' => $directory
            ];

            $shares[$shareId]['files'][] = $shareFile;
            saveSharesData($shares);

            echo json_encode([
                'success' => true,
                'file' => $shareFile
            ]);
            break;

        case 'create_directory':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $token = $_GET['token'] ?? '';
            $input = json_decode(file_get_contents('php://input'), true);
            $name = $input['name'] ?? '';
            $parent = $input['parent'] ?? '';

            if (empty($token)) {
                throw new Exception('Token is required');
            }

            if (empty($name)) {
                throw new Exception('目录名称不能为空');
            }

            $shares = getSharesData();
            $shareId = null;

            foreach ($shares as $id => $shareData) {
                if ($shareData['token'] === $token) {
                    $shareId = $id;
                    break;
                }
            }

            if (!$shareId) {
                throw new Exception('分享不存在');
            }

            $directoryId = uniqid('dir_');
            $directory = [
                'id' => $directoryId,
                'name' => $name,
                'parent' => $parent,
                'created_at' => date('Y-m-d H:i:s')
            ];

            $shares[$shareId]['directories'][] = $directory;
            saveSharesData($shares);

            echo json_encode([
                'success' => true,
                'directory' => $directory
            ]);
            break;

        case 'delete_share':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $shareId = $input['id'] ?? '';

            if (empty($shareId)) {
                throw new Exception('Share ID is required');
            }

            $shares = getSharesData();

            if (!isset($shares[$shareId])) {
                throw new Exception('分享不存在');
            }

            unset($shares[$shareId]);
            saveSharesData($shares);

            echo json_encode(['success' => true]);
            break;

        case 'delete_file':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $token = $_GET['token'] ?? '';
            $input = json_decode(file_get_contents('php://input'), true);
            $fileId = $input['file_id'] ?? '';

            if (empty($token)) {
                throw new Exception('Token is required');
            }

            if (empty($fileId)) {
                throw new Exception('File ID is required');
            }

            $shares = getSharesData();
            $shareId = null;

            foreach ($shares as $id => $shareData) {
                if ($shareData['token'] === $token) {
                    $shareId = $id;
                    break;
                }
            }

            if (!$shareId) {
                logAccess($token, 'access_denied', ['reason' => 'share_not_found']);
                throw new Exception('分享不存在');
            }

            if (!$shares[$shareId]['allow_delete']) {
                logAccess($token, 'permission_denied', [
                    'action' => 'delete_file',
                    'file_id' => $fileId,
                    'reason' => 'delete_not_allowed'
                ]);
                throw new Exception('此分享不允许删除文件');
            }

            $fileIndex = -1;
            foreach ($shares[$shareId]['files'] as $index => $file) {
                if ($file['id'] === $fileId) {
                    $fileIndex = $index;
                    break;
                }
            }

            if ($fileIndex === -1) {
                logAccess($token, 'file_not_found', ['file_id' => $fileId]);
                throw new Exception('文件不存在');
            }

            array_splice($shares[$shareId]['files'], $fileIndex, 1);
            saveSharesData($shares);

            logAccess($token, 'delete_file', ['file_id' => $fileId]);

            echo json_encode(['success' => true]);
            break;

        case 'delete_directory':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $token = $_GET['token'] ?? '';
            $input = json_decode(file_get_contents('php://input'), true);
            $directoryId = $input['directory_id'] ?? '';

            if (empty($token)) {
                throw new Exception('Token is required');
            }

            if (empty($directoryId)) {
                throw new Exception('Directory ID is required');
            }

            $shares = getSharesData();
            $shareId = null;

            foreach ($shares as $id => $shareData) {
                if ($shareData['token'] === $token) {
                    $shareId = $id;
                    break;
                }
            }

            if (!$shareId) {
                logAccess($token, 'access_denied', ['reason' => 'share_not_found']);
                throw new Exception('分享不存在');
            }

            if (!$shares[$shareId]['allow_delete']) {
                logAccess($token, 'permission_denied', [
                    'action' => 'delete_directory',
                    'directory_id' => $directoryId,
                    'reason' => 'delete_not_allowed'
                ]);
                throw new Exception('此分享不允许删除目录');
            }

            $rootDirectoryId = $shares[$shareId]['root_directory'] ?? '';

            $filesData = getFilesData();
            $directories = $filesData['directories'] ?? [];

            if (!isDirectoryInAllowedPath($directoryId, $rootDirectoryId, $directories)) {
                logAccess($token, 'path_traversal_attempt', [
                    'directory_id' => $directoryId,
                    'root_directory' => $rootDirectoryId,
                    'reason' => 'directory_not_in_allowed_path'
                ]);
                throw new Exception('无法删除此目录');
            }

            $dirIndex = -1;
            foreach ($shares[$shareId]['directories'] as $index => $dir) {
                if ($dir['id'] === $directoryId) {
                    $dirIndex = $index;
                    break;
                }
            }

            if ($dirIndex === -1) {
                logAccess($token, 'directory_not_found', ['directory_id' => $directoryId]);
                throw new Exception('目录不存在');
            }

            $directoryToDelete = $shares[$shareId]['directories'][$dirIndex];

            $directoriesToDelete = [$directoryId];
            $queue = [$directoryId];

            while (!empty($queue)) {
                $currentDirId = array_shift($queue);
                foreach ($shares[$shareId]['directories'] as $dir) {
                    if ($dir['parent'] === $currentDirId && !in_array($dir['id'], $directoriesToDelete)) {
                        $directoriesToDelete[] = $dir['id'];
                        $queue[] = $dir['id'];
                    }
                }
            }

            $shares[$shareId]['directories'] = array_filter($shares[$shareId]['directories'], function($dir) use ($directoriesToDelete) {
                return !in_array($dir['id'], $directoriesToDelete);
            });

            $shares[$shareId]['files'] = array_filter($shares[$shareId]['files'], function($file) use ($directoriesToDelete) {
                return !in_array($file['directory'], $directoriesToDelete);
            });

            saveSharesData($shares);

            logAccess($token, 'delete_directory', [
                'directory_id' => $directoryId,
                'deleted_count' => count($directoriesToDelete)
            ]);

            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
