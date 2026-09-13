<?php

/**
 * Supplier: Mark Out for Delivery
 *
 * The only action available on an 'Order Confirmed' order. Records the
 * dispatch timestamp + optional delivery notes and advances status to
 * 'Out for Delivery'. Never touches inventory stock -- stock is only
 * incremented once authorized Cashier/Staff/Admin verifies the physical
 * delivery (see backend/admin/advanceOrderStatus.php's Received step).
 */

require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';

sendCorsHeaders();
header('Content-Type: application/json');

if (!isLoggedIn() || ($_SESSION['user_role'] ?? null) !== 'Supplier') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please log in as a supplier.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

$referenceCode = trim($_POST['id'] ?? '');
$deliveryNotes = trim($_POST['deliveryNotes'] ?? '');

if ($referenceCode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'An order reference is required.']);
    exit();
}

try {
    $pdo = Database::getInstance();

    $stmt = $pdo->prepare('SELECT id FROM suppliers WHERE user_id = ? LIMIT 1');
    $stmt->execute([$_SESSION['user_id']]);
    $supplierId = $stmt->fetchColumn();
    if (!$supplierId) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'No supplier profile is linked to this account.']);
        exit();
    }

    $stmt = $pdo->prepare('SELECT id, status FROM supplier_orders WHERE reference_code = ? AND supplier_id = ? LIMIT 1');
    $stmt->execute([$referenceCode, $supplierId]);
    $order = $stmt->fetch();
    if (!$order) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Order not found.']);
        exit();
    }
    if ($order['status'] !== 'Order Confirmed') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Only a confirmed order can be marked out for delivery.']);
        exit();
    }

    $pdo->prepare("UPDATE supplier_orders SET status = 'Out for Delivery', dispatched_at = NOW(), delivery_notes = ? WHERE id = ?")
        ->execute([$deliveryNotes !== '' ? $deliveryNotes : null, $order['id']]);

    $pdo->prepare('INSERT INTO supplier_action_log (supplier_id, order_id, action, details) VALUES (?, ?, "out_for_delivery", ?)')
        ->execute([$supplierId, $order['id'], "Dispatched {$referenceCode}." . ($deliveryNotes !== '' ? " Notes: {$deliveryNotes}" : '')]);

    $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "ORDER", ?)')
        ->execute(["Supplier order {$referenceCode} is now out for delivery."]);

    echo json_encode(['success' => true, 'message' => 'Order marked as out for delivery.']);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('supplier markOutForDelivery error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while updating the order.']);
}
