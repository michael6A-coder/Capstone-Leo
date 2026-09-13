<?php

/**
 * Duration-aware slot/staff conflict checks shared by every booking write
 * path (submitBooking, submitGuestBooking, admin/cashier assignStaff) and
 * the public slot picker (getAvailableSlots).
 *
 * An appointment's real length is the sum of its linked services'
 * duration_minutes, not a flat 30-minute grid cell. Two appointments
 * conflict when their [start, start+duration) windows overlap, not only
 * when they share the exact same start time.
 */
class Scheduling
{
    const DEFAULT_DURATION_MINUTES = 30;
    // How many concurrent appointments a branch can hold in the same
    // overlapping time window -- configured per branch (not one flat global
    // limit) so a smaller branch can be capped differently from a bigger
    // one. Same default (2) as before this became per-branch.
    // Fallback defaults only, used if a branch row is somehow missing its
    // configured hours/capacity. The real, admin-editable source of truth is
    // branches.opening_time/closing_time/sunday_*_time/slot_limit (see
    // Platform Settings -> Operating Hours / Booking Capacity, and migration
    // 033_services_reports_customers_settings.sql).
    const BOOKING_SLOT_LIMITS = [
        'daraga' => 2,
        'yashano' => 2,
        'cabangan' => 2,
    ];
    const BRANCH_HOURS = [
        'daraga' => ['08:00:00', '20:00:00'],
        'yashano' => ['09:30:00', '20:00:00'],
        'cabangan' => ['08:00:00', '20:00:00'],
    ];

    private static ?array $branchConfigCache = null;

    /** Lazily loaded once per request via the shared Database singleton -- no PDO param needed by every caller. */
    private static function branchConfig(string $branchKey): ?array
    {
        if (self::$branchConfigCache === null) {
            $pdo = Database::getInstance();
            $stmt = $pdo->query('SELECT branch_key, opening_time, closing_time, sunday_opening_time, sunday_closing_time, slot_limit FROM branches');
            self::$branchConfigCache = [];
            foreach ($stmt->fetchAll() as $row) {
                self::$branchConfigCache[$row['branch_key']] = $row;
            }
        }
        return self::$branchConfigCache[$branchKey] ?? null;
    }

    /**
     * Optionally pass the booking's date ($dateYmd, 'Y-m-d') to apply that
     * branch's distinct Sunday hours, if configured (sunday_opening_time/
     * sunday_closing_time both set) -- otherwise the regular daily hours
     * apply every day including Sunday, same as before this was configurable.
     */
    public static function operatingHours(string $branchKey, ?string $dateYmd = null): array
    {
        $row = self::branchConfig($branchKey);
        if (!$row) {
            return self::BRANCH_HOURS[$branchKey] ?? ['09:00:00', '20:00:00'];
        }
        if ($dateYmd !== null && (int) date('N', strtotime($dateYmd)) === 7
            && $row['sunday_opening_time'] && $row['sunday_closing_time']
        ) {
            return [$row['sunday_opening_time'], $row['sunday_closing_time']];
        }
        return [$row['opening_time'], $row['closing_time']];
    }

    /** This branch's configured concurrent-booking capacity. */
    public static function slotLimitForKey(string $branchKey): int
    {
        $row = self::branchConfig($branchKey);
        return $row ? (int) $row['slot_limit'] : (self::BOOKING_SLOT_LIMITS[$branchKey] ?? 2);
    }

    /** Same, looked up by numeric branch id (what most callers have on hand). */
    public static function slotLimit(PDO $pdo, int $branchId): int
    {
        $stmt = $pdo->prepare('SELECT branch_key FROM branches WHERE id = ? LIMIT 1');
        $stmt->execute([$branchId]);
        $branchKey = $stmt->fetchColumn();
        return $branchKey ? self::slotLimitForKey($branchKey) : 2;
    }

    /** Build 30-minute booking starts from opening until the final half-hour before closing. */
    public static function timeSlots(string $branchKey, ?string $dateYmd = null): array
    {
        [$openingTime, $closingTime] = self::operatingHours($branchKey, $dateYmd);
        $cursor = new DateTime('2000-01-01 ' . $openingTime);
        $closing = new DateTime('2000-01-01 ' . $closingTime);
        $slots = [];
        while ($cursor < $closing) {
            $slots[] = $cursor->format('h:i A');
            $cursor->modify('+30 minutes');
        }
        return $slots;
    }

    /** Total minutes for a set of service IDs. Falls back to 30 min/service if duration_minutes isn't set. */
    public static function totalDurationMinutes(PDO $pdo, array $serviceIds): int
    {
        if (empty($serviceIds)) {
            return self::DEFAULT_DURATION_MINUTES;
        }
        $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(duration_minutes), 0) FROM services WHERE id IN ($placeholders)");
        $stmt->execute($serviceIds);
        $total = (int) $stmt->fetchColumn();
        return $total > 0 ? $total : self::DEFAULT_DURATION_MINUTES * count($serviceIds);
    }

    /** True if a booking starts before opening or finishes after this branch closes. */
    public static function isOutsideOperatingHours(string $startDateTime, int $durationMinutes, string $branchKey): bool
    {
        $start = new DateTime($startDateTime);
        $end = (clone $start)->modify("+{$durationMinutes} minutes");
        [$openingTime, $closingTime] = self::operatingHours($branchKey, $start->format('Y-m-d'));
        $opening = new DateTime($start->format('Y-m-d') . ' ' . $openingTime);
        $closing = new DateTime($start->format('Y-m-d') . ' ' . $closingTime);
        return $start < $opening || $end > $closing;
    }

    /**
     * Counts non-cancelled appointments whose [start, start+duration) window
     * overlaps [$startDateTime, $startDateTime+$durationMinutes), optionally
     * narrowed to one branch and/or one staff member. Uses a locking read
     * (FOR UPDATE) so concurrent bookings for the same day/branch/staff are
     * serialized -- call within a transaction.
     */
    public static function countOverlapping(
        PDO $pdo,
        ?int $branchId,
        ?int $employeeId,
        string $startDateTime,
        int $durationMinutes,
        ?int $excludeAppointmentId = null
    ): int {
        $newStart = new DateTime($startDateTime);
        $newEnd = (clone $newStart)->modify("+{$durationMinutes} minutes");

        $sql = "SELECT id, appointment_datetime FROM appointments WHERE status != 'Cancelled' AND DATE(appointment_datetime) = ?";
        $params = [$newStart->format('Y-m-d')];
        if ($branchId !== null) {
            $sql .= ' AND branch_id = ?';
            $params[] = $branchId;
        }
        if ($employeeId !== null) {
            $sql .= ' AND employee_id = ?';
            $params[] = $employeeId;
        }
        if ($excludeAppointmentId !== null) {
            $sql .= ' AND id != ?';
            $params[] = $excludeAppointmentId;
        }
        $sql .= ' FOR UPDATE';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $candidates = $stmt->fetchAll();
        if (empty($candidates)) {
            return 0;
        }

        $ids = array_column($candidates, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("
            SELECT aps.appointment_id, SUM(s.duration_minutes) AS total
            FROM appointment_services aps
            JOIN services s ON s.id = aps.service_id
            WHERE aps.appointment_id IN ($placeholders)
            GROUP BY aps.appointment_id
        ");
        $stmt->execute($ids);
        $durations = [];
        foreach ($stmt->fetchAll() as $row) {
            $durations[$row['appointment_id']] = (int) $row['total'];
        }

        $overlapping = 0;
        foreach ($candidates as $candidate) {
            $duration = $durations[$candidate['id']] ?? 0;
            if ($duration <= 0) {
                $duration = self::DEFAULT_DURATION_MINUTES;
            }
            $existingStart = new DateTime($candidate['appointment_datetime']);
            $existingEnd = (clone $existingStart)->modify("+{$duration} minutes");
            if ($existingStart < $newEnd && $newStart < $existingEnd) {
                $overlapping++;
            }
        }

        return $overlapping;
    }

    /** True if this branch is already at its own configured slot limit for concurrent appointments during this window. */
    public static function branchWindowIsFull(
        PDO $pdo,
        int $branchId,
        string $startDateTime,
        int $durationMinutes,
        ?int $excludeAppointmentId = null
    ): bool {
        return self::countOverlapping($pdo, $branchId, null, $startDateTime, $durationMinutes, $excludeAppointmentId) >= self::slotLimit($pdo, $branchId);
    }

    // Home service jobs have no per-service duration data (no catalog item
    // is attached to a home service request), so a flat block is used for
    // conflict checking -- same idea as DEFAULT_DURATION_MINUTES above, just
    // sized for an off-site job instead of a single salon service.
    const HOME_SERVICE_DURATION_MINUTES = 120;

    /**
     * True if this staff member is already busy -- either with a salon
     * appointment or another home service job -- during the window starting
     * at $date/$time. Checked against both tables since a stylist sent
     * off-site is the same person who could otherwise be booked in-branch.
     */
    public static function homeServiceStaffHasConflict(
        PDO $pdo,
        int $employeeId,
        string $date,
        string $time,
        ?int $excludeRequestId = null
    ): bool {
        $startDateTime = $date . ' ' . $time;
        if (self::staffHasConflict($pdo, $employeeId, $startDateTime, self::HOME_SERVICE_DURATION_MINUTES)) {
            return true;
        }

        $sql = "SELECT preferred_time FROM home_service_requests
                WHERE employee_id = ? AND preferred_date = ? AND status NOT IN ('Cancelled', 'Completed')";
        $params = [$employeeId, $date];
        if ($excludeRequestId !== null) {
            $sql .= ' AND id != ?';
            $params[] = $excludeRequestId;
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $newStart = new DateTime($startDateTime);
        $newEnd = (clone $newStart)->modify('+' . self::HOME_SERVICE_DURATION_MINUTES . ' minutes');
        foreach ($stmt->fetchAll() as $row) {
            $existingStart = new DateTime($date . ' ' . ($row['preferred_time'] ?: '09:00:00'));
            $existingEnd = (clone $existingStart)->modify('+' . self::HOME_SERVICE_DURATION_MINUTES . ' minutes');
            if ($existingStart < $newEnd && $newStart < $existingEnd) {
                return true;
            }
        }
        return false;
    }

    /** True if this specific staff member has any appointment overlapping this window. */
    public static function staffHasConflict(
        PDO $pdo,
        int $employeeId,
        string $startDateTime,
        int $durationMinutes,
        ?int $excludeAppointmentId = null
    ): bool {
        return self::countOverlapping($pdo, null, $employeeId, $startDateTime, $durationMinutes, $excludeAppointmentId) > 0;
    }

    /**
     * Automatic attendance Time Out. There's no cron/background worker in
     * this project, and browser-close events are unreliable (tab killed,
     * laptop closed, crash), so this closes any open attendance row for the
     * employee the moment it's next checked (every staff dashboard load and
     * login) if the branch's shift hours for that work day have ended --
     * unless the employee still has real work in progress, in which case
     * their shift is left open rather than force-closed.
     *
     * No per-employee shift-schedule table exists in this project, so the
     * assigned branch's closing time (self::BRANCH_HOURS) is always the
     * fallback used. "Approved overtime" has no backing feature/table here
     * either, so it isn't checked -- only real in-progress work does.
     */
    public static function autoCloseAttendance(PDO $pdo, int $employeeId, ?int $branchId): void
    {
        if (!$branchId) {
            return;
        }

        $stmt = $pdo->prepare("
            SELECT id, clock_in_time, DATE(clock_in_time) AS work_date
            FROM attendance
            WHERE employee_id = ? AND clock_out_time IS NULL
        ");
        $stmt->execute([$employeeId]);
        $openRows = $stmt->fetchAll();
        if (!$openRows) {
            return;
        }

        $stmt = $pdo->prepare('SELECT branch_key FROM branches WHERE id = ? LIMIT 1');
        $stmt->execute([$branchId]);
        $branchKey = $stmt->fetchColumn();
        if (!$branchKey) {
            return;
        }
        [, $closingTime] = self::operatingHours($branchKey);

        foreach ($openRows as $row) {
            $shiftEnd = $row['work_date'] . ' ' . $closingTime;

            // A staff member who clocks in after the branch's closing time
            // has already passed (e.g. logging in late) would otherwise get
            // a clock_out_time earlier than their own clock_in_time --
            // leave those open rather than record negative hours worked.
            if ($shiftEnd <= $row['clock_in_time']) {
                continue;
            }

            // Compared via MySQL's own NOW() rather than PHP's clock -- they
            // can run in different timezones, and clock_in_time itself was
            // already stamped using MySQL's NOW(), so this is the only
            // comparison guaranteed to agree with it.
            $stmt = $pdo->prepare('SELECT NOW() >= ?');
            $stmt->execute([$shiftEnd]);
            if (!$stmt->fetchColumn()) {
                continue; // Branch hours haven't ended yet for this work day -- stays On Shift.
            }

            $stmt = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE employee_id = ? AND status = 'In Progress'");
            $stmt->execute([$employeeId]);
            $hasActiveAppointment = (int) $stmt->fetchColumn() > 0;

            $stmt = $pdo->prepare("SELECT COUNT(*) FROM home_service_requests WHERE employee_id = ? AND status = 'Confirmed'");
            $stmt->execute([$employeeId]);
            $hasActiveHomeService = (int) $stmt->fetchColumn() > 0;

            if ($hasActiveAppointment || $hasActiveHomeService) {
                continue; // Real work still open -- don't force Off Shift.
            }

            $pdo->prepare('UPDATE attendance SET clock_out_time = ? WHERE id = ?')
                ->execute([$shiftEnd, $row['id']]);
        }
    }
}
