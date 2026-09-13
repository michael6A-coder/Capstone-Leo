<?php

/**
 * Submit Booking API Endpoint
 *
 * Creates a new appointment for the logged-in customer: validates the
 * selected services/date/time/slot capacity, optionally applies a loyalty
 * point discount, assigns staff, and returns the created appointment in
 * the same shape the dashboard already renders.
 */

require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';
require_once '../config/Scheduling.php';
require_once '../config/ReservationPayment.php';
require_once '../config/CustomerNotifier.php';

sendCorsHeaders();
header('Content-Type: application/json');

if (!isLoggedIn() || ($_SESSION['user_role'] ?? null) !== 'Customer') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please log in to book an appointment.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

$branchKey = trim($_POST['branch'] ?? '');
$serviceIds = $_POST['serviceIds'] ?? [];
$date = trim($_POST['date'] ?? '');
$time = trim($_POST['time'] ?? '');
$staffId = trim($_POST['staffId'] ?? '');
$customerName = trim($_POST['customerName'] ?? '');
$customerPhone = trim($_POST['customerPhone'] ?? '');
$paymentMethod = trim($_POST['paymentMethod'] ?? '');
// Payment amounts are always calculated from the database, never POST data.
$depositReference = trim($_POST['depositReference'] ?? '');
$useLoyaltyPoints = filter_var($_POST['useLoyaltyPoints'] ?? false, FILTER_VALIDATE_BOOLEAN);
$agreedToTerms = filter_var($_POST['agreedToTerms'] ?? false, FILTER_VALIDATE_BOOLEAN);

if (!is_array($serviceIds)) {
    $serviceIds = [$serviceIds];
}
$serviceIds = array_values(array_filter(array_map('intval', $serviceIds)));

$allowedPaymentMethods = ['Cash', 'GCash', 'Maya'];

if ($branchKey === '' || empty($serviceIds) || $date === '' || $time === '' || $customerName === '' || $customerPhone === ''
    || !in_array($paymentMethod, $allowedPaymentMethods, true)
) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please provide branch, services, date, time, reservation deposit, and contact details.']);
    exit();
}

if (($paymentMethod === 'GCash' || $paymentMethod === 'Maya') && $depositReference === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please enter your ' . $paymentMethod . ' reference number.']);
    exit();
}

if (!$agreedToTerms) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please agree to the Terms and Conditions to continue.']);
    exit();
}

define('LOYALTY_POINT_VALUE', 0.1);

try {
    $pdo = Database::getInstance();
    $userId = $_SESSION['user_id'];

    $stmt = $pdo->prepare('SELECT id, loyalty_points FROM customers WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $customer = $stmt->fetch();
    if (!$customer) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Customer profile not found.']);
        exit();
    }
    $customerId = (int) $customer['id'];

    $stmt = $pdo->prepare('SELECT id, branch_name FROM branches WHERE branch_key = ? LIMIT 1');
    $stmt->execute([$branchKey]);
    $branch = $stmt->fetch();
    if (!$branch) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid branch selected.']);
        exit();
    }
    $branchId = (int) $branch['id'];

    // Validate the selected services actually belong to this branch, and total their price.
    $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
    $stmt = $pdo->prepare("SELECT id, service_name, price, payment_requirement FROM services WHERE branch_id = ? AND id IN ($placeholders) AND is_active = 1");
    $stmt->execute([$branchId, ...$serviceIds]);
    $services = $stmt->fetchAll();
    if (count($services) !== count($serviceIds)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'One or more selected services are invalid for this branch.']);
        exit();
    }
    $subtotal = array_sum(array_map(fn($s) => (float) $s['price'], $services));
    $servicePlaceholders = implode(',', array_fill(0, count($serviceIds), '?'));

    $appointmentTimestamp = strtotime("$date $time");
    if ($appointmentTimestamp === false) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid date or time selected.']);
        exit();
    }
    $appointmentDateTime = date('Y-m-d H:i:s', $appointmentTimestamp);
    $durationMinutes = Scheduling::totalDurationMinutes($pdo, $serviceIds);

    if (Scheduling::isOutsideOperatingHours($appointmentDateTime, $durationMinutes, $branchKey)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'This booking falls outside the selected branch operating hours. Please choose another time.']);
        exit();
    }

    $pdo->beginTransaction();

    // Locking read: serializes concurrent bookings for this branch+day so two
    // simultaneous requests can't both slip past the slot limit. Duration-aware:
    // a long treatment occupies every slot it overlaps, not just its start time.
    if (Scheduling::branchWindowIsFull($pdo, $branchId, $appointmentDateTime, $durationMinutes)) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'conflict' => true, 'message' => 'That time was just booked. Please choose another available schedule.']);
        exit();
    }

    // --- Staff assignment: never double-book a specific stylist across any
    // overlapping window (not just the same exact start time); when
    // auto-assigning, prefer whoever has fewest bookings that day instead of
    // always the same lowest-id employee. ---
    $stmt = $pdo->prepare("
        SELECT e.id, e.first_name, e.last_name
        FROM employees e
        WHERE e.branch_id = ? AND e.is_active = 1
          AND (SELECT COUNT(DISTINCT service_id) FROM staff_services WHERE employee_id = e.id AND service_id IN ($servicePlaceholders)) = ?
          " . ($staffId !== '' ? 'AND e.id = ?' : '') . "
        ORDER BY (
            SELECT COUNT(*) FROM appointments a2
            WHERE a2.employee_id = e.id AND DATE(a2.appointment_datetime) = DATE(?) AND a2.status != 'Cancelled'
        ) ASC, e.id ASC
    ");
    $params = [$branchId, ...$serviceIds, count($serviceIds)];
    if ($staffId !== '') {
        $params[] = (int) $staffId;
    }
    $params[] = $appointmentDateTime;
    $stmt->execute($params);
    $candidates = $stmt->fetchAll();

    $employee = null;
    foreach ($candidates as $candidate) {
        if (!Scheduling::staffHasConflict($pdo, (int) $candidate['id'], $appointmentDateTime, $durationMinutes)) {
            $employee = $candidate;
            break;
        }
    }
    if (!$employee) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['success' => false, 'conflict' => $staffId !== '', 'message' => $staffId !== ''
            ? 'That time was just booked. Please choose another available schedule.'
            : 'No staff available at this branch offers this combination of services at that time. Please choose another time or adjust your service selection.']);
        exit();
    }
    $employeeId = (int) $employee['id'];
    $staffName = trim($employee['first_name'] . ' ' . $employee['last_name']);

    // Lock the current loyalty balance before calculating and consuming points.
    $pointsStmt = $pdo->prepare('SELECT loyalty_points FROM customers WHERE id = ? FOR UPDATE');
    $pointsStmt->execute([$customerId]);
    $customer['loyalty_points'] = (int) $pointsStmt->fetchColumn();
    $quote = ReservationPayment::quote($services, $customer['loyalty_points'], $useLoyaltyPoints);
    $pointsUsed = $quote['pointsUsed'];
    $finalPrice = $quote['serviceTotal'];
    $depositAmount = $quote['amountDue'];
    if (isset($_POST['quoteToken']) && !hash_equals($quote['quoteToken'], (string) $_POST['quoteToken'])) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'quoteChanged' => true, 'message' => 'Your service price or payment requirement changed. Please review Pay Now again.']);
        exit();
    }

    $referenceCode = ''; // Generated atomically by the database insert trigger.
    $notes = "Booked for: {$customerName}, Phone: {$customerPhone}";

    // deposit_recorded_by stays NULL -- self-reported by the customer, not
    // yet verified by staff (see backend/admin/updateBookingStatus.php).
    // payment_status separately tracks the deposit's own lifecycle
    // (Awaiting Verification here) independent of the appointment's status
    // (Pending) -- see database/migrations/023_appointment_payment_status.sql.
    $ins = $pdo->prepare('
        INSERT INTO appointments (
            reference_code, customer_id, employee_id, branch_id, appointment_datetime, total_price,
            preferred_payment_method, deposit_paid, deposit_amount, deposit_method, deposit_reference, deposit_recorded_at,
            status, payment_status, reminder_sent, notes, terms_accepted_at, reservation_requirement, reservation_amount_due
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NOW(), ?, ?, 0, ?, NOW(), ?, ?)
    ');
    $ins->execute([
        $referenceCode, $customerId, $employeeId, $branchId, $appointmentDateTime, $finalPrice,
        $paymentMethod, $depositAmount, $paymentMethod, $depositReference !== '' ? $depositReference : null,
        'Pending', 'Awaiting Verification', $notes, $quote['reservationRequirement'], $depositAmount,
    ]);
    $appointmentId = $pdo->lastInsertId();
    $refStmt = $pdo->prepare('SELECT reference_code FROM appointments WHERE id = ?');
    $refStmt->execute([$appointmentId]);
    $referenceCode = $refStmt->fetchColumn();

    $linkStmt = $pdo->prepare('INSERT INTO appointment_services (appointment_id, service_id) VALUES (?, ?)');
    foreach ($services as $service) {
        $linkStmt->execute([$appointmentId, $service['id']]);
    }

    if ($pointsUsed > 0) {
        $pdo->prepare('UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?')
            ->execute([$pointsUsed, $customerId]);
    }

    CustomerNotifier::notify($pdo, $customerId, 'BOOKING_SUBMITTED', "Your booking request {$referenceCode} has been received. Status: Waiting for Confirmation.");
    CustomerNotifier::notify($pdo, $customerId, 'PAYMENT_SUBMITTED', "Your reservation payment for {$referenceCode} has been submitted and is now Payment Being Verified.");

    $pdo->commit();

    $serviceNames = implode(', ', array_map(fn($s) => $s['service_name'], $services));

    echo json_encode([
        'success' => true,
        'message' => "Your booking request {$referenceCode} has been sent!",
        'reference' => $referenceCode,
        'appointment' => [
            'id' => $referenceCode,
            'branchId' => $branchKey,
            'branchName' => $branch['branch_name'],
            'serviceName' => $serviceNames,
            'price' => $finalPrice,
            'reservationRequirement' => $quote['reservationRequirement'],
            'amountDue' => $depositAmount,
            'remainingBalance' => $quote['remainingBalance'],
            'staffId' => (string) $employeeId,
            'staffName' => $staffName,
            'paymentMethod' => $paymentMethod,
            'depositAmount' => $depositAmount,
            'depositReference' => $depositReference,
            'date' => $date,
            'time' => $time,
            'status' => 'Pending',
            'paymentStatus' => 'Awaiting Verification',
            'reminderSent' => false,
        ],
        'loyaltyPoints' => (int) $customer['loyalty_points'] - $pointsUsed,
    ]);
} catch (PDOException | InvalidArgumentException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    error_log('submitBooking error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while booking your appointment.']);
}
