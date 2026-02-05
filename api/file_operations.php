<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$dataDir = __DIR__ . '/../data/';
$filesFile = $dataDir . 'files.json';

if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

if (!file_exists($filesFile)) {
    file_put_contents($filesFile, json_encode(['files' => [], 'trash' => [], 'directories' => []]));
}

function getFilesData() {
    global $filesFile;
    $content = file_get_contents($filesFile);
    return json_decode($content, true) ?: ['files' => [], 'trash' => [], 'directories' => []];
}

function saveFilesData($data) {
    global $filesFile;
    file_put_contents($filesFile, json_encode($data));
}

function formatFileSize($bytes) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $maxPow = count($units) - 1;
    $pow = min($pow, $maxPow);
    return round($bytes / pow(1024, $pow), 2) . ' ' . $units[$pow];
}

function getFileIcon($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $icons = [
        'jpg' => '🖼️', 'jpeg' => '🖼️', 'png' => '🖼️', 'gif' => '🖼️',
        'webp' => '🖼️', 'svg' => '🖼️', 'mp4' => '🎬', 'webm' => '🎬',
        'ogg' => '🎬', 'mp3' => '🎵', 'wav' => '🎵', 'ogg' => '🎵',
        'pdf' => '📄', 'doc' => '📄', 'docx' => '📄', 'xls' => '📊',
        'xlsx' => '📊', 'ppt' => '📊', 'pptx' => '📊', 'txt' => '📝',
        'zip' => '📦', 'rar' => '📦', '7z' => '📦', 'tar' => '📦',
        'exe' => '⚙️', 'msi' => '⚙️', 'dmg' => '💿', 'iso' => '💿',
        'apk' => '📱', 'default' => '📄'
    ];
    return $icons[$ext] ?? $icons['default'];
}

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'move_file':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $fileId = $input['file_id'] ?? '';
            $newDirectory = $input['directory'] ?? '';
            
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
                throw new Exception('File not found');
            }
            
            $data['files'][$fileIndex]['directory'] = $newDirectory;
            saveFilesData($data);
            
            echo json_encode([
                'success' => true,
                'file' => $data['files'][$fileIndex]
            ]);
            break;
            
        case 'rename_file':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            $fileId = $input['file_id'] ?? '';
            $newName = $input['new_name'] ?? '';
            
            if (empty($fileId)) {
                throw new Exception('File ID is required');
            }
            
            if (empty($newName)) {
                throw new Exception('New name is required');
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
                throw new Exception('File not found');
            }
            
            $oldName = $data['files'][$fileIndex]['name'];
            $data['files'][$fileIndex]['name'] = $newName;
            saveFilesData($data);
            
            echo json_encode([
                'success' => true,
                'file' => $data['files'][$fileIndex]
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
