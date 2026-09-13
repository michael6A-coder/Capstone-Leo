<?php
require_once '../config/session.php';
require_once '../config/database.php';
require_once '../config/RateLimiter.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');
function pinReply(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}
if (!isLoggedIn()) pinReply(401, ['success' => false, 'message' => 'Please sign in again.']);
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) pinReply(405, ['success' => false]);
try {
    $pdo = Database::getInstance();
    $stmt = $pdo->prepare('SELECT u.id, u.password, u.pin_hash, u.role_id, u.is_active, r.role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user || !$user['is_active'] || !in_array($user['role_name'], ['Admin', 'Staff', 'Cashier', 'Supplier'], true)) {
        pinReply(403, ['success' => false, 'message' => 'PIN setup is available for active team accounts only.']);
    }
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $_SESSION['pin_csrf'] = $_SESSION['pin_csrf'] ?? bin2hex(random_bytes(32));
        pinReply(200, ['success' => true, 'configured' => !empty($user['pin_hash']), 'token' => $_SESSION['pin_csrf']]);
    }
    $token = $_POST['token'] ?? '';
    if (!is_string($token) || empty($_SESSION['pin_csrf']) || !hash_equals($_SESSION['pin_csrf'], $token)) {
        pinReply(403, ['success' => false, 'message' => 'Please refresh this page and try again.']);
    }
    $pin = $_POST['pin'] ?? '';
    $confirmation = $_POST['confirmation'] ?? '';
    $password = $_POST['password'] ?? '';
    if (!is_string($pin) || !preg_match('/^[0-9]{6,12}$/D', $pin) || $pin !== $confirmation || !is_string($password) || $password === '') {
        pinReply(400, ['success' => false, 'message' => 'Enter your current password and matching 6–12 digit PINs.']);
    }
    $limiter = new RateLimiter((string) $user['id'], 'pin_setup', 5, 900);
    if ($limiter->isExceeded()) pinReply(429, ['success' => false, 'message' => 'Too many attempts. Try again in 15 minutes.']);
    if (!password_verify($password, $user['password'])) {
        $limiter->record();
        pinReply(401, ['success' => false, 'message' => 'Your current password is incorrect.']);
    }
    $pdo->beginTransaction();
    // Serialize PIN changes for each role so concurrent requests cannot assign duplicates.
    $lock = $pdo->prepare('SELECT id FROM roles WHERE id = ? FOR UPDATE');
    $lock->execute([$user['role_id']]);
    $others = $pdo->prepare('SELECT pin_hash FROM users WHERE role_id = ? AND id != ? AND pin_hash IS NOT NULL');
    $others->execute([$user['role_id'], $user['id']]);
    foreach ($others as $other) {
        if (password_verify($pin, $other['pin_hash'])) {
            $pdo->rollBack();
            $limiter->record();
            pinReply(409, ['success' => false, 'message' => 'That PIN is unavailable. Please choose another.']);
        }
    }
    $pdo->prepare('UPDATE users SET pin_hash = ? WHERE id = ?')->execute([password_hash($pin, PASSWORD_DEFAULT), $user['id']]);
    $pdo->commit();
    $limiter->clear();
    pinReply(200, ['success' => true, 'message' => 'PIN saved. You can now sign in with your account role and PIN.']);
} catch (PDOException $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    pinReply(503, ['success' => false, 'message' => 'PIN settings are unavailable. Please try again later.']);
}
