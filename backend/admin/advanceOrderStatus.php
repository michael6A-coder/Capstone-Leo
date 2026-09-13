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

$orderId = (int) ($_POST['id'] ?? 0);
if ($orderId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid supplier order.']);
    exit();
}

$sequence = ['Order Placed', 'Order Confirmed', 'Out for Delivery', 'Received', 'Completed'];

try {
    $pdo = Database::getInstance();

    $stmt = $pdo->prepare('
        SELECT so.reference_code, so.status, so.quantity, so.inventory_id, i.product_name
        FROM supplier_orders so JOIN inventory i ON i.id = so.inventory_id
        WHERE so.id = ?
    ');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();
    if (!$order) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Supplier order not found.']);
        exit();
    }

    $currentIndex = array_search($order['status'], $sequence, true);
    $nextIndex = min($currentIndex + 1, count($sequence) - 1);
    $nextStatus = $sequence[$nextIndex];
    $referenceCode = $order['reference_code'];

    $pdo->beginTransaction();

    if ($nextStatus === 'Received') {
        $pdo->prepare('UPDATE supplier_orders SET status = ?, received_by = ?, received_at = NOW() WHERE id = ?')
            ->execute([$nextStatus, $_SESSION['user_id'], $orderId]);
    } else {
        $pdo->prepare('UPDATE supplier_orders SET status = ? WHERE id = ?')->execute([$nextStatus, $orderId]);
    }

    if ($nextStatus === 'Received' && $order['status'] !== 'Received') {
        $previousStock = (int) $pdo->query('SELECT quantity_on_hand FROM inventory WHERE id = ' . (int) $order['inventory_id'])->fetchColumn();
        $newStock = $previousStock + (int) $order['quantity'];
        $pdo->prepare('UPDATE inventory SET quantity_on_hand = ? WHERE id = ?')->execute([$newStock, $order['inventory_id']]);

        // Restocking via a received supplier order is an inventory change
        // just like a manual adjustment -- goes into the same audit trail.
        $pdo->prepare('
            INSERT INTO inventory_adjustments (inventory_id, adjustment_type, quantity, reason, previous_stock, new_stock, adjusted_by)
            VALUES (?, "add", ?, ?, ?, ?, ?)
        ')->execute([$order['inventory_id'], $order['quantity'], "Supplier order {$referenceCode} received.", $previousStock, $newStock, $_SESSION['user_id']]);

        $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "ORDER", ?)')
            ->execute(["Supplier order {$referenceCode} received — {$order['quantity']} units added to stock ({$order['product_name']})."]);
    } else {
        $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "ORDER", ?)')
            ->execute(["Supplier order {$referenceCode} advanced to {$nextStatus}."]);
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Order status advanced.']);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    error_log('admin advanceOrderStatus error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while updating the order.']);
}
