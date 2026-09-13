<?php

require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';
require_once '../config/CustomerNotifier.php';
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
$status = trim($_POST['status'] ?? '');
// A staff-supplied payment status is only ever honored for the three
// "problem" outcomes below -- the "good" outcomes (Awaiting Verification,
// Down Payment Verified, Fully Paid) are always derived by the backend
// from real business state (the deposit that was actually recorded, and
// which services require full vs. partial payment), never picked by a
// staff member out of thin air, and never settable by the customer at all
// (this endpoint is Admin-only, see the role check above).
$staffPaymentStatus = trim($_POST['paymentStatus'] ?? '');
$allowedStaffPaymentStatuses = ['Rejected', 'Refunded', 'Forfeited'];

if ($referenceCode === '' || $status === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid booking reference or status.']);
    exit();
}

if ($staffPaymentStatus !== '' && !in_array($staffPaymentStatus, $allowedStaffPaymentStatuses, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid payment status.']);
    exit();
}

try {
    $pdo = Database::getInstance();

    // Home service requests are folded into the same bookings list the
    // frontend renders (see getDashboardData.php) and use their own status
    // enum ('Pending Review'/'Confirmed'/'Completed'/'Cancelled' -- no
    // 'In Progress'). Unlike salon appointments there's no separate
    // deposit-entry modal for these -- the deposit was already self-reported
    // by the customer at request time (see submitGuestHomeService.php /
    // submitHomeServiceRequest.php), so confirming here also verifies it
    // (staff are expected to have checked the reference beforehand, same
    // trust model as the deposit modal's "Verify & Confirm").
    $stmt = $pdo->prepare('SELECT id, customer_id, employee_id, deposit_paid, deposit_recorded_by FROM home_service_requests WHERE reference_code = ? LIMIT 1');
    $stmt->execute([$referenceCode]);
    $homeService = $stmt->fetch();
    if ($homeService) {
        $allowedHomeStatuses = [
            'Pending Review', 'Quote Ready', 'Payment Required', 'Payment Being Verified',
            'Confirmed', 'Staff Assigned', 'Service in Progress', 'Completed', 'Cancelled',
        ];
        if (!in_array($status, $allowedHomeStatuses, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid status for a home service request.']);
            exit();
        }

        $homeServiceId = $homeService['id'];
        $homeServiceCustomerId = (int) $homeService['customer_id'];

        if ($status === 'Confirmed' && $homeService['deposit_paid'] && $homeService['deposit_recorded_by'] === null) {
            // A home service request has no per-service catalog to check for a
            // "Full Payment" requirement (unlike salon appointments), so
            // confirming one always resolves to 'Down Payment Verified'.
            $pdo->prepare("UPDATE home_service_requests SET status = ?, payment_status = 'Down Payment Verified', deposit_recorded_by = ?, deposit_recorded_at = NOW() WHERE id = ?")
                ->execute([$status, $_SESSION['user_id'], $homeServiceId]);
            CustomerNotifier::notify($pdo, $homeServiceCustomerId, 'PAYMENT_VERIFIED', "Your reservation payment for {$referenceCode} has been verified. Status: Reservation Payment Received.");
            CustomerNotifier::notify($pdo, $homeServiceCustomerId, 'CONFIRMED', "Your home service request {$referenceCode} is now Confirmed.");
        } elseif ($staffPaymentStatus !== '') {
            $pdo->prepare('UPDATE home_service_requests SET status = ?, payment_status = ? WHERE id = ?')
                ->execute([$status, $staffPaymentStatus, $homeServiceId]);
            if ($staffPaymentStatus === 'Rejected') {
                CustomerNotifier::notify($pdo, $homeServiceCustomerId, 'PAYMENT_ATTENTION', "Your reservation payment for {$referenceCode} needs attention. Please contact the branch.");
            }
        } else {
            $pdo->prepare('UPDATE home_service_requests SET status = ? WHERE id = ?')->execute([$status, $homeServiceId]);
            if ($status === 'Cancelled') {
                CustomerNotifier::notify($pdo, $homeServiceCustomerId, 'CANCELLED', "Your home service request {$referenceCode} has been cancelled.");
                if ($homeService['employee_id'] !== null) {
                    StaffNotifier::notify($pdo, (int) $homeService['employee_id'], 'APPOINTMENT_CANCELLED', "Home service request {$referenceCode} was cancelled.");
                }
            } elseif ($status === 'Completed') {
                CustomerNotifier::notify($pdo, $homeServiceCustomerId, 'COMPLETED', "Your home service request {$referenceCode} is now Completed. Thank you for choosing us!");
            }
        }

        $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "BOOKING", ?)')
            ->execute(["Home service request {$referenceCode} status updated to {$status}."]);

        echo json_encode(['success' => true, 'message' => 'Request status updated.']);
        exit();
    }

    $allowedStatuses = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'Reviewed', 'No-Show', 'Reschedule Requested', 'Reschedule Required'];
    if (!in_array($status, $allowedStatuses, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid booking reference or status.']);
        exit();
    }

    // Confirming a reservation requires recording a deposit -- an unpaid Pending
    // booking stays soft/adjustable, but a deposit "locks" it and gives it
    // priority over any other unpaid claim on the same stylist/time.
    $allowedDepositMethods = ['Cash', 'GCash', 'Maya'];
    $depositAmount = null;
    $depositMethod = null;
    if ($status === 'Confirmed') {
        $depositAmount = filter_var($_POST['depositAmount'] ?? '', FILTER_VALIDATE_FLOAT);
        $depositMethod = trim($_POST['depositMethod'] ?? '');
        if ($depositAmount === false || $depositAmount <= 0 || !in_array($depositMethod, $allowedDepositMethods, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'A deposit amount and payment method are required to confirm a booking.']);
            exit();
        }
    }

    $stmt = $pdo->prepare('SELECT id, customer_id, employee_id, branch_id, appointment_datetime, total_price, deposit_amount, reservation_amount_due FROM appointments WHERE reference_code = ? LIMIT 1');
    $stmt->execute([$referenceCode]);
    $appointment = $stmt->fetch();
    if (!$appointment) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Booking not found.']);
        exit();
    }
    $appointmentCustomerId = (int) $appointment['customer_id'];

    if ($status === 'Confirmed') {
        // Already-Confirmed wins: an unpaid Pending collision must not block
        // a legitimate first confirmation, so this only checks other
        // Confirmed bookings, not the broader "!= Cancelled" set.
        if ($appointment['employee_id'] !== null) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE branch_id = ? AND employee_id = ? AND appointment_datetime = ? AND status = 'Confirmed' AND id != ?");
            $stmt->execute([$appointment['branch_id'], $appointment['employee_id'], $appointment['appointment_datetime'], $appointment['id']]);
            if ((int) $stmt->fetchColumn() > 0) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'This stylist already has a confirmed booking at this exact date and time. Reassign staff or resolve the conflict first.']);
                exit();
            }
        }

        // Verify against the original backend quote, even if the catalog changes later.
        $minimum = (float) ($appointment['reservation_amount_due'] ?? $appointment['deposit_amount'] ?? 0);
        $total = (float) $appointment['total_price'];
        if (!is_finite((float) $depositAmount) || $depositAmount < $minimum - 0.001 || $depositAmount > $total + 0.001) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'The verified payment must cover Pay Now and cannot exceed the booking total.']);
            exit();
        }
        $resolvedPaymentStatus = round($depositAmount * 100) >= round($total * 100)
            ? 'Fully Paid' : 'Down Payment Verified';

        $pdo->prepare('UPDATE appointments SET status = ?, payment_status = ?, deposit_paid = 1, deposit_amount = ?, deposit_method = ?, deposit_recorded_by = ?, deposit_recorded_at = NOW() WHERE id = ?')
            ->execute([$status, $resolvedPaymentStatus, $depositAmount, $depositMethod, $_SESSION['user_id'], $appointment['id']]);
        $paymentVerifiedLabel = $resolvedPaymentStatus === 'Fully Paid' ? 'Paid in Full' : 'Reservation Payment Received';
        CustomerNotifier::notify($pdo, $appointmentCustomerId, 'PAYMENT_VERIFIED', "Your payment for {$referenceCode} has been verified. Status: {$paymentVerifiedLabel}.");
        CustomerNotifier::notify($pdo, $appointmentCustomerId, 'CONFIRMED', "Your appointment {$referenceCode} is now Confirmed.");
    } elseif ($staffPaymentStatus !== '') {
        $pdo->prepare('UPDATE appointments SET status = ?, payment_status = ? WHERE id = ?')
            ->execute([$status, $staffPaymentStatus, $appointment['id']]);
        if ($staffPaymentStatus === 'Rejected') {
            CustomerNotifier::notify($pdo, $appointmentCustomerId, 'PAYMENT_ATTENTION', "Your payment for {$referenceCode} needs attention. Please contact the branch.");
        }
    } else {
        $pdo->prepare('UPDATE appointments SET status = ? WHERE id = ?')->execute([$status, $appointment['id']]);
        if ($status === 'Cancelled') {
            CustomerNotifier::notify($pdo, $appointmentCustomerId, 'CANCELLED', "Your appointment {$referenceCode} has been cancelled.");
            if ($appointment['employee_id'] !== null) {
                StaffNotifier::notify($pdo, (int) $appointment['employee_id'], 'APPOINTMENT_CANCELLED', "Appointment {$referenceCode} was cancelled.");
            }
        } elseif ($status === 'Completed') {
            CustomerNotifier::notify($pdo, $appointmentCustomerId, 'COMPLETED', "Your appointment {$referenceCode} is now Completed. Thank you for choosing us!");
        } elseif (in_array($status, ['Reschedule Requested', 'Reschedule Required'], true)) {
            CustomerNotifier::notify($pdo, $appointmentCustomerId, 'RESCHEDULE', "Your appointment {$referenceCode} needs a schedule change. Please check the details.");
            if ($appointment['employee_id'] !== null) {
                StaffNotifier::notify($pdo, (int) $appointment['employee_id'], 'SCHEDULE_CHANGED', "Appointment {$referenceCode}'s schedule needs a change.");
            }
        }
    }

    $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (NULL, "BOOKING", ?)')
        ->execute(["Booking {$referenceCode} status updated to {$status}."]);

    echo json_encode(['success' => true, 'message' => 'Booking status updated.']);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('admin updateBookingStatus error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while updating the booking.']);
}
