<?php
require_once '../config/cors.php';
require_once '../config/session.php';
require_once '../config/database.php';
require_once '../config/RateLimiter.php';
require_once '../config/Scheduling.php';
sendCorsHeaders();
header('Content-Type: application/json');

function portalResponse(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    portalResponse(405, ['success' => false, 'message' => 'Invalid request method.']);
}
$role = $_POST['role'] ?? '';
$pin = $_POST['pin'] ?? '';
if (!is_string($role) || !in_array($role, ['Staff', 'Cashier', 'Admin'], true)
    || !is_string($pin) || !preg_match('/^[0-9]{4,12}$/D', $pin)) {
    portalResponse(400, ['success' => false, 'message' => 'Select an account role and enter a 4–12 digit PIN.']);
}
try {
    $limiter = new RateLimiter(RateLimiter::getIpAddress(), 'login_fail', 5, 900);
    if ($limiter->isExceeded()) {
        portalResponse(429, ['success' => false, 'message' => 'Too many failed attempts. Please try again in 15 minutes.']);
    }
    $pdo = Database::getInstance();
    $stmt = $pdo->prepare('SELECT u.id, u.email, u.pin_hash, u.branch_id, u.display_name,
        r.role_name, e.first_name, e.last_name FROM users u
        JOIN roles r ON u.role_id = r.id LEFT JOIN employees e ON e.user_id = u.id
        WHERE r.role_name = ? AND u.is_active = 1 AND u.pin_hash IS NOT NULL');
    $stmt->execute([$role]);
    $matches = [];
    while ($candidate = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (password_verify($pin, $candidate['pin_hash'])) $matches[$candidate['id']] = $candidate;
    }
    // A role and PIN must identify exactly one account; never choose arbitrarily.
    if (count($matches) !== 1) {
        $limiter->record();
        portalResponse(401, ['success' => false, 'message' => 'Unable to verify this role and PIN. Use email and password or contact your administrator.']);
    }
    $user = reset($matches);
    $limiter->clear();
    regenerateSession();

    // Same automatic time-in as backend/auth/login.php -- attendance is tied
    // to the authenticated session, not a manual clock button, regardless of
    // which sign-in method (email/password or role+PIN) staff use.
    if ($user['role_name'] === 'Staff') {
        $stmt = $pdo->prepare('SELECT id, branch_id FROM employees WHERE user_id = ? LIMIT 1');
        $stmt->execute([$user['id']]);
        $employeeRow = $stmt->fetch();
        if ($employeeRow) {
            $employeeId = (int) $employeeRow['id'];
            Scheduling::autoCloseAttendance($pdo, $employeeId, $employeeRow['branch_id']);

            $stmt = $pdo->prepare('SELECT id FROM attendance WHERE employee_id = ? AND DATE(clock_in_time) = CURDATE() AND clock_out_time IS NULL LIMIT 1');
            $stmt->execute([$employeeId]);
            if (!$stmt->fetchColumn()) {
                $pdo->prepare('INSERT INTO attendance (employee_id, clock_in_time) VALUES (?, NOW())')->execute([$employeeId]);
            }
        }
    }
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['role_name'];
    $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
    $_SESSION['user_name'] = $name !== '' ? $name : ($user['display_name'] ?? '');
    $_SESSION['branch_id'] = $user['branch_id'] !== null ? (int) $user['branch_id'] : null;
    portalResponse(200, ['success' => true, 'redirect' => getRoleDashboardUrl($user['role_name'])]);
} catch (PDOException $error) {
    portalResponse(503, ['success' => false, 'message' => 'PIN sign-in is currently unavailable. Please use email and password instead.']);
}
