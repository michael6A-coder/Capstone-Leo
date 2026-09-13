<?php

require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';
require_once '../config/Scheduling.php';
require_once '../config/StaffNotifier.php';

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

$referenceCode = trim($_POST['id'] ?? '');
$staffId = (int) ($_POST['staffId'] ?? 0);

if ($referenceCode === '' || $staffId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Booking reference and staff are required.']);
    exit();
}

try {
    $pdo = Database::getInstance();

    // Resolve the public reference; internal keys stay inside the backend.
    $stmt = $pdo->prepare('SELECT id, status, preferred_date, preferred_time FROM home_service_requests WHERE reference_code = ? LIMIT 1');
    $stmt->execute([$referenceCode]);
    $homeService = $stmt->fetch();
    if ($homeService !== false) {
        $homeServiceId = $homeService['id'];

        $stmt = $pdo->prepare('SELECT id, first_name, last_name FROM employees WHERE id = ? AND is_active = 1');
        $stmt->execute([$staffId]);
        $staff = $stmt->fetch();
        if (!$staff) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Selected staff member is not available.']);
            exit();
        }

        $preferredTime = $homeService['preferred_time'] ?: '09:00:00';
        if (Scheduling::homeServiceStaffHasConflict($pdo, $staffId, $homeService['preferred_date'], $preferredTime, $homeServiceId)) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'This staff member already has an overlapping booking (in-salon or home service) around this date and time.']);
            exit();
        }

        // Assigning staff to a request that's already past quoting/payment
        // naturally advances it to "Staff Assigned" -- earlier-stage requests
        // (still under review, awaiting a quote or payment) keep their
        // current status; staff can be pre-assigned without forcing the flow.
        $nextStatus = $homeService['status'] === 'Confirmed' ? 'Staff Assigned' : $homeService['status'];

        $pdo->prepare('UPDATE home_service_requests SET employee_id = ?, status = ? WHERE id = ?')
            ->execute([$staffId, $nextStatus, $homeServiceId]);

        $staffName = trim($staff['first_name'] . ' ' . $staff['last_name']);
        $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "BOOKING", ?)')
            ->execute(["{$staffName} assigned to home service request {$referenceCode}."]);
        StaffNotifier::notify($pdo, $staffId, 'HOME_SERVICE_ASSIGNED', "You've been assigned to home service request {$referenceCode}.");

        echo json_encode(['success' => true, 'message' => 'Staff assigned.']);
        exit();
    }

    $stmt = $pdo->prepare('SELECT id, branch_id, appointment_datetime FROM appointments WHERE reference_code = ? LIMIT 1');
    $stmt->execute([$referenceCode]);
    $appointment = $stmt->fetch();
    if (!$appointment) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Booking not found.']);
        exit();
    }

    $stmt = $pdo->prepare('SELECT id, first_name, last_name FROM employees WHERE id = ? AND branch_id = ? AND is_active = 1');
    $stmt->execute([$staffId, $appointment['branch_id']]);
    $staff = $stmt->fetch();
    if (!$staff) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Selected staff member is not available at this branch.']);
        exit();
    }

    // Qualification: staff must cover every service on this booking.
    $stmt = $pdo->prepare('SELECT service_id FROM appointment_services WHERE appointment_id = ?');
    $stmt->execute([$appointment['id']]);
    $requiredServiceIds = array_map('intval', array_column($stmt->fetchAll(), 'service_id'));
    if (!empty($requiredServiceIds)) {
        $placeholders = implode(',', array_fill(0, count($requiredServiceIds), '?'));
        $stmt = $pdo->prepare("SELECT COUNT(DISTINCT service_id) FROM staff_services WHERE employee_id = ? AND service_id IN ($placeholders)");
        $stmt->execute(array_merge([$staffId], $requiredServiceIds));
        if ((int) $stmt->fetchColumn() !== count($requiredServiceIds)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'This staff member does not offer every service on this booking.']);
            exit();
        }
    }

    // Duration-aware time-conflict: don't double-book this stylist across any
    // overlapping window, not just the exact same start time. Broader than
    // the Confirmed-only priority check in updateBookingStatus.php -- this
    // mirrors submitBooking.php's booking-creation-time exclusion.
    $durationMinutes = Scheduling::totalDurationMinutes($pdo, $requiredServiceIds);

    $pdo->beginTransaction();

    if (Scheduling::staffHasConflict($pdo, $staffId, $appointment['appointment_datetime'], $durationMinutes, $appointment['id'])) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This staff member already has an overlapping booking at this date and time.']);
        exit();
    }

    $pdo->prepare('UPDATE appointments SET employee_id = ? WHERE id = ?')->execute([$staffId, $appointment['id']]);

    $staffName = trim($staff['first_name'] . ' ' . $staff['last_name']);
    $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "BOOKING", ?)')
        ->execute(["{$staffName} assigned to booking {$referenceCode}."]);
    StaffNotifier::notify($pdo, $staffId, 'APPOINTMENT_ASSIGNED', "You've been assigned to a new appointment: {$referenceCode}.");

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Staff assigned.']);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    error_log('admin assignStaff error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while assigning staff.']);
}
