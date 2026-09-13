<?php

/**
 * Customer Dashboard Data API Endpoint
 *
 * Returns everything the customer dashboard needs in one request: the
 * logged-in customer's profile, appointments, reviews, home service
 * requests, plus the shared catalogs (services/promotions/staff per
 * branch) and a branch-wide booking list used for time-slot availability.
 */

require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';

sendCorsHeaders();
header('Content-Type: application/json');

if (!isLoggedIn() || ($_SESSION['user_role'] ?? null) !== 'Customer') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please log in to view your dashboard.']);
    exit();
}

try {
    $pdo = Database::getInstance();
    $userId = $_SESSION['user_id'];

    $stmt = $pdo->prepare('
        SELECT c.id AS customer_id, c.first_name, c.last_name, c.phone_number,
               c.loyalty_points, c.notify_email, c.notify_sms, c.profile_picture, c.created_at,
               u.email
        FROM customers c
        JOIN users u ON u.id = c.user_id
        WHERE c.user_id = ?
        LIMIT 1
    ');
    $stmt->execute([$userId]);
    $customer = $stmt->fetch();

    if (!$customer) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Customer profile not found.']);
        exit();
    }

    $customerId = (int) $customer['customer_id'];

    $profile = [
        'name' => trim($customer['first_name'] . ' ' . $customer['last_name']),
        'email' => $customer['email'],
        'phone' => $customer['phone_number'],
        'memberSince' => date('Y-m-d', strtotime($customer['created_at'])),
        'loyaltyPoints' => (int) $customer['loyalty_points'],
        'profilePicture' => $customer['profile_picture'],
        'notificationPrefs' => [
            'email' => (bool) $customer['notify_email'],
            'sms' => (bool) $customer['notify_sms'],
        ],
    ];

    $stmt = $pdo->prepare("
        SELECT
            a.reference_code AS id,
            br.branch_name AS branchName,
            GROUP_CONCAT(s.service_name ORDER BY s.id SEPARATOR ', ') AS serviceName,
            a.total_price AS price,
            a.reservation_requirement AS reservationRequirement,
            a.reservation_amount_due AS amountDue,
            GREATEST(0, a.total_price - COALESCE(a.deposit_amount, 0)) AS remainingBalance,
            a.preferred_payment_method AS paymentMethod,
            a.deposit_amount AS depositAmount,
            a.deposit_reference AS depositReference,
            a.deposit_recorded_by IS NOT NULL AS depositVerified,
            CONCAT(e.first_name, ' ', e.last_name) AS staffName,
            DATE_FORMAT(a.appointment_datetime, '%Y-%m-%d') AS date,
            DATE_FORMAT(a.appointment_datetime, '%h:%i %p') AS time,
            a.status AS status,
            a.payment_status AS paymentStatus,
            a.reminder_sent AS reminderSent,
            COALESCE(SUM(s.duration_minutes), 30) AS durationMinutes
        FROM appointments a
        LEFT JOIN employees e ON e.id = a.employee_id
        LEFT JOIN branches br ON br.id = a.branch_id
        LEFT JOIN appointment_services aps ON aps.appointment_id = a.id
        LEFT JOIN services s ON s.id = aps.service_id
        WHERE a.customer_id = ?
        GROUP BY a.id
        ORDER BY a.appointment_datetime DESC
    ");
    $stmt->execute([$customerId]);
    $appointments = array_map(function ($row) {
        $row['price'] = (float) $row['price'];
        $row['amountDue'] = $row['amountDue'] !== null ? (float) $row['amountDue'] : null;
        $row['remainingBalance'] = (float) $row['remainingBalance'];
        $row['depositAmount'] = $row['depositAmount'] !== null ? (float) $row['depositAmount'] : null;
        $row['depositVerified'] = (bool) $row['depositVerified'];
        $row['reminderSent'] = (bool) $row['reminderSent'];
        $row['durationMinutes'] = (int) $row['durationMinutes'];
        return $row;
    }, $stmt->fetchAll());

    $stmt = $pdo->query("
        SELECT
            a.reference_code AS id,
            br.branch_key AS branchId,
            a.employee_id AS staffId,
            DATE_FORMAT(a.appointment_datetime, '%Y-%m-%d') AS date,
            DATE_FORMAT(a.appointment_datetime, '%h:%i %p') AS time,
            a.status AS status,
            COALESCE(SUM(s.duration_minutes), 30) AS durationMinutes
        FROM appointments a
        JOIN branches br ON br.id = a.branch_id
        LEFT JOIN appointment_services aps ON aps.appointment_id = a.id
        LEFT JOIN services s ON s.id = aps.service_id
        GROUP BY a.id
    ");
    $allBookings = array_map(function ($row) {
        $row['durationMinutes'] = (int) $row['durationMinutes'];
        $row['staffId'] = $row['staffId'] !== null ? (string) $row['staffId'] : null;
        return $row;
    }, $stmt->fetchAll());

    $stmt = $pdo->prepare("
        SELECT
            f.id AS id,
            a.reference_code AS appointmentId,
            GROUP_CONCAT(DISTINCT s.service_name ORDER BY s.id SEPARATOR ', ') AS serviceName,
            CONCAT(e.first_name, ' ', e.last_name) AS staffName,
            br.branch_name AS branchName,
            f.rating AS rating,
            f.comments AS comment,
            DATE_FORMAT(f.created_at, '%Y-%m-%d') AS date
        FROM feedback f
        JOIN appointments a ON a.id = f.appointment_id
        LEFT JOIN employees e ON e.id = a.employee_id
        LEFT JOIN branches br ON br.id = a.branch_id
        LEFT JOIN appointment_services aps ON aps.appointment_id = a.id
        LEFT JOIN services s ON s.id = aps.service_id
        WHERE f.customer_id = ?
        GROUP BY f.id
        ORDER BY f.created_at DESC
    ");
    $stmt->execute([$customerId]);
    $myReviews = array_map(function ($row) {
        $row['id'] = (string) $row['id'];
        $row['rating'] = (int) $row['rating'];
        return $row;
    }, $stmt->fetchAll());

    $stmt = $pdo->prepare("
        SELECT
            reference_code AS id,
            address,
            event_type AS eventType,
            DATE_FORMAT(preferred_date, '%Y-%m-%d') AS preferredDate,
            preferred_time AS preferredTime,
            deposit_amount AS depositAmount,
            deposit_method AS paymentMethod,
            deposit_reference AS depositReference,
            deposit_recorded_by IS NOT NULL AS depositVerified,
            requests,
            status,
            payment_status AS paymentStatus,
            DATE_FORMAT(submitted_at, '%Y-%m-%d') AS submittedDate
        FROM home_service_requests
        WHERE customer_id = ?
        ORDER BY submitted_at DESC
    ");
    $stmt->execute([$customerId]);
    $homeServiceRequests = array_map(function ($row) {
        $row['id'] = (string) $row['id'];
        $row['depositAmount'] = $row['depositAmount'] !== null ? (float) $row['depositAmount'] : null;
        $row['depositVerified'] = (bool) $row['depositVerified'];
        // Wedding package choice has no dedicated column -- it's folded
        // into the `requests` text at submission time (see
        // submitHomeServiceRequest.php). Pull it back out for display only.
        $row['weddingPackage'] = null;
        if ($row['requests'] && preg_match('/Wedding Package ([A-D])/', $row['requests'], $m)) {
            $row['weddingPackage'] = $m[1];
        }
        return $row;
    }, $stmt->fetchAll());

    $stmt = $pdo->query("
        SELECT br.branch_key, sv.id, sv.service_name AS name, sv.price, sv.category, sv.duration_label AS duration, sv.duration_minutes AS durationMinutes, sv.payment_requirement AS paymentRequirement
        FROM services sv
        JOIN branches br ON br.id = sv.branch_id
        WHERE sv.is_active = 1
        ORDER BY br.branch_key, sv.id
    ");
    $services = [];
    foreach ($stmt->fetchAll() as $row) {
        $branchKey = $row['branch_key'];
        unset($row['branch_key']);
        $row['id'] = (string) $row['id'];
        $row['price'] = (float) $row['price'];
        $row['durationMinutes'] = (int) $row['durationMinutes'];
        $services[$branchKey][] = $row;
    }

    $stmt = $pdo->query("
        SELECT br.branch_key, p.id, p.title, p.description, p.price,
               p.original_price AS originalPrice, p.service_id AS serviceId,
               sv.duration_label AS duration, sv.service_name AS serviceName
        FROM promotions p
        JOIN branches br ON br.id = p.branch_id
        LEFT JOIN services sv ON sv.id = p.service_id
        WHERE p.is_active = 1
        ORDER BY br.branch_key, p.id
    ");
    $promotions = [];
    foreach ($stmt->fetchAll() as $row) {
        $branchKey = $row['branch_key'];
        unset($row['branch_key']);
        $row['id'] = (string) $row['id'];
        $row['serviceId'] = $row['serviceId'] !== null ? (string) $row['serviceId'] : null;
        $row['price'] = (float) $row['price'];
        $row['originalPrice'] = (float) $row['originalPrice'];
        $promotions[$branchKey][] = $row;
    }

    $stmt = $pdo->query("
        SELECT br.branch_key AS branch, e.id, CONCAT(e.first_name, ' ', e.last_name) AS name, e.position AS role,
               (SELECT GROUP_CONCAT(ss.service_id) FROM staff_services ss WHERE ss.employee_id = e.id) AS serviceIdsRaw
        FROM employees e
        JOIN branches br ON br.id = e.branch_id
        WHERE e.is_active = 1
        ORDER BY br.branch_key, e.id
    ");
    $staff = array_map(function ($row) {
        $row['id'] = (string) $row['id'];
        $row['serviceIds'] = $row['serviceIdsRaw'] ? explode(',', $row['serviceIdsRaw']) : [];
        unset($row['serviceIdsRaw']);
        return $row;
    }, $stmt->fetchAll());

    // Real, backend-generated notifications (booking submitted, payment
    // verified, confirmed, etc. -- see backend/config/CustomerNotifier.php)
    // for this customer's own account, newest first.
    $stmt = $pdo->prepare("
        SELECT id, type, message, is_read AS isRead, DATE_FORMAT(created_at, '%Y-%m-%d %h:%i %p') AS time
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    ");
    $stmt->execute([$userId]);
    $notifications = array_map(function ($row) {
        $row['id'] = (string) $row['id'];
        $row['isRead'] = (bool) $row['isRead'];
        return $row;
    }, $stmt->fetchAll());

    echo json_encode([
        'success' => true,
        'profile' => $profile,
        'notifications' => $notifications,
        'appointments' => $appointments,
        'allBookings' => $allBookings,
        'reviews' => $myReviews,
        'homeServiceRequests' => $homeServiceRequests,
        'catalogs' => [
            'services' => $services,
            'promotions' => $promotions,
            'staff' => $staff,
        ],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('getDashboardData error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while loading your dashboard.']);
}
