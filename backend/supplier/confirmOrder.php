<?php

/**
 * Supplier: Confirm Order
 *
 * The only action available on an 'Order Placed' order. Sets the Expected
 * Delivery Date (required) and advances status to 'Order Confirmed'.
 * Ownership is enforced by supplier_id resolved from the session, never a
 * client-supplied id -- a supplier can never confirm another supplier's
 * order even by guessing/replaying a reference code.
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
$expectedDate = trim($_POST['expectedDeliveryDate'] ?? '');

if ($referenceCode === '' || $expectedDate === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'An order reference and expected delivery date are required.']);
    exit();
}

$parsedDate = DateTime::createFromFormat('Y-m-d', $expectedDate);
if (!$parsedDate || $parsedDate->format('Y-m-d') !== $expectedDate) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please provide a valid expected delivery date.']);
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
    if ($order['status'] !== 'Order Placed') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Only a newly placed order can be confirmed.']);
        exit();
    }

    $pdo->prepare("UPDATE supplier_orders SET status = 'Order Confirmed', expected_date = ? WHERE id = ?")
        ->execute([$expectedDate, $order['id']]);

    $pdo->prepare('INSERT INTO supplier_action_log (supplier_id, order_id, action, details) VALUES (?, ?, "confirm_order", ?)')
        ->execute([$supplierId, $order['id'], "Confirmed {$referenceCode}, expected delivery {$expectedDate}."]);

    $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "ORDER", ?)')
        ->execute(["Supplier order {$referenceCode} was confirmed by the supplier. Expected delivery: {$expectedDate}."]);

    echo json_encode(['success' => true, 'message' => 'Order confirmed.']);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('supplier confirmOrder error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while confirming the order.']);
}
