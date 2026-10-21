<?php
/**
 * ParkPro Central Database Connection Helper
 * Uses SQLite by default for zero-configuration, or MySQL if configured.
 */

class Database {
    private static ?PDO $pdo = null;

    public static function getConnection(): PDO {
        if (self::$pdo === null) {
            $sqlitePath = __DIR__ . '/parkpro.sqlite';
            $isNew = !file_exists($sqlitePath);

            // Connect using SQLite (Zero configuration needed in WAMP/PHP)
            self::$pdo = new PDO('sqlite:' . $sqlitePath);
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

            // Auto-initialize schema if new database file
            if ($isNew) {
                $schemaFile = __DIR__ . '/schema.sql';
                if (file_exists($schemaFile)) {
                    $sql = file_get_contents($schemaFile);
                    self::$pdo->exec($sql);
                }
            }
        }
        return self::$pdo;
    }
}
