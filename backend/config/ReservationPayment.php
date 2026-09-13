<?php

/** Authoritative reservation pricing. Inputs must be service rows from the DB. */
final class ReservationPayment
{
    public static function quote(array $services, int $availablePoints = 0, bool $redeem = false): array
    {
        if (!$services) throw new InvalidArgumentException('Please select at least one service.');
        usort($services, fn($a, $b) => (int) $a['id'] <=> (int) $b['id']);
        $prices = array_map(fn($s) => (int) round((float) $s['price'] * 100), $services);
        if (min($prices) < 0) throw new InvalidArgumentException('A selected service has an invalid price.');
        $subtotal = array_sum($prices);
        $points = $redeem ? min(max(0, $availablePoints), intdiv($subtotal, 10)) : 0;
        $discount = $points * 10; // Existing loyalty rule: one point = ten centavos.
        $total = $subtotal - $discount;

        // Allocate discounts proportionally in integer centavos. Distribute
        // rounding remainders deterministically so line totals always add up.
        $net = []; $remainders = [];
        foreach ($prices as $i => $price) {
            $net[$i] = $subtotal ? intdiv($price * $total, $subtotal) : 0;
            $remainders[$i] = $subtotal ? ($price * $total) % $subtotal : 0;
        }
        arsort($remainders);
        $left = $total - array_sum($net);
        foreach ($remainders as $i => $_) { if ($left-- <= 0) break; $net[$i]++; }

        // A service configured 'No Online Reservation' is confirmed manually
        // after admin review, never through an upfront online deposit -- if
        // any selected service carries it, the whole booking skips online
        // payment entirely (amountDue = 0) rather than trying to blend it
        // with a partial online deposit for the other services.
        $hasNoOnlineReservation = false;
        foreach ($services as $service) {
            if ($service['payment_requirement'] === 'No Online Reservation') {
                $hasNoOnlineReservation = true;
                break;
            }
        }

        $twiceDue = 0; $requirements = []; $items = [];
        foreach ($services as $i => $service) {
            $requirementRaw = $service['payment_requirement'];
            if (!in_array($requirementRaw, ['Full Payment', '50% Down Payment', 'Half Payment', 'No Online Reservation'], true)) {
                throw new InvalidArgumentException('A selected service has an invalid reservation requirement.');
            }
            $full = $requirementRaw === 'Full Payment';
            $requirement = $hasNoOnlineReservation ? 'No Online Reservation' : ($full ? 'Full Payment' : '50% Down Payment');
            $requirements[$requirement] = true;
            $twiceDue += $hasNoOnlineReservation ? 0 : ($net[$i] * ($full ? 2 : 1));
            $items[] = ['id' => (string) $service['id'], 'name' => $service['service_name'],
                'serviceTotal' => $net[$i] / 100, 'reservationRequirement' => $requirement];
        }
        $due = $hasNoOnlineReservation ? 0 : intdiv($twiceDue + 1, 2); // Round half a cent up, once for the booking.
        $quote = ['items' => $items, 'catalogSubtotal' => $subtotal / 100, 'discount' => $discount / 100,
            'pointsUsed' => $points, 'serviceTotal' => $total / 100,
            'reservationRequirement' => $hasNoOnlineReservation ? 'No Online Reservation'
                : (count($requirements) === 1 ? array_key_first($requirements) : '50% Down Payment + Full Payment'),
            'amountDue' => $due / 100, 'remainingBalance' => ($total - $due) / 100,
            // Forward-compatible placeholder only: today the customer pays this
            // amountDue manually (Cash/GCash/Maya, staff-verified — see
            // submitBooking.php). A future online gateway (e.g. PayMongo) would
            // plug in here as a new provider value without changing anything
            // else in this quote shape — no gateway code lives here yet.
            'provider' => 'manual'];
        // Detect a changed quote on submission; never use this token as a price input.
        $quote['quoteToken'] = hash('sha256', json_encode($quote));
        return $quote;
    }
}
