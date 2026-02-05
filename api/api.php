<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../data/php_error.log');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/../data/';
$filesFile = $dataDir . 'files.json';
$uploadsDir = __DIR__ . '/../data/cc/';

if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

if (!file_exists($uploadsDir)) {
    mkdir($uploadsDir, 0777, true);
}

if (!file_exists($filesFile)) {
    file_put_contents($filesFile, json_encode(['files' => [], 'trash' => []]));
}

$configFile = $dataDir . 'config.json';

function getConfig() {
    global $configFile;
    if (!file_exists($configFile)) {
        return ['type' => 'local', 'path' => 'data/cc'];
    }
    $content = file_get_contents($configFile);
    return json_decode($content, true) ?: ['type' => 'local', 'path' => 'data/cc'];
}

function saveConfig($config) {
    global $configFile;
    file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function getStorageInfo() {
    global $uploadsDir;
    $totalSpace = disk_total_space($uploadsDir);
    $freeSpace = disk_free_space($uploadsDir);
    $usedSpace = $totalSpace - $freeSpace;
    
    return [
        'total' => $totalSpace,
        'used' => $usedSpace,
        'free' => $freeSpace,
        'total_formatted' => formatFileSize($totalSpace),
        'used_formatted' => formatFileSize($usedSpace),
        'free_formatted' => formatFileSize($freeSpace),
        'usage_percent' => round(($usedSpace / $totalSpace) * 100, 2)
    ];
}

function getFilesData() {
    global $filesFile;
    $config = getConfig();
    
    if ($config['type'] === 'mysql') {
        return getMySQLFilesData($config);
    } else {
        $content = file_get_contents($filesFile);
        return json_decode($content, true) ?: ['files' => [], 'trash' => []];
    }
}

function saveFilesData($data) {
    global $filesFile;
    $config = getConfig();
    
    if ($config['type'] === 'mysql') {
        saveMySQLFilesData($data, $config);
    } else {
        file_put_contents($filesFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

function getMySQLConnection($config) {
    $conn = new mysqli(
        $config['host'],
        $config['user'],
        $config['password'],
        $config['database'],
        $config['port'] ?? 3306
    );
    
    if ($conn->connect_error) {
        throw new Exception('MySQL连接失败: ' . $conn->connect_error);
    }
    
    return $conn;
}

function getMySQLFilesData($config) {
    $conn = getMySQLConnection($config);
    
    $result = $conn->query("SELECT * FROM files WHERE deleted_at IS NULL ORDER BY uploaded_at DESC");
    $files = [];
    
    while ($row = $result->fetch_assoc()) {
        $files[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'size' => (int)$row['size'],
            'size_formatted' => formatFileSize((int)$row['size']),
            'icon' => getFileIcon($row['name']),
            'url' => $row['url'],
            'download_url' => $row['url'],
            'sid' => $row['sid'],
            'uploaded_at' => $row['uploaded_at'],
            'local_path' => $row['local_path']
        ];
    }
    
    $result = $conn->query("SELECT * FROM files WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC");
    $trash = [];
    
    while ($row = $result->fetch_assoc()) {
        $trash[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'size' => (int)$row['size'],
            'size_formatted' => formatFileSize((int)$row['size']),
            'icon' => getFileIcon($row['name']),
            'url' => $row['url'],
            'download_url' => $row['url'],
            'sid' => $row['sid'],
            'uploaded_at' => $row['uploaded_at'],
            'deleted_at' => $row['deleted_at'],
            'local_path' => $row['local_path']
        ];
    }
    
    $conn->close();
    
    return ['files' => $files, 'trash' => $trash];
}

function saveMySQLFilesData($data, $config) {
    $conn = getMySQLConnection($config);
    
    $conn->query("
        CREATE TABLE IF NOT EXISTS files (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            size BIGINT NOT NULL,
            icon VARCHAR(10) NOT NULL,
            url VARCHAR(500) NOT NULL,
            download_url VARCHAR(500) NOT NULL,
            sid VARCHAR(100),
            uploaded_at DATETIME NOT NULL,
            deleted_at DATETIME,
            local_path VARCHAR(255)
        )
    ");
    
    foreach ($data['files'] as $file) {
        $stmt = $conn->prepare("
            INSERT INTO files (id, name, size, icon, url, download_url, sid, uploaded_at, local_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            size = VALUES(size),
            icon = VALUES(icon),
            url = VALUES(url),
            download_url = VALUES(download_url),
            sid = VALUES(sid),
            uploaded_at = VALUES(uploaded_at),
            local_path = VALUES(local_path),
            deleted_at = NULL
        ");
        
        $stmt->bind_param('sissssss', 
            $file['id'],
            $file['name'],
            $file['size'],
            $file['icon'],
            $file['url'],
            $file['download_url'],
            $file['sid'],
            $file['uploaded_at'],
            $file['local_path']
        );
        
        $stmt->execute();
        $stmt->close();
    }
    
    $conn->close();
}

function formatFileSize($bytes) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, 2) . ' ' . $units[$pow];
}

function deleteDirectory($dir) {
    if (!file_exists($dir)) {
        return true;
    }
    
    if (!is_dir($dir)) {
        return unlink($dir);
    }
    
    foreach (scandir($dir) as $item) {
        if ($item == '.' || $item == '..') {
            continue;
        }
        
        if (!deleteDirectory($dir . DIRECTORY_SEPARATOR . $item)) {
            return false;
        }
    }
    
    return rmdir($dir);
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
        'mp4' => '🎬',
        'mp3' => '🎵',
        'zip' => '📦',
        'rar' => '📦',
        'txt' => '📃',
        'default' => '📁'
    ];
    return $icons[$ext] ?? $icons['default'];
}

function uploadToFTP($filePath, $filename, $config) {
    $ftpHost = $config['host'];
    $ftpPort = $config['port'] ?? 21;
    $ftpUser = $config['user'];
    $ftpPassword = $config['password'];
    $ftpPath = $config['path'] ?? '/public_html/uploads';
    $useSSL = $config['ssl'] ?? false;
    
    $connId = ftp_connect($ftpHost, $ftpUser, $ftpPassword);
    
    if (!$connId) {
        error_log("FTP连接失败: 无法连接到 $ftpHost");
        return ['success' => false, 'error' => 'FTP连接失败'];
    }
    
    if (!ftp_login($connId, $ftpUser, $ftpPassword)) {
        error_log("FTP登录失败: 用户名或密码错误");
        ftp_close($connId);
        return ['success' => false, 'error' => 'FTP登录失败'];
    }
    
    $remotePath = rtrim($ftpPath, '/') . '/' . $filename;
    
    if (!ftp_put($connId, $filePath, $remotePath, FTP_BINARY)) {
        error_log("FTP上传失败: 无法上传文件到 $remotePath");
        ftp_close($connId);
        return ['success' => false, 'error' => 'FTP上传失败'];
    }
    
    $fileSize = filesize($filePath);
    $fileUrl = 'http://' . $_SERVER['HTTP_HOST'] . '/data/cc/' . $filename;
    
    ftp_close($connId);
    
    return [
        'success' => true,
        'url' => $fileUrl,
        'download_url' => $fileUrl,
        'sid' => uniqid(),
        'size' => $fileSize,
        'ftp' => true
    ];
}

function uploadToCloud($filePath, $filename) {
    if (!function_exists('curl_init')) {
        error_log("CURL not available, using local storage");
        return [
            'success' => true,
            'url' => '#',
            'download_url' => '#',
            'sid' => uniqid(),
            'size' => filesize($filePath),
            'local' => true
        ];
    }
    
    $url = 'https://bucket.rutno.com/api_upload';
    $appId = 'xf5839qk71qtigiai63rjipfsmfd17yz';
    $secretKey = 'am19r37odb3ey11z6k180nn8azyytlow';
    
    $ch = curl_init($url);
    
    $post = [
        'app_id' => $appId,
        'secret_key' => $secretKey,
        'file' => new CURLFile($filePath),
        'path' => 'cloud-drive/' . date('Y/m')
    ];
    
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $body = curl_exec($ch);
    
    if ($body === false) {
        $error = curl_error($ch);
        curl_close($ch);
        error_log("CURL Error: " . $error);
        return ['success' => false, 'error' => $error];
    }
    
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("Cloud Upload Response: HTTP $httpCode, Body: " . $body);
    
    $response = json_decode($body, true);
    
    if ($httpCode === 200 && isset($response['ok']) && $response['ok'] === true) {
        return [
            'success' => true,
            'url' => $response['url'],
            'download_url' => $response['download_url'],
            'sid' => $response['sid'],
            'size' => $response['size_bytes']
        ];
    }
    
    return [
        'success' => false,
        'error' => $response['message'] ?? 'Upload failed',
        'http_code' => $httpCode,
        'response' => $body
    ];
}

$action = $_GET['action'] ?? '';

error_log("API Request: action=$action, method=" . $_SERVER['REQUEST_METHOD']);

try {
    switch ($action) {
        case 'upload':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            if (!isset($_FILES['file'])) {
                throw new Exception('No file uploaded');
            }
            
            $file = $_FILES['file'];
            
            error_log("File upload: name=" . $file['name'] . ", size=" . $file['size'] . ", error=" . $file['error']);
            
            if ($file['error'] !== UPLOAD_ERR_OK) {
                $errorMsg = '';
                switch ($file['error']) {
                    case UPLOAD_ERR_INI_SIZE:
                        $errorMsg = '上传的文件超过了 php.ini 中 upload_max_filesize 设置的值';
                        break;
                    case UPLOAD_ERR_FORM_SIZE:
                        $errorMsg = '上传的文件超过了表单中 MAX_FILE_SIZE 设置的值';
                        break;
                    case UPLOAD_ERR_PARTIAL:
                        $errorMsg = '文件只有部分被上传';
                        break;
                    case UPLOAD_ERR_NO_FILE:
                        $errorMsg = '没有文件被上传';
                        break;
                    case UPLOAD_ERR_NO_TMP_DIR:
                        $errorMsg = '找不到临时文件夹';
                        break;
                    case UPLOAD_ERR_CANT_WRITE:
                        $errorMsg = '文件写入失败';
                        break;
                    case UPLOAD_ERR_EXTENSION:
                        $errorMsg = 'PHP扩展停止了文件上传';
                        break;
                    default:
                        $errorMsg = 'Upload error: ' . $file['error'];
                }
                throw new Exception($errorMsg);
            }
            
            $filename = $file['name'];
            $filesize = $file['size'];
            $tmpPath = $file['tmp_name'];
            
            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $newFilename = uniqid() . '.' . $ext;
            $uploadPath = $uploadsDir . $newFilename;
            
            if (!move_uploaded_file($tmpPath, $uploadPath)) {
                error_log("Failed to move uploaded file from $tmpPath to $uploadPath");
                throw new Exception('Failed to save file to local storage');
            }
            
            error_log("File saved successfully: $uploadPath, size: $filesize bytes");
            
            $fileUrl = 'data/cc/' . $newFilename;
            
            $cloudResult = uploadToCloud($uploadPath, $filename);
            
            if ($cloudResult['success'] && !isset($cloudResult['local'])) {
                $downloadUrl = $cloudResult['download_url'];
            } else {
                $downloadUrl = $fileUrl;
            }
            
            $fileData = [
                'id' => uniqid(),
                'name' => $filename,
                'size' => $filesize,
                'size_formatted' => formatFileSize($filesize),
                'icon' => getFileIcon($filename),
                'url' => $fileUrl,
                'download_url' => $downloadUrl,
                'sid' => $cloudResult['sid'] ?? uniqid(),
                'uploaded_at' => date('Y-m-d H:i:s'),
                'local_path' => $newFilename
            ];
            
            $data = getFilesData();
            $data['files'][] = $fileData;
            saveFilesData($data);
            
            $response = json_encode([
                'success' => true,
                'file' => $fileData
            ]);
            error_log("Upload success response: " . $response);
            echo $response;
            break;
            
        case 'list':
            $data = getFilesData();
            $totalSize = array_sum(array_column($data['files'], 'size'));
            $storageInfo = getStorageInfo();
            
            echo json_encode([
                'success' => true,
                'files' => $data['files'],
                'total_size' => $totalSize,
                'total_size_formatted' => formatFileSize($totalSize),
                'storage' => $storageInfo
            ]);
            break;
            
        case 'delete':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $fileId = $input['id'] ?? '';
            
            if (!$fileId) {
                throw new Exception('File ID is required');
            }
            
            $data = getFilesData();
            $fileIndex = -1;
            
            foreach ($data['files'] as $index => $file) {
                if ($file['id'] === $fileId) {
                    $fileIndex = $index;
                    break;
                }
            }
            
            if ($fileIndex === -1) {
                throw new Exception('File not found');
            }
            
            $file = $data['files'][$fileIndex];
            $file['deleted_at'] = date('Y-m-d H:i:s');
            $data['trash'][] = $file;
            array_splice($data['files'], $fileIndex, 1);
            saveFilesData($data);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'trash':
            $data = getFilesData();
            
            echo json_encode([
                'success' => true,
                'files' => $data['trash']
            ]);
            break;
            
        case 'restore':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $fileId = $input['id'] ?? '';
            
            if (!$fileId) {
                throw new Exception('File ID is required');
            }
            
            $data = getFilesData();
            $fileIndex = -1;
            
            foreach ($data['trash'] as $index => $file) {
                if ($file['id'] === $fileId) {
                    $fileIndex = $index;
                    break;
                }
            }
            
            if ($fileIndex === -1) {
                throw new Exception('File not found in trash');
            }
            
            $file = $data['trash'][$fileIndex];
            unset($file['deleted_at']);
            $data['files'][] = $file;
            array_splice($data['trash'], $fileIndex, 1);
            saveFilesData($data);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'empty_trash':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            $data = getFilesData();
            $data['trash'] = [];
            saveFilesData($data);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'delete_permanent':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? '';
            $isDirectory = $input['is_directory'] ?? false;
            
            if (empty($id)) {
                throw new Exception('ID is required');
            }
            
            $data = getFilesData();
            $itemIndex = -1;
            
            if ($isDirectory) {
                foreach (($data['directories'] ?? []) as $index => $dir) {
                    if ($dir['id'] === $id) {
                        $itemIndex = $index;
                        break;
                    }
                }
                
                if ($itemIndex === -1) {
                    throw new Exception('Directory not found');
                }
                
                $directoryToDelete = $data['directories'][$itemIndex];
                
                $directoriesToDelete = [$id];
                $queue = [$id];
                
                while (!empty($queue)) {
                    $currentDirId = array_shift($queue);
                    foreach (($data['directories'] ?? []) as $dir) {
                        if ($dir['parent'] === $currentDirId && !in_array($dir['id'], $directoriesToDelete)) {
                            $directoriesToDelete[] = $dir['id'];
                            $queue[] = $dir['id'];
                        }
                    }
                }
                
                $data['directories'] = array_filter($data['directories'] ?? [], function($dir) use ($directoriesToDelete) {
                    return !in_array($dir['id'], $directoriesToDelete);
                });
                
                $data['files'] = array_filter($data['files'] ?? [], function($file) use ($directoriesToDelete) {
                    return !in_array($file['directory'] ?? '', $directoriesToDelete);
                });
                
                foreach ($directoriesToDelete as $dirId) {
                    $dirPath = $uploadsDir . $dirId . '.json';
                    if (file_exists($dirPath)) {
                        unlink($dirPath);
                    }
                }
            } else {
                foreach (($data['trash'] ?? []) as $index => $file) {
                    if ($file['id'] === $id) {
                        $itemIndex = $index;
                        break;
                    }
                }
                
                if ($itemIndex === -1) {
                    throw new Exception('File not found in trash');
                }
                
                $file = $data['trash'][$itemIndex];
                
                if (isset($file['local_path']) && file_exists($uploadsDir . $file['local_path'])) {
                    $filePath = $uploadsDir . $file['local_path'];
                    if (unlink($filePath)) {
                        error_log("File permanently deleted: $filePath");
                    } else {
                        error_log("Failed to delete file: $filePath");
                    }
                }
                
                array_splice($data['trash'], $itemIndex, 1);
            }
            
            saveFilesData($data);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'get_link':
            $input = json_decode(file_get_contents('php://input'), true);
            $fileId = $input['id'] ?? '';
            
            if (!$fileId) {
                throw new Exception('File ID is required');
            }
            
            $data = getFilesData();
            $file = null;
            
            foreach ($data['files'] as $f) {
                if ($f['id'] === $fileId) {
                    $file = $f;
                    break;
                }
            }
            
            if (!$file) {
                throw new Exception('File not found');
            }
            
            $baseUrl = 'http://' . $_SERVER['HTTP_HOST'];
            $fullUrl = $baseUrl . '/' . $file['url'];
            
            echo json_encode([
                'success' => true,
                'link' => $fullUrl
            ]);
            break;
            
        case 'save_config':
            $input = json_decode(file_get_contents('php://input'), true);
            $config = $input['config'] ?? [];
            
            if (empty($config)) {
                throw new Exception('Config is required');
            }
            
            saveConfig($config);
            
            echo json_encode([
                'success' => true,
                'config' => $config
            ]);
            break;
            
        case 'get_config':
            $config = getConfig();
            echo json_encode([
                'success' => true,
                'config' => $config
            ]);
            break;

        case 'upload_chunk':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            if (!isset($_FILES['chunk'])) {
                throw new Exception('No chunk uploaded');
            }
            
            $fileId = $_POST['file_id'] ?? '';
            $chunkIndex = intval($_POST['chunk_index'] ?? 0);
            $totalChunks = intval($_POST['total_chunks'] ?? 1);
            $fileName = $_POST['file_name'] ?? '';
            $fileSize = intval($_POST['file_size'] ?? 0);
            
            if (empty($fileId)) {
                throw new Exception('File ID is required');
            }
            
            // 检查并创建 chunks 目录
            $chunksBaseDir = $dataDir . 'chunks/';
            if (!file_exists($chunksBaseDir)) {
                if (!mkdir($chunksBaseDir, 0777, true)) {
                    throw new Exception('Failed to create chunks base directory');
                }
            }
            
            $chunkDir = $chunksBaseDir . $fileId . '/';
            if (!file_exists($chunkDir)) {
                if (!mkdir($chunkDir, 0777, true)) {
                    throw new Exception('Failed to create chunk directory: ' . $chunkDir);
                }
            }
            
            $chunk = $_FILES['chunk'];
            
            // 检查上传错误
            if ($chunk['error'] !== UPLOAD_ERR_OK) {
                $errorMsg = 'Upload error code: ' . $chunk['error'];
                switch ($chunk['error']) {
                    case UPLOAD_ERR_INI_SIZE:
                        $errorMsg = '上传的文件超过了 php.ini 中 upload_max_filesize 设置的值';
                        break;
                    case UPLOAD_ERR_FORM_SIZE:
                        $errorMsg = '上传的文件超过了表单中 MAX_FILE_SIZE 设置的值';
                        break;
                    case UPLOAD_ERR_PARTIAL:
                        $errorMsg = '文件只有部分被上传';
                        break;
                    case UPLOAD_ERR_NO_FILE:
                        $errorMsg = '没有文件被上传';
                        break;
                    case UPLOAD_ERR_NO_TMP_DIR:
                        $errorMsg = '找不到临时文件夹';
                        break;
                    case UPLOAD_ERR_CANT_WRITE:
                        $errorMsg = '文件写入失败';
                        break;
                    case UPLOAD_ERR_EXTENSION:
                        $errorMsg = 'PHP扩展停止了文件上传';
                        break;
                }
                throw new Exception($errorMsg);
            }
            
            $chunkPath = $chunkDir . 'chunk_' . $chunkIndex;
            
            if (!move_uploaded_file($chunk['tmp_name'], $chunkPath)) {
                $error = error_get_last();
                throw new Exception('Failed to save chunk: ' . ($error['message'] ?? 'Unknown error'));
            }
            
            // 保存文件信息
            $infoFile = $chunkDir . 'info.json';
            if (!file_exists($infoFile)) {
                file_put_contents($infoFile, json_encode([
                    'file_name' => $fileName,
                    'file_size' => $fileSize,
                    'total_chunks' => $totalChunks,
                    'uploaded_chunks' => []
                ]));
            }
            
            $info = json_decode(file_get_contents($infoFile), true);
            if (!in_array($chunkIndex, $info['uploaded_chunks'])) {
                $info['uploaded_chunks'][] = $chunkIndex;
                file_put_contents($infoFile, json_encode($info));
            }
            
            echo json_encode([
                'success' => true,
                'chunk_index' => $chunkIndex,
                'message' => 'Chunk uploaded successfully'
            ]);
            break;
            
        case 'check_chunks':
            $fileId = $_GET['file_id'] ?? '';
            
            if (empty($fileId)) {
                throw new Exception('File ID is required');
            }
            
            $chunkDir = $dataDir . 'chunks/' . $fileId . '/';
            $infoFile = $chunkDir . 'info.json';
            
            $uploadedChunks = [];
            
            if (file_exists($infoFile)) {
                $info = json_decode(file_get_contents($infoFile), true);
                $uploadedChunks = $info['uploaded_chunks'] ?? [];
            }
            
            echo json_encode([
                'success' => true,
                'uploaded_chunks' => $uploadedChunks
            ]);
            break;
            
        case 'merge_chunks':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $fileId = $input['file_id'] ?? '';
            $fileName = $input['file_name'] ?? '';
            $fileSize = intval($input['file_size'] ?? 0);
            $totalChunks = intval($input['total_chunks'] ?? 1);
            
            if (empty($fileId)) {
                throw new Exception('File ID is required');
            }
            
            $chunkDir = $dataDir . 'chunks/' . $fileId . '/';
            $infoFile = $chunkDir . 'info.json';
            
            if (!file_exists($infoFile)) {
                throw new Exception('File info not found');
            }
            
            $info = json_decode(file_get_contents($infoFile), true);
            
            // 检查所有分片是否都已上传
            if (count($info['uploaded_chunks']) !== $totalChunks) {
                throw new Exception('Not all chunks uploaded');
            }
            
            // 合并文件
            $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            $newFilename = uniqid() . '.' . $ext;
            $uploadPath = $uploadsDir . $newFilename;
            
            $outFile = fopen($uploadPath, 'wb');
            if (!$outFile) {
                throw new Exception('Failed to create output file');
            }
            
            for ($i = 0; $i < $totalChunks; $i++) {
                $chunkPath = $chunkDir . 'chunk_' . $i;
                if (!file_exists($chunkPath)) {
                    fclose($outFile);
                    throw new Exception('Chunk ' . $i . ' not found');
                }
                
                $chunkData = file_get_contents($chunkPath);
                fwrite($outFile, $chunkData);
            }
            
            fclose($outFile);
            
            // 清理分片文件
            $this->deleteDirectory($chunkDir);
            
            $fileUrl = 'data/cc/' . $newFilename;
            
            $cloudResult = uploadToCloud($uploadPath, $fileName);
            
            if ($cloudResult['success'] && !isset($cloudResult['local'])) {
                $downloadUrl = $cloudResult['download_url'];
            } else {
                $downloadUrl = $fileUrl;
            }
            
            $fileData = [
                'id' => uniqid(),
                'name' => $fileName,
                'size' => $fileSize,
                'size_formatted' => formatFileSize($fileSize),
                'icon' => getFileIcon($fileName),
                'url' => $fileUrl,
                'download_url' => $downloadUrl,
                'sid' => $cloudResult['sid'] ?? uniqid(),
                'uploaded_at' => date('Y-m-d H:i:s'),
                'local_path' => $newFilename
            ];
            
            $data = getFilesData();
            $data['files'][] = $fileData;
            saveFilesData($data);
            
            echo json_encode([
                'success' => true,
                'file' => $fileData
            ]);
            break;

        case 'create_directory':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $name = $input['name'] ?? '';
            $parent = $input['parent'] ?? '';

            if (empty($name)) {
                throw new Exception('目录名称不能为空');
            }

            $data = getFilesData();
            $directoryId = uniqid('dir_');
            $directory = [
                'id' => $directoryId,
                'name' => $name,
                'parent' => $parent,
                'created_at' => date('Y-m-d H:i:s')
            ];

            if (!isset($data['directories'])) {
                $data['directories'] = [];
            }

            $data['directories'][] = $directory;
            saveFilesData($data);

            echo json_encode([
                'success' => true,
                'directory' => $directory
            ]);
            break;

        case 'get_directories':
            $data = getFilesData();
            $directories = $data['directories'] ?? [];

            echo json_encode([
                'success' => true,
                'directories' => $directories
            ]);
            break;

        case 'delete_directory':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $directoryId = $input['id'] ?? '';

            if (empty($directoryId)) {
                throw new Exception('Directory ID is required');
            }

            $data = getFilesData();
            $dirIndex = -1;

            foreach (($data['directories'] ?? []) as $index => $dir) {
                if ($dir['id'] === $directoryId) {
                    $dirIndex = $index;
                    break;
                }
            }

            if ($dirIndex === -1) {
                throw new Exception('目录不存在');
            }

            $directoryToDelete = $data['directories'][$dirIndex];

            $directoriesToDelete = [$directoryId];
            $queue = [$directoryId];

            while (!empty($queue)) {
                $currentDirId = array_shift($queue);
                foreach (($data['directories'] ?? []) as $dir) {
                    if ($dir['parent'] === $currentDirId && !in_array($dir['id'], $directoriesToDelete)) {
                        $directoriesToDelete[] = $dir['id'];
                        $queue[] = $dir['id'];
                    }
                }
            }

            $data['directories'] = array_filter($data['directories'] ?? [], function($dir) use ($directoriesToDelete) {
                return !in_array($dir['id'], $directoriesToDelete);
            });

            $data['files'] = array_filter($data['files'] ?? [], function($file) use ($directoriesToDelete) {
                return !in_array($file['directory'] ?? '', $directoriesToDelete);
            });

            saveFilesData($data);

            echo json_encode(['success' => true]);
            break;

        case 'move_file':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $fileId = $input['file_id'] ?? '';
            $directory = $input['directory'] ?? '';

            if (empty($fileId)) {
                throw new Exception('File ID is required');
            }

            $data = getFilesData();
            $fileIndex = -1;

            foreach (($data['files'] ?? []) as $index => $file) {
                if ($file['id'] === $fileId) {
                    $fileIndex = $index;
                    break;
                }
            }

            if ($fileIndex === -1) {
                throw new Exception('文件不存在');
            }

            $data['files'][$fileIndex]['directory'] = $directory;
            saveFilesData($data);

            echo json_encode(['success' => true]);
            break;

        case 'get_files_by_directory':
            $directory = $_GET['directory'] ?? '';

            $data = getFilesData();
            $files = [];
            $directories = [];

            foreach (($data['files'] ?? []) as $file) {
                if (($file['directory'] ?? '') === $directory) {
                    $files[] = $file;
                }
            }

            foreach (($data['directories'] ?? []) as $dir) {
                if ($dir['parent'] === $directory) {
                    $directories[] = $dir;
                }
            }

            echo json_encode([
                'success' => true,
                'files' => $files,
                'directories' => $directories,
                'current_directory' => $directory
            ]);
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