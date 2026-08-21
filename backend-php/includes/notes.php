<?php
// Estrae tutti i [[Titolo]] dal contenuto di una nota, risolve ciascuno a
// una nota esistente (case-insensitive) o ne crea automaticamente una vuota
// (esattamente come fa Obsidian quando linki una pagina che non esiste
// ancora), e riallinea la tabella note_links con l'elenco risultante.
function sync_note_links(string $companyId, string $noteId, string $content, string $userId): void
{
    preg_match_all('/\[\[([^\]]+)\]\]/', $content, $matches);
    $titles = array_unique(array_map('trim', $matches[1] ?? []));

    $targetIds = [];
    foreach ($titles as $title) {
        if ($title === '') continue;
        $stmt = db()->prepare('SELECT id FROM notes WHERE company_id = ? AND LOWER(title) = LOWER(?) LIMIT 1');
        $stmt->execute([$companyId, $title]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            if ($existing['id'] !== $noteId) $targetIds[] = $existing['id'];
        } else {
            $newId = new_id('note');
            db()->prepare('INSERT INTO notes (id, company_id, title, content, created_by_id, updated_by_id) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$newId, $companyId, $title, '', $userId, $userId]);
            $targetIds[] = $newId;
        }
    }

    db()->prepare('DELETE FROM note_links WHERE company_id = ? AND source_note_id = ?')->execute([$companyId, $noteId]);
    foreach (array_unique($targetIds) as $targetId) {
        db()->prepare('INSERT INTO note_links (id, company_id, source_note_id, target_note_id) VALUES (?, ?, ?, ?)')
            ->execute([new_id('nlink'), $companyId, $noteId, $targetId]);
    }
}
