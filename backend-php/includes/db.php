<?php
// Connessione al database SQLite + creazione schema se non esiste.
// Nessuna dipendenza esterna: solo PDO, disponibile su qualunque hosting PHP standard.

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dbPath = __DIR__ . '/../data/flowsphere.sqlite';
    $isNew = !file_exists($dbPath);

    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON');

    if ($isNew) {
        create_schema($pdo);
    }

    return $pdo;
}

function new_id(string $prefix = ''): string
{
    return ($prefix ? $prefix . '_' : '') . bin2hex(random_bytes(10));
}

function create_schema(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            suspended INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE applications (
            id TEXT PRIMARY KEY,
            app_key TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            is_super_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE roles (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL REFERENCES companies(id),
            role_key TEXT NOT NULL,
            name TEXT NOT NULL,
            is_system INTEGER NOT NULL DEFAULT 0,
            UNIQUE(company_id, role_key)
        );

        CREATE TABLE user_companies (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            company_id TEXT NOT NULL REFERENCES companies(id),
            role_id TEXT NOT NULL REFERENCES roles(id),
            UNIQUE(user_id, company_id)
        );

        CREATE TABLE user_company_applications (
            id TEXT PRIMARY KEY,
            user_company_id TEXT NOT NULL REFERENCES user_companies(id),
            application_id TEXT NOT NULL REFERENCES applications(id),
            UNIQUE(user_company_id, application_id)
        );

        CREATE TABLE workflows (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL REFERENCES companies(id),
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'DRAFT',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE workflow_versions (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL REFERENCES workflows(id),
            version INTEGER NOT NULL,
            nodes_json TEXT NOT NULL,
            edges_json TEXT NOT NULL,
            forms_json TEXT NOT NULL DEFAULT '{}',
            published_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE workflow_instances (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL REFERENCES workflows(id),
            workflow_version_id TEXT NOT NULL REFERENCES workflow_versions(id),
            code TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'BOZZA',
            current_node_id TEXT,
            data_json TEXT NOT NULL DEFAULT '{}',
            created_by_id TEXT NOT NULL REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE workflow_tasks (
            id TEXT PRIMARY KEY,
            instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
            node_id TEXT NOT NULL,
            node_type TEXT NOT NULL,
            node_label TEXT NOT NULL,
            assigned_to_id TEXT REFERENCES users(id),
            status TEXT NOT NULL DEFAULT 'APERTO',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            resolved_at TEXT
        );

        CREATE TABLE workflow_comments (
            id TEXT PRIMARY KEY,
            instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
            author_id TEXT NOT NULL REFERENCES users(id),
            body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE ai_decisions (
            id TEXT PRIMARY KEY,
            instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
            node_id TEXT NOT NULL,
            suggestion TEXT NOT NULL,
            confidence REAL NOT NULL,
            auto_applied INTEGER NOT NULL DEFAULT 0,
            reasoning TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE notifications (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL REFERENCES companies(id),
            user_id TEXT NOT NULL REFERENCES users(id),
            channel TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE audit_logs (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL REFERENCES companies(id),
            user_id TEXT REFERENCES users(id),
            instance_id TEXT REFERENCES workflow_instances(id),
            action TEXT NOT NULL,
            previous_value TEXT,
            new_value TEXT,
            ip TEXT,
            device TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    ");
}
