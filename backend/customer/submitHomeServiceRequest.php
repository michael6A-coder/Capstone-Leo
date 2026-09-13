<?php

/**
 * Submit Home Service Request API Endpoint
 *
 * Records a new home service request for the logged-in customer.
 *
 * Preferred date/time is a REQUEST only -- it is not confirmed on
 * submission. No deposit or payment is collected here; admin reviews the
 * request and determines availability, pricing, staff, and whether a
 * reservation payment is required (see backend/admin/updateBookingStatus.php).
 * The request starts at status 'Pending Review' / payment_status
 * 'Payment Required' (both column defaults).
 */

require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';

sendCorsHeaders();
header('Content-Type: application/json');

if (!isLoggedIn() || ($_SESSION['user_role'] ?? null) !== 'Customer') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please log in to request a home service.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit();
}

$address = trim($_POST['address'] ?? '');
$eventType = trim($_POST['eventType'] ?? '');
$preferredDate = trim($_POST['preferredDate'] ?? '');
$preferredTime = trim($_POST['preferredTime'] ?? '');
$requests = trim($_POST['requests'] ?? '');
$weddingPackage = trim($_POST['weddingPackage'] ?? '');
$agreedToTerms = filter_var($_POST['agreedToTerms'] ?? false, FILTER_VALIDATE_BOOLEAN);

// Fixed wedding package pricing. Packages A-C have no fixed reservation
// fee (confirmed after review); only Package D carries the ₱2,000
// reservation fee, applied only when that package is chosen -- never
// auto-applied to A-C.
$weddingPackages = [
    'A' => ['price' => 5000, 'fee' => null],
    'B' => ['price' => 8000, 'fee' => null],
    'C' => ['price' => 10000, 'fee' => null],
    'D' => ['price' => 12000, 'fee' => 2000],
];

if ($address === '' || $preferredDate === '' || $preferredTime === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please provide your address, preferred date, and preferred time.']);
    exit();
}

if ($eventType === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please specify the event type.']);
    exit();
}

if ($eventType === 'Wedding' && !array_key_exists($weddingPackage, $weddingPackages)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please choose a wedding package.']);
    exit();
}

if (!$agreedToTerms) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please agree to the Terms and Conditions to continue.']);
    exit();
}

// The table has no dedicated package/price columns, so the package choice
// (and its price/reservation fee for Wedding) is folded into the
// free-text `requests` field, same pattern used elsewhere in this app for
// details without their own column (see submitGuestHomeService.php).
$fullRequests = $requests;
if ($eventType === 'Wedding' && isset($weddingPackages[$weddingPackage])) {
    $pkg = $weddingPackages[$weddingPackage];
    $packageLine = "Wedding Package {$weddingPackage} (₱" . number_format($pkg['price']) . ')';
    if ($pkg['fee'] !== null) {
        $packageLine .= ' -- Reservation Fee ₱' . number_format($pkg['fee']) . ', Remaining Balance ₱' . number_format($pkg['price'] - $pkg['fee']);
    } else {
        $packageLine .= ' -- Reservation Fee: To be confirmed after review.';
    }
    $fullRequests = $packageLine . ($fullRequests !== '' ? "\n\n{$fullRequests}" : '');
}

try {
    $pdo = Database::getInstance();
    $userId = $_SESSION['user_id'];

    $stmt = $pdo->prepare('SELECT id FROM customers WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $customerId = $stmt->fetchColumn();
    if (!$customerId) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Customer profile not found.']);
        exit();
    }

    $ins = $pdo->prepare('
        INSERT INTO home_service_requests (
            customer_id, address, event_type, wedding_package, preferred_date, preferred_time,
            requests, terms_accepted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ');
    $ins->execute([
        $customerId, $address, $eventType, $eventType === 'Wedding' ? $weddingPackage : null, $preferredDate, $preferredTime, $fullRequests,
    ]);
    $requestId = $pdo->lastInsertId();
    $refStmt = $pdo->prepare('SELECT reference_code FROM home_service_requests WHERE id = ?');
    $refStmt->execute([$requestId]);
    $referenceCode = $refStmt->fetchColumn();

    echo json_encode([
        'success' => true,
        'message' => "Home service request {$referenceCode} submitted! Our team will review it and contact you about availability, pricing, staff assignment, and any required reservation payment.",
        'reference' => $referenceCode,
        'request' => [
            'id' => $referenceCode,
            'address' => $address,
            'eventType' => $eventType,
            'weddingPackage' => $eventType === 'Wedding' ? $weddingPackage : null,
            'preferredDate' => $preferredDate,
            'preferredTime' => $preferredTime,
            'requests' => $requests,
            'depositAmount' => null,
            'paymentMethod' => null,
            'depositReference' => null,
            'depositVerified' => false,
            'status' => 'Pending Review',
            'submittedDate' => date('Y-m-d'),
        ],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('submitHomeServiceRequest error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while submitting your request.']);
}
