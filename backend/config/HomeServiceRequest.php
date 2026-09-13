<?php

/** Shared validation and package details for guest and customer home service requests. */
class HomeServiceRequest
{
    const PACKAGES = [
        'A' => ['price' => 5000, 'fee' => null],
        'B' => ['price' => 8000, 'fee' => null],
        'C' => ['price' => 10000, 'fee' => null],
        'D' => ['price' => 12000, 'fee' => 2000],
    ];
    const SERVICES = ['Hair Styling', 'Event Makeup', 'Brow Services', 'Lash Services', 'Hair & Makeup Package'];

    public static function validate(string $date, string $time, string $event, string $package, string $clients, array $services): ?string
    {
        $zone = new DateTimeZone('Asia/Manila');
        $day = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $zone);
        if (!$day || $day->format('Y-m-d') !== $date) return 'Please select a valid preferred date.';
        if (!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/', $time)) return 'Please select a valid preferred time.';
        if (new DateTimeImmutable("$date $time", $zone) <= new DateTimeImmutable('now', $zone)) return 'Please choose a future date and time.';
        if (filter_var($clients, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) return 'Please enter the number of clients (at least 1).';
        if (trim($event) === '') return 'Please specify the event type.';
        if ($event === 'Wedding') {
            if (!isset(self::PACKAGES[$package])) return 'Please choose a wedding package.';
        } elseif (!$services || array_diff($services, self::SERVICES)) {
            return 'Please select the services you need.';
        }
        return null;
    }

    public static function details(string $event, string $package, string $clients, array $services, string $venueDetails, string $notes): string
    {
        $lines = ["Number of clients: $clients"];
        if ($event === 'Wedding') {
            $pkg = self::PACKAGES[$package];
            $lines[] = "Wedding Package $package";
            $lines[] = 'Package Price: ₱' . number_format($pkg['price']);
            $lines[] = 'Reservation Fee: ' . ($pkg['fee'] === null ? 'To be confirmed after review.' : '₱' . number_format($pkg['fee']));
            $lines[] = 'Remaining Balance: ' . ($pkg['fee'] === null ? 'To be confirmed after review.' : '₱' . number_format($pkg['price'] - $pkg['fee']));
            $lines[] = 'Remaining balance shown is after the required reservation fee is paid; no payment has been collected with this request.';
        } else {
            $lines[] = 'Requested services: ' . implode(', ', $services);
        }
        if ($venueDetails !== '') $lines[] = "Venue details: $venueDetails";
        if ($notes !== '') $lines[] = "Additional requirements: $notes";
        return implode("\n", $lines);
    }
}
