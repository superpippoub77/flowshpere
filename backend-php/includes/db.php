<?php
// Connessione al database SQLite + creazione schema se non esiste.
// Nessuna dipendenza esterna: solo PDO, disponibile su qualunque hosting PHP standard.

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dataDir = __DIR__ . '/../data';
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }

    $dbPath = $dataDir . '/flowsphere.sqlite';
    $isNew = !file_exists($dbPath);

    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON');

    if ($isNew) {
        create_schema($pdo);
    } else {
        run_migrations($pdo);
    }

    return $pdo;
}

// Applica modifiche allo schema su database gia' esistenti (es. quello gia'
// in produzione), senza perdere i dati.
function run_migrations(PDO $pdo): void
{
    $hasColumn = function (string $table, string $column) use ($pdo): bool {
        $cols = $pdo->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($cols as $c) if ($c['name'] === $column) return true;
        return false;
    };

    if (!$hasColumn('users', 'user_type')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'UTENTE'");
        // chi era gia' super admin diventa SUPERADMIN nel nuovo campo "tipo"
        $pdo->exec("UPDATE users SET user_type = 'SUPERADMIN' WHERE is_super_admin = 1");
    }

    if (!$hasColumn('user_company_applications', 'role_id')) {
        $pdo->exec('ALTER TABLE user_company_applications ADD COLUMN role_id TEXT REFERENCES roles(id)');
        // porta il ruolo gia' assegnato a livello di azienda su ogni app abilitata,
        // cosi' l'accesso esistente continua a funzionare esattamente come prima
        $pdo->exec('
            UPDATE user_company_applications
            SET role_id = (
                SELECT uc.role_id FROM user_companies uc WHERE uc.id = user_company_applications.user_company_id
            )
            WHERE role_id IS NULL
        ');
    }

    if (!$hasColumn('applications', 'category')) {
        $pdo->exec("ALTER TABLE applications ADD COLUMN category TEXT NOT NULL DEFAULT 'Generale'");
        $pdo->exec("UPDATE applications SET category = 'Gestionale' WHERE app_key IN ('workflow', 'ticket', 'crm')");
        $pdo->exec("UPDATE applications SET category = 'Risorse Umane' WHERE app_key = 'timesheet'");
        // le app non ancora sviluppate restano nel catalogo ma abilitate: la
        // visibilita' effettiva per utente si decide con i permessi, non qui
        $pdo->exec("UPDATE applications SET enabled = 1 WHERE app_key IN ('timesheet', 'ticket', 'crm')");
    }

    foreach (['avatar_path', 'phone', 'job_title', 'notes'] as $col) {
        if (!$hasColumn('users', $col)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN $col TEXT");
        }
    }

    if (!$hasColumn('workflow_comments', 'node_id')) {
        $pdo->exec('ALTER TABLE workflow_comments ADD COLUMN node_id TEXT');
    }

    $tableExists = function (string $table) use ($pdo): bool {
        $stmt = $pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
        $stmt->execute([$table]);
        return (bool) $stmt->fetch();
    };

    if (!$tableExists('attachments')) {
        $pdo->exec("
            CREATE TABLE attachments (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL REFERENCES companies(id),
                instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
                node_id TEXT,
                uploaded_by_id TEXT NOT NULL REFERENCES users(id),
                file_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");
    }

    if (!$tableExists('node_templates')) {
        $pdo->exec("
            CREATE TABLE node_templates (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL REFERENCES companies(id),
                node_type TEXT NOT NULL,
                label TEXT NOT NULL,
                config_json TEXT NOT NULL DEFAULT '{}',
                created_by_id TEXT NOT NULL REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");
    }

    if (!$hasColumn('workflow_instances', 'origin_instance_id')) {
        $pdo->exec('ALTER TABLE workflow_instances ADD COLUMN origin_instance_id TEXT');
    }

    if (!$tableExists('api_tokens')) {
        $pdo->exec("
            CREATE TABLE api_tokens (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL REFERENCES companies(id),
                workflow_id TEXT REFERENCES workflows(id),
                label TEXT NOT NULL,
                jti TEXT UNIQUE NOT NULL,
                created_by_id TEXT NOT NULL REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                revoked INTEGER NOT NULL DEFAULT 0
            )
        ");
    }
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
            category TEXT NOT NULL DEFAULT 'Generale',
            enabled INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            is_super_admin INTEGER NOT NULL DEFAULT 0,
            user_type TEXT NOT NULL DEFAULT 'UTENTE',
            avatar_path TEXT,
            phone TEXT,
            job_title TEXT,
            notes TEXT,
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
            role_id TEXT REFERENCES roles(id),
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
            origin_instance_id TEXT,
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
            node_id TEXT,
            author_id TEXT NOT NULL REFERENCES users(id),
            body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE attachments (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL REFERENCES companies(id),
            instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
            node_id TEXT,
            uploaded_by_id TEXT NOT NULL REFERENCES users(id),
            file_name TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE node_templates (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL REFERENCES companies(id),
            node_type TEXT NOT NULL,
            label TEXT NOT NULL,
            config_json TEXT NOT NULL DEFAULT '{}',
            created_by_id TEXT NOT NULL REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE api_tokens (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL REFERENCES companies(id),
            workflow_id TEXT REFERENCES workflows(id),
            label TEXT NOT NULL,
            jti TEXT UNIQUE NOT NULL,
            created_by_id TEXT NOT NULL REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            revoked INTEGER NOT NULL DEFAULT 0
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
