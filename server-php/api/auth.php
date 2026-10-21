<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../database/db.php';

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$username = trim($input['username'] ?? '');
$pin = trim($input['pin'] ?? '');
$password = trim($input['password'] ?? '');

if (empty($username)) {
    http_response_code(400);
    echo json_encode(['error' => 'Username is required']);
    exit();
}

try {
    $db = Database::getConnection();
    $stmt = $db->prepare('SELECT * FROM users WHERE username = :u AND status = "active" LIMIT 1');
    $stmt->execute([':u' => $username]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid username or credentials']);
        exit();
    }

    $authenticated = false;
    if (!empty($pin)) {
        $pinHash = hash('sha256', $pin);
        $authenticated = ($pinHash === $user['pin_hash']);
    } elseif (!empty($password)) {
        $pwdHash = hash('sha256', $password);
        $authenticated = ($pwdHash === $user['password_hash']);
    }

    if (!$authenticated) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        exit();
    }

    // Generate lightweight bearer token
    $token = bin2hex(random_bytes(32));

    echo json_encode([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'name' => $user['name'],
            'role' => $user['role']
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
