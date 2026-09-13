<?php

/**
 * Public: Submit Guest Booking
 *
 * No login required — this is the "zero mandatory upfront accounts"
 * booking flow from the landing page. A guest becomes a `customers` row
 * with no linked `user_id` (the schema already supports this); if the
 * phone number they enter already belongs to a known customer (guest or
 * registered), that existing record is reused instead of overwritten.
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/RateLimiter.php';
require_once '../config/Scheduling.php';
require_once '../config/ReservationPayment.php';

sendCorsHeaders();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

$fullName = trim($_POST['fullname'] ?? '');
$contact = trim($_POST['contact'] ?? '');
$branchId = (int) ($_POST['branch'] ?? 0);
$date = trim($_POST['appointment_date'] ?? '');
$time = trim($_POST['time_slot'] ?? '');
$serviceIds = $_POST['services'] ?? [];
$email = trim($_POST['email'] ?? '');
$otpCode = trim($_POST['otp_code'] ?? '');
$paymentMethod = trim($_POST['payment_method'] ?? '');
$staffId = (int) ($_POST['staff_id'] ?? 0);
// Payment amounts are always calculated from the database, never POST data.
$depositReference = trim($_POST['deposit_reference'] ?? '');
$agreedToTerms = filter_var($_POST['agreedToTerms'] ?? false, FILTER_VALIDATE_BOOLEAN);

if (!is_array($serviceIds)) {
    $serviceIds = [$serviceIds];
}
$serviceIds = array_values(array_filter(array_map('intval', $serviceIds)));

$allowedPaymentMethods = ['Cash', 'GCash', 'Maya'];

// Only Full Name and Contact Number are required to book as a guest -- no
// account needed. Email is optional; when the guest does provide one, it's
// verified by OTP as an extra confirmation channel, but its absence never
// blocks a booking.
if ($fullName === '' || $contact === '' || $branchId <= 0 || $date === '' || $time === '' || empty($serviceIds)
    || !in_array($paymentMethod, $allowedPaymentMethods, true) || $staffId <= 0
) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please fill in your name, contact number, branch, date, time, staff selection, reservation deposit, and at least one service.']);
    exit();
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please enter a valid email address, or leave it blank.']);
    exit();
}

if ($email !== '' && $otpCode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please enter the verification code sent to your email.']);
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

[$firstName, $lastName] = array_pad(explode(' ', $fullName, 2), 2, '');

$ip_address = RateLimiter::getIpAddress();
$otp_fail_limiter = new RateLimiter($ip_address, 'submit_booking_otp_fail', 10, 900);

if ($otp_fail_limiter->isExceeded()) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Too many verification attempts. Please try again in 15 minutes.']);
    exit();
}

try {
    $pdo = Database::getInstance();

    // Email is optional, so OTP verification only applies when one was given.
    if ($email !== '') {
        $stmt = $pdo->prepare('SELECT code, expires_at FROM booking_verifications WHERE email = ?');
        $stmt->execute([$email]);
        $verification = $stmt->fetch();

        if (!$verification || !hash_equals($verification['code'], $otpCode) || new DateTime() > new DateTime($verification['expires_at'])) {
            $otp_fail_limiter->record();
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid or expired verification code.']);
            exit();
        }

        $otp_fail_limiter->clear();
    }

    $stmt = $pdo->prepare('SELECT id, branch_key FROM branches WHERE id = ?');
    $stmt->execute([$branchId]);
    $branch = $stmt->fetch();
    if (!$branch) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid branch selected.']);
        exit();
    }

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

    $quote = ReservationPayment::quote($services);
    $subtotal = $quote['serviceTotal'];
    $depositAmount = $quote['amountDue'];
    if (isset($_POST['quoteToken']) && !hash_equals($quote['quoteToken'], (string) $_POST['quoteToken'])) {
        http_response_code(409);
        echo json_encode(['success' => false, 'quoteChanged' => true, 'message' => 'Your service price or payment requirement changed. Please review Pay Now again.']);
        exit();
    }

    $appointmentTimestamp = strtotime("$date $time");
    if ($appointmentTimestamp === false) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid date or time selected.']);
        exit();
    }
    $appointmentDateTime = date('Y-m-d H:i:s', $appointmentTimestamp);
    $durationMinutes = Scheduling::totalDurationMinutes($pdo, $serviceIds);

    if (Scheduling::isOutsideOperatingHours($appointmentDateTime, $durationMinutes, $branch['branch_key'])) {
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
        echo json_encode(['success' => false, 'message' => 'This time slot is fully booked. Please select another time.']);
        exit();
    }

    // Re-validate the guest's chosen staff member server-side (mirrors
    // getAvailableStaff.php): must be active at this branch, must cover
    // every selected service, and must have no overlapping appointment
    // during this window. Never trust the client's staff pick blindly --
    // availability may have changed since getAvailableStaff.php was called.
    $stmt = $pdo->prepare('SELECT id FROM employees WHERE id = ? AND branch_id = ? AND is_active = 1');
    $stmt->execute([$staffId, $branchId]);
    if (!$stmt->fetchColumn()) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'That time is no longer available. Please choose another schedule.']);
        exit();
    }

    $stmt = $pdo->prepare("SELECT COUNT(DISTINCT service_id) FROM staff_services WHERE employee_id = ? AND service_id IN ($servicePlaceholders)");
    $stmt->execute([$staffId, ...$serviceIds]);
    if ((int) $stmt->fetchColumn() !== count($serviceIds)) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No staff are available for this schedule. Please choose another time.']);
        exit();
    }

    if (Scheduling::staffHasConflict($pdo, $staffId, $appointmentDateTime, $durationMinutes)) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'That time is no longer available. Please choose another schedule.']);
        exit();
    }

    $employeeId = $staffId;

    // Reuse an existing customer record by phone, but only silently attach to
    // one with a linked (registered) account if the OTP-verified email
    // matches that account's email on file. Otherwise a stranger who merely
    // knows someone's phone number could get a booking attached to that
    // person's real account.
    $stmt = $pdo->prepare('SELECT c.id, u.email FROM customers c LEFT JOIN users u ON u.id = c.user_id WHERE c.phone_number = ?');
    $stmt->execute([$contact]);
    $existingCustomer = $stmt->fetch();

    if ($existingCustomer && $existingCustomer['email'] !== null && strcasecmp($existingCustomer['email'], $email) !== 0) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This mobile number is linked to an existing account. Please log in to book, or use the mobile number and email on that account.']);
        exit();
    }

    if ($existingCustomer) {
        $customerId = $existingCustomer['id'];
    } else {
        $ins = $pdo->prepare('INSERT INTO customers (first_name, last_name, phone_number) VALUES (?, ?, ?)');
        $ins->execute([$firstName, $lastName, $contact]);
        $customerId = $pdo->lastInsertId();
    }

    $referenceCode = ''; // Generated atomically by the database insert trigger.
    $notes = "Guest booking for {$fullName}, Phone: {$contact}" . ($email !== '' ? ", Email: {$email}" : '');

    // deposit_recorded_by stays NULL -- this deposit is self-reported by the
    // guest, not yet verified by staff. backend/admin/updateBookingStatus.php
    // (or the cashier equivalent) sets it once a staff member checks the
    // reference against their GCash/Maya account (or collects Cash in
    // person) and confirms the booking.
    $ins = $pdo->prepare('
        INSERT INTO appointments (
            reference_code, customer_id, employee_id, branch_id, appointment_datetime, total_price,
            preferred_payment_method, deposit_paid, deposit_amount, deposit_method, deposit_reference, deposit_recorded_at,
            status, payment_status, reminder_sent, notes, terms_accepted_at, reservation_requirement, reservation_amount_due
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NOW(), "Pending", "Awaiting Verification", 0, ?, NOW(), ?, ?)
    ');
    $ins->execute([
        $referenceCode, $customerId, $employeeId, $branchId, $appointmentDateTime, $subtotal,
        $paymentMethod, $depositAmount, $paymentMethod, $depositReference !== '' ? $depositReference : null, $notes, $quote['reservationRequirement'], $depositAmount,
    ]);
    $appointmentId = $pdo->lastInsertId();
    $refStmt = $pdo->prepare('SELECT reference_code FROM appointments WHERE id = ?');
    $refStmt->execute([$appointmentId]);
    $referenceCode = $refStmt->fetchColumn();

    $linkStmt = $pdo->prepare('INSERT INTO appointment_services (appointment_id, service_id) VALUES (?, ?)');
    foreach ($services as $service) {
        $linkStmt->execute([$appointmentId, $service['id']]);
    }

    if ($email !== '') {
        $pdo->prepare('DELETE FROM booking_verifications WHERE email = ?')->execute([$email]);
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => "Your appointment request has been received! Reference #: {$referenceCode}. We'll verify your deposit and contact you at {$contact} to confirm.",
        'reference' => $referenceCode,
        'payment' => $quote,
    ]);
} catch (PDOException | InvalidArgumentException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    error_log('submitGuestBooking error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while booking your appointment.']);
}
