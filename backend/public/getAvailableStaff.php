<?php

/**
 * Public: Get Available Staff
 *
 * No login required — powers the required "Select Staff" step of the guest
 * booking flow (after branch/services/date/time are chosen, before guest
 * details). Returns only staff who are active at the branch, can perform
 * every selected service (staff_services), and have no overlapping
 * appointment during the selected window. Mirrors the qualification and
 * conflict checks already used by admin/assignStaff.php,
 * cashier/assignStaff.php, and submitGuestBooking.php's auto-assignment —
 * see backend/config/Scheduling.php for the shared duration/overlap logic.
 */

require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/Scheduling.php';

sendCorsHeaders();
header('Content-Type: application/json');

$branchId = (int) ($_GET['branch'] ?? 0);
$date = trim($_GET['date'] ?? '');
$time = trim($_GET['time'] ?? '');
$serviceIds = $_GET['services'] ?? [];
if (!is_array($serviceIds)) {
    $serviceIds = [$serviceIds];
}
$serviceIds = array_values(array_unique(array_filter(array_map('intval', $serviceIds), fn($id) => $id > 0)));

if ($branchId <= 0 || $date === '' || $time === '' || empty($serviceIds)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'A branch, date, time, and at least one service are required.']);
    exit();
}

$appointmentTimestamp = strtotime("$date $time");
if ($appointmentTimestamp === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid date or time selected.']);
    exit();
}
$appointmentDateTime = date('Y-m-d H:i:s', $appointmentTimestamp);

try {
    $pdo = Database::getInstance();

    $stmt = $pdo->prepare('SELECT id FROM branches WHERE id = ?');
    $stmt->execute([$branchId]);
    if (!$stmt->fetchColumn()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid branch selected.']);
        exit();
    }

    $servicePlaceholders = implode(',', array_fill(0, count($serviceIds), '?'));
    $stmt = $pdo->prepare("
        SELECT e.id, e.first_name, e.last_name, e.position
        FROM employees e
        WHERE e.branch_id = ? AND e.is_active = 1
          AND (SELECT COUNT(DISTINCT service_id) FROM staff_services WHERE employee_id = e.id AND service_id IN ($servicePlaceholders)) = ?
        ORDER BY e.first_name, e.last_name
    ");
    $stmt->execute([$branchId, ...$serviceIds, count($serviceIds)]);
    $candidates = $stmt->fetchAll();

    $durationMinutes = Scheduling::totalDurationMinutes($pdo, $serviceIds);

    $staff = [];
    foreach ($candidates as $candidate) {
        if (!Scheduling::staffHasConflict($pdo, (int) $candidate['id'], $appointmentDateTime, $durationMinutes)) {
            $staff[] = [
                'id' => (string) $candidate['id'],
                'name' => trim($candidate['first_name'] . ' ' . $candidate['last_name']),
                'role' => $candidate['position'] ?: '',
            ];
        }
    }

    echo json_encode(['success' => true, 'staff' => $staff]);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('getAvailableStaff error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'A server error occurred while loading available staff.']);
}
