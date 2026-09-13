<?php

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

$itemId = (int) ($_POST['itemId'] ?? 0);
$qty = (int) ($_POST['qty'] ?? 0);

if ($itemId <= 0 || $qty <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'A valid item and quantity are required.']);
    exit();
}

try {
    $pdo = Database::getInstance();

    $stmt = $pdo->prepare('SELECT product_name, branch_name, supplier FROM inventory i LEFT JOIN branches br ON br.id = i.branch_id WHERE i.id = ?');
    $stmt->execute([$itemId]);
    $item = $stmt->fetch();
    if (!$item) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Inventory item not found.']);
        exit();
    }

    // supplier_name is a snapshot of inventory.supplier at order time, so
    // this order's history stays accurate even if the item's supplier text
    // is edited afterward.
    $stmt = $pdo->prepare("
        INSERT INTO supplier_orders (inventory_id, supplier_name, quantity, expected_date, status)
        VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Order Placed')
    ");
    $stmt->execute([$itemId, $item['supplier'] ?: null, $qty]);
    $orderId = $pdo->lastInsertId();

    $referenceCode = 'SO-' . str_pad($orderId, 6, '0', STR_PAD_LEFT);
    $pdo->prepare('UPDATE supplier_orders SET reference_code = ? WHERE id = ?')->execute([$referenceCode, $orderId]);

    $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "ORDER", ?)')
        ->execute(["Supplier order {$referenceCode} placed for {$item['product_name']} ({$item['branch_name']})."]);

    echo json_encode(['success' => true, 'message' => 'Supplier order placed.']);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('admin placeSupplierOrder error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while placing the order.']);
}
