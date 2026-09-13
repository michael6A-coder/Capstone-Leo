<?php

/**
 * Supplier Dashboard Data API Endpoint
 *
 * Returns everything every pages/supplier/*.html page needs in one request:
 * the supplier's own profile and every purchase order ever placed against
 * their supplier account -- and nothing else. A Supplier account has no
 * employees/customers row, mirrors the Cashier account pattern (a `users`
 * row + a dedicated profile table, here `suppliers`).
 *
 * Orders are matched strictly by `supplier_orders.supplier_id` resolved
 * from the logged-in supplier's own account -- never by name or any
 * client-supplied id, so one supplier can never see another's orders.
 */

require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';

sendCorsHeaders();
header('Content-Type: application/json');

if (!isLoggedIn() || ($_SESSION['user_role'] ?? null) !== 'Supplier') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please log in as a supplier to view this page.']);
    exit();
}

try {
    $pdo = Database::getInstance();
    $userId = $_SESSION['user_id'];

    $stmt = $pdo->prepare('SELECT id, company_name, contact_person, phone, email, address FROM suppliers WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $supplier = $stmt->fetch();
    if (!$supplier) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'No supplier profile is linked to this account.']);
        exit();
    }
    $supplierId = (int) $supplier['id'];

    $profile = [
        'supplierId' => $supplierId,
        'companyName' => $supplier['company_name'],
        'contactPerson' => $supplier['contact_person'],
        'phone' => $supplier['phone'],
        'email' => $supplier['email'],
        'address' => $supplier['address'],
    ];

    $stmt = $pdo->prepare("
        SELECT
            so.id, so.reference_code AS reference, br.branch_name AS branch, br.location AS branchAddress,
            i.product_name AS itemName,
            so.quantity, so.status,
            DATE_FORMAT(so.created_at, '%Y-%m-%d') AS orderDate,
            DATE_FORMAT(so.expected_date, '%Y-%m-%d') AS expectedDate,
            DATE_FORMAT(so.dispatched_at, '%Y-%m-%d %h:%i %p') AS dispatchedAt,
            so.delivery_notes AS deliveryNotes
        FROM supplier_orders so
        JOIN inventory i ON i.id = so.inventory_id
        LEFT JOIN branches br ON br.id = i.branch_id
        WHERE so.supplier_id = ?
        ORDER BY so.created_at DESC
    ");
    $stmt->execute([$supplierId]);
    $orders = array_map(function ($row) {
        $row['id'] = (string) $row['id'];
        $row['quantity'] = (int) $row['quantity'];
        return $row;
    }, $stmt->fetchAll());

    $counts = [
        'newOrders' => 0,
        'confirmed' => 0,
        'outForDelivery' => 0,
        'completed' => 0,
    ];
    foreach ($orders as $order) {
        switch ($order['status']) {
            case 'Order Placed': $counts['newOrders']++; break;
            case 'Order Confirmed': $counts['confirmed']++; break;
            case 'Out for Delivery': $counts['outForDelivery']++; break;
            case 'Received':
            case 'Completed': $counts['completed']++; break;
        }
    }

    echo json_encode([
        'success' => true,
        'profile' => $profile,
        'orders' => $orders,
        'counts' => $counts,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('supplier getDashboardData error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while loading your dashboard.']);
}
