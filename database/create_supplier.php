<?php
// CLI only: create an active supplier account without a branch restriction.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../backend/config/database.php';
$email = $argv[1] ?? '';
$company = $argv[2] ?? '';
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $company === '') throw new RuntimeException('Usage: php database/create_supplier.php email company-name');
$pdo = Database::getInstance();
$pdo->beginTransaction();
try {
    $check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $check->execute([$email]);
    if ($check->fetchColumn()) throw new RuntimeException('Account already exists; no changes made.');
    $role = $pdo->query("SELECT id FROM roles WHERE role_name = 'Supplier'")->fetchColumn();
    if (!$role) throw new RuntimeException('Supplier role missing.');
    $password = 'Lm!' . bin2hex(random_bytes(9));
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare('INSERT INTO users (role_id, email, password, display_name, branch_id, is_active) VALUES (?, ?, ?, ?, NULL, 1)')->execute([$role, $email, $hash, $company]);
    $userId = $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO suppliers (user_id, company_name, email, is_active) VALUES (?, ?, ?, 1)')->execute([$userId, $company, $email]);
    $supplierId = $pdo->lastInsertId();
    $pdo->commit();
    echo json_encode(['email' => $email, 'password' => $password, 'supplierId' => $supplierId, 'scope' => 'Assigned supplier orders from all branches']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
