<?php

/**
 * Supplier: Update Profile
 *
 * Only contact/profile fields are editable here -- company_name is treated
 * as the account's identity (like a display name) and can be updated, but
 * role, account permissions, and the supplier's own id are never
 * accepted from the client at all (no such fields exist in this form).
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

$companyName = trim($_POST['companyName'] ?? '');
$contactPerson = trim($_POST['contactPerson'] ?? '');
$phone = trim($_POST['phone'] ?? '');
$address = trim($_POST['address'] ?? '');

if ($companyName === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Company name is required.']);
    exit();
}

try {
    $pdo = Database::getInstance();
    $userId = $_SESSION['user_id'];

    $stmt = $pdo->prepare('SELECT id FROM suppliers WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $supplierId = $stmt->fetchColumn();
    if (!$supplierId) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'No supplier profile is linked to this account.']);
        exit();
    }

    $pdo->prepare('UPDATE suppliers SET company_name = ?, contact_person = ?, phone = ?, address = ? WHERE id = ?')
        ->execute([$companyName, $contactPerson ?: null, $phone ?: null, $address ?: null, $supplierId]);

    $pdo->prepare('UPDATE users SET display_name = ? WHERE id = ?')->execute([$companyName, $userId]);

    echo json_encode(['success' => true, 'message' => 'Profile updated.']);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('supplier saveProfile error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while updating your profile.']);
}
