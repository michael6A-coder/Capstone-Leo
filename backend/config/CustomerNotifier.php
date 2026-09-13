<?php

/**
 * Writes customer-facing notifications (notifications.user_id set to the
 * customer's own account) so the dashboard bell/panel can show real backend
 * events instead of only the client-simulated ones. Reused by every booking
 * write path instead of duplicating the "look up this customer's user_id
 * and insert if they have an account" logic in each file.
 *
 * Guest bookings have no linked user account (customers.user_id is NULL for
 * them), so there's nothing to notify here -- guests already have Track a
 * Booking for status updates instead.
 */
final class CustomerNotifier
{
    public static function notify(PDO $pdo, int $customerId, string $type, string $message): void
    {
        $stmt = $pdo->prepare('SELECT user_id FROM customers WHERE id = ? LIMIT 1');
        $stmt->execute([$customerId]);
        $userId = $stmt->fetchColumn();
        if (!$userId) {
            return;
        }
        $pdo->prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)')
            ->execute([$userId, $type, $message]);
    }
}
