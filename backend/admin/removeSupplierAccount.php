<?php

/**
 * Soft delete: deactivates the supplier's login (users.is_active = 0, which
 * blocks login.php) and the suppliers row, without touching any existing
 * supplier_orders history -- ON DELETE SET NULL on both FKs means past
 * orders keep their supplier_name snapshot even if the account is removed.
 */

require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';

sendCorsHeaders();
header('Content-Type: application/json');

if (!isLoggedIn() || !in_array($_SESSION['user_role'] ?? '', ['Admin'], true)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please log in as an administrator.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

$supplierId = (int) ($_POST['id'] ?? 0);
if ($supplierId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid supplier account.']);
    exit();
}

try {
    $pdo = Database::getInstance();

    $stmt = $pdo->prepare('SELECT company_name, user_id FROM suppliers WHERE id = ?');
    $stmt->execute([$supplierId]);
    $supplier = $stmt->fetch();
    if (!$supplier) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Supplier account not found.']);
        exit();
    }

    $pdo->prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?')->execute([$supplierId]);
    if ($supplier['user_id']) {
        $pdo->prepare('UPDATE users SET is_active = 0 WHERE id = ?')->execute([$supplier['user_id']]);
    }

    $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "SUPPLIER", ?)')
        ->execute(["{$supplier['company_name']} was removed."]);

    echo json_encode(['success' => true, 'message' => 'Supplier account removed.']);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('admin removeSupplierAccount error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while removing the supplier account.']);
}
