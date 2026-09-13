<?php

/**
 * Admin: Create/Edit Supplier Account
 *
 * Same pattern as saveCashier.php: a Supplier account is a plain `users`
 * row (role Supplier) with no `employees` row, plus a dedicated profile
 * row in `suppliers`. Editing only touches profile fields; email is fixed
 * after creation. Creating a new supplier needs a login account, so a temp
 * password is generated and handed back once so the admin can relay it.
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
$companyName = trim($_POST['companyName'] ?? '');
$contactPerson = trim($_POST['contactPerson'] ?? '');
$phone = trim($_POST['phone'] ?? '');
$address = trim($_POST['address'] ?? '');
$email = trim($_POST['email'] ?? '');

if ($companyName === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Company name is required.']);
    exit();
}

try {
    $pdo = Database::getInstance();

    if ($supplierId > 0) {
        $stmt = $pdo->prepare('SELECT id, user_id FROM suppliers WHERE id = ?');
        $stmt->execute([$supplierId]);
        $existing = $stmt->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Supplier account not found.']);
            exit();
        }

        $pdo->prepare('UPDATE suppliers SET company_name = ?, contact_person = ?, phone = ?, address = ? WHERE id = ?')
            ->execute([$companyName, $contactPerson ?: null, $phone ?: null, $address ?: null, $supplierId]);

        if ($existing['user_id']) {
            $pdo->prepare('UPDATE users SET display_name = ? WHERE id = ?')->execute([$companyName, $existing['user_id']]);
        }

        $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "SUPPLIER", ?)')
            ->execute(["Supplier account updated: {$companyName}."]);

        echo json_encode(['success' => true, 'message' => 'Supplier account updated.']);
        exit();
    }

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A valid email is required to create a new supplier login.']);
        exit();
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'An account with this email already exists.']);
        exit();
    }

    $stmt = $pdo->prepare("SELECT id FROM roles WHERE role_name = 'Supplier' LIMIT 1");
    $stmt->execute();
    $roleId = $stmt->fetchColumn();
    if (!$roleId) {
        throw new Exception("Default 'Supplier' role not found in the database.");
    }

    $tempPassword = bin2hex(random_bytes(4));
    $hashed = password_hash($tempPassword, PASSWORD_DEFAULT);

    $pdo->beginTransaction();

    $pdo->prepare('INSERT INTO users (role_id, email, display_name, password) VALUES (?, ?, ?, ?)')
        ->execute([$roleId, $email, $companyName, $hashed]);
    $newUserId = $pdo->lastInsertId();

    $pdo->prepare('INSERT INTO suppliers (user_id, company_name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$newUserId, $companyName, $contactPerson ?: null, $phone ?: null, $email, $address ?: null]);

    $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "SUPPLIER", ?)')
        ->execute(["New supplier account added: {$companyName}."]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Supplier account created.',
        'tempPassword' => $tempPassword,
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    error_log('admin saveSupplierAccount error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while saving the supplier account.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'A server configuration error occurred.']);
}
