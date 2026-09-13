<?php

/**
 * Cancel Appointment API Endpoint
 *
 * Marks one of the logged-in customer's own appointments as Cancelled.
 * Ownership is enforced by joining through the session's customer_id —
 * a customer can never cancel someone else's appointment by guessing an id.
 */

require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';

sendCorsHeaders();
header('Content-Type: application/json');

if (!isLoggedIn() || ($_SESSION['user_role'] ?? null) !== 'Customer') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please log in to manage your appointments.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

$referenceCode = trim($_POST['appointment_id'] ?? '');

if ($referenceCode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Appointment ID was not provided.']);
    exit();
}

try {
    $pdo = Database::getInstance();
    $userId = $_SESSION['user_id'];

    $stmt = $pdo->prepare('
        UPDATE appointments a
        JOIN customers c ON c.id = a.customer_id
        SET a.status = "Cancelled"
        WHERE a.reference_code = ? AND c.user_id = ? AND a.status NOT IN ("Cancelled", "Completed", "Reviewed")
    ');
    $stmt->execute([$referenceCode, $userId]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Appointment not found or it can no longer be cancelled.']);
        exit();
    }

    echo json_encode(['success' => true, 'message' => "Appointment #{$referenceCode} has been successfully cancelled."]);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('cancelAppointment error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while cancelling your appointment.']);
}
