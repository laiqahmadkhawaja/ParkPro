<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../database/db.php';

$action = $_GET['action'] ?? '';
$db = Database::getConnection();

// --- PUSH: Receive batch of pending transactions from client ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' || $action === 'push') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true) ?? [];
    $items = $payload['items'] ?? [];

    if (empty($items)) {
        echo json_encode(['success' => true, 'processed' => 0, 'ids' => []]);
        exit();
    }

    $processedIds = [];
    $db->beginTransaction();

    try {
        foreach ($items as $item) {
            $tableName = $item['table_name'];
            $data = is_string($item['payload']) ? json_decode($item['payload'], true) : $item['payload'];
            $localId = $item['id'];

            if ($tableName === 'parking_sessions' && !empty($data)) {
                $stmt = $db->prepare('
                    INSERT INTO parking_sessions (id, ticket_no, plate_number, vehicle_type_id, entry_time, exit_time, operator_entry_id, operator_exit_id, rate_applied, total_amount, discount_amount, penalty_amount, status, qr_signature, sync_status, created_at, updated_at)
                    VALUES (:id, :ticket_no, :plate_number, :vehicle_type_id, :entry_time, :exit_time, :operator_entry_id, :operator_exit_id, :rate_applied, :total_amount, :discount_amount, :penalty_amount, :status, :qr_signature, "synced", :created_at, :updated_at)
                    ON CONFLICT(id) DO UPDATE SET
                        exit_time = excluded.exit_time,
                        operator_exit_id = excluded.operator_exit_id,
                        total_amount = excluded.total_amount,
                        penalty_amount = excluded.penalty_amount,
                        status = excluded.status,
                        updated_at = excluded.updated_at
                ');
                $stmt->execute([
                    ':id' => $data['id'],
                    ':ticket_no' => $data['ticket_no'],
                    ':plate_number' => $data['plate_number'],
                    ':vehicle_type_id' => $data['vehicle_type_id'],
                    ':entry_time' => $data['entry_time'],
                    ':exit_time' => $data['exit_time'] ?? null,
                    ':operator_entry_id' => $data['operator_entry_id'] ?? 'usr_admin',
                    ':operator_exit_id' => $data['operator_exit_id'] ?? null,
                    ':rate_applied' => $data['rate_applied'] ?? 0,
                    ':total_amount' => $data['total_amount'] ?? 0,
                    ':discount_amount' => $data['discount_amount'] ?? 0,
                    ':penalty_amount' => $data['penalty_amount'] ?? 0,
                    ':status' => $data['status'] ?? 'parked',
                    ':qr_signature' => $data['qr_signature'] ?? '',
                    ':created_at' => $data['created_at'] ?? date('c'),
                    ':updated_at' => $data['updated_at'] ?? date('c')
                ]);
                $processedIds[] = $localId;
            } elseif ($tableName === 'shifts' && !empty($data)) {
                $stmt = $db->prepare('
                    INSERT INTO shifts (id, operator_id, start_time, end_time, starting_float, total_cash_collected, expected_cash, actual_cash, discrepancy, status, notes)
                    VALUES (:id, :operator_id, :start_time, :end_time, :starting_float, :total_cash_collected, :expected_cash, :actual_cash, :discrepancy, :status, :notes)
                    ON CONFLICT(id) DO UPDATE SET
                        end_time = excluded.end_time,
                        total_cash_collected = excluded.total_cash_collected,
                        expected_cash = excluded.expected_cash,
                        actual_cash = excluded.actual_cash,
                        discrepancy = excluded.discrepancy,
                        status = excluded.status
                ');
                $stmt->execute([
                    ':id' => $data['id'],
                    ':operator_id' => $data['operator_id'] ?? 'usr_admin',
                    ':start_time' => $data['start_time'],
                    ':end_time' => $data['end_time'] ?? null,
                    ':starting_float' => $data['starting_float'] ?? 0,
                    ':total_cash_collected' => $data['total_cash_collected'] ?? 0,
                    ':expected_cash' => $data['expected_cash'] ?? 0,
                    ':actual_cash' => $data['actual_cash'] ?? 0,
                    ':discrepancy' => $data['discrepancy'] ?? 0,
                    ':status' => $data['status'] ?? 'open',
                    ':notes' => $data['notes'] ?? ''
                ]);
                $processedIds[] = $localId;
            }
        }

        $db->commit();
        echo json_encode([
            'success' => true,
            'processed' => count($processedIds),
            'processed_ids' => $processedIds,
            'server_time' => date('c')
        ]);
        exit();
    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Sync failed: ' . $e->getMessage()]);
        exit();
    }
}

// --- PULL: Send delta updates since specified timestamp ---
if ($_SERVER['REQUEST_METHOD'] === 'GET' || $action === 'pull') {
    $since = $_GET['since'] ?? '1970-01-01T00:00:00Z';

    try {
        $stmt = $db->prepare('SELECT * FROM parking_sessions WHERE updated_at > :s ORDER BY updated_at ASC LIMIT 100');
        $stmt->execute([':s' => $since]);
        $sessions = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'server_time' => date('c'),
            'sessions' => $sessions
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Pull failed: ' . $e->getMessage()]);
    }
    exit();
}
