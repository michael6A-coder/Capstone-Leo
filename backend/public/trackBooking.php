<?php

/**
 * Public: Track a Booking
 *
 * No login required. Looks up a guest's salon appointment or home &
 * event service request by reference code + the mobile number on file,
 * for the "Track your booking" flow on the public landing page. Both
 * reference and phone are required — a booking's reference alone isn't
 * treated as sufficient proof of ownership, since it's shown on screen
 * and could be shoulder-surfed or shared.
 */

require_once '../config/cors.php';
require_once '../config/database.php';

sendCorsHeaders();
header('Content-Type: application/json');

$reference = strtoupper(trim($_GET['reference'] ?? ''));
$phone = trim($_GET['phone'] ?? '');

if ($reference === '' || $phone === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Enter both the booking reference and the mobile number used for it.']);
    exit();
}

try {
    $pdo = Database::getInstance();

    $stmt = $pdo->prepare("
        SELECT
            a.id, a.reference_code AS reference, a.status, a.appointment_datetime, a.total_price,
            br.branch_name AS branch, c.phone_number AS phone,
            GROUP_CONCAT(DISTINCT s.service_name ORDER BY s.id SEPARATOR ', ') AS services,
            EXISTS(SELECT 1 FROM feedback f WHERE f.appointment_id = a.id) AS has_feedback
        FROM appointments a
        JOIN customers c ON c.id = a.customer_id
        LEFT JOIN branches br ON br.id = a.branch_id
        LEFT JOIN appointment_services aps ON aps.appointment_id = a.id
        LEFT JOIN services s ON s.id = aps.service_id
        WHERE a.reference_code = ?
        GROUP BY a.id
    ");
    $stmt->execute([$reference]);
    $appt = $stmt->fetch();

    if ($appt) {
        if ($appt['phone'] !== $phone) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No booking found for that reference and mobile number.']);
            exit();
        }

        echo json_encode([
            'success' => true,
            'type' => 'appointment',
            'reference' => $appt['reference'],
            'status' => $appt['status'],
            'branch' => $appt['branch'],
            'services' => $appt['services'],
            'price' => $appt['total_price'] !== null ? (float) $appt['total_price'] : null,
            'date' => date('Y-m-d', strtotime($appt['appointment_datetime'])),
            'time' => date('h:i A', strtotime($appt['appointment_datetime'])),
            'canReview' => $appt['status'] === 'Completed' && !$appt['has_feedback'],
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        SELECT
            h.id, h.reference_code AS reference, h.status, h.event_type, h.preferred_date, h.address, h.requests,
            c.phone_number AS phone,
            EXISTS(SELECT 1 FROM feedback f WHERE f.home_service_request_id = h.id) AS has_feedback
        FROM home_service_requests h
        JOIN customers c ON c.id = h.customer_id
        WHERE h.reference_code = ?
    ");
    $stmt->execute([$reference]);
    $hs = $stmt->fetch();

    if ($hs) {
        if ($hs['phone'] !== $phone) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No booking found for that reference and mobile number.']);
            exit();
        }

        echo json_encode([
            'success' => true,
            'type' => 'home_service',
            'reference' => $hs['reference'],
            'status' => $hs['status'],
            'event' => $hs['event_type'],
            'date' => $hs['preferred_date'],
            'venue' => $hs['address'],
            'requests' => $hs['requests'],
            'canReview' => $hs['status'] === 'Completed' && !$hs['has_feedback'],
        ]);
        exit();
    }

    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'No booking found for that reference and mobile number.']);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('trackBooking error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while looking up your booking.']);
}
