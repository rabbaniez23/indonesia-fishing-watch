/**
 * Migrasi skema berurutan. Jangan mengubah migrasi yang sudah dirilis; tambahkan versi baru.
 *
 * SQL dijaga sederhana (TEXT/INTEGER, ISO-8601 UTC untuk waktu) agar mudah dipindah ke
 * PostgreSQL + PostGIS (PRD §11.1). Tabel data GFW ditambahkan pada tahap masing-masing,
 * setelah bentuk respons nyata diperiksa — bukan ditebak di sini.
 */
export type Migration = { version: number; name: string; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "auth_and_audit",
    sql: `
      CREATE TABLE users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        name          TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('viewer', 'analyst', 'admin')),
        password_hash TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE invites (
        id               TEXT PRIMARY KEY,
        email            TEXT NOT NULL,
        role             TEXT NOT NULL CHECK (role IN ('viewer', 'analyst', 'admin')),
        token_hash       TEXT NOT NULL UNIQUE,
        invited_by       TEXT REFERENCES users(id),
        created_at       TEXT NOT NULL,
        expires_at       TEXT NOT NULL,
        accepted_at      TEXT,
        accepted_user_id TEXT REFERENCES users(id),
        revoked_at       TEXT
      );
      CREATE INDEX invites_email_idx ON invites(email);

      CREATE TABLE sessions (
        id           TEXT PRIMARY KEY,
        token_hash   TEXT NOT NULL UNIQUE,
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at   TEXT NOT NULL,
        expires_at   TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX sessions_user_idx ON sessions(user_id);

      CREATE TABLE login_attempts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        email        TEXT NOT NULL,
        succeeded    INTEGER NOT NULL CHECK (succeeded IN (0, 1)),
        attempted_at TEXT NOT NULL
      );
      CREATE INDEX login_attempts_email_idx ON login_attempts(email, attempted_at);

      -- Audit tidak pernah mencatat token, password, atau secret (PRD §13).
      CREATE TABLE audit_entries (
        id           TEXT PRIMARY KEY,
        actor_id     TEXT REFERENCES users(id),
        action       TEXT NOT NULL,
        entity_type  TEXT NOT NULL,
        entity_id    TEXT,
        changes_json TEXT,
        occurred_at  TEXT NOT NULL
      );
      CREATE INDEX audit_entity_idx ON audit_entries(entity_type, entity_id);
    `,
  },
  {
    version: 2,
    name: "gfw_datasets_budget_cache",
    sql: `
      -- Registry kemampuan dataset (PRD §11.3, FR-11): didukung dokumentasi vs teruji akses.
      CREATE TABLE datasets (
        alias             TEXT PRIMARY KEY,
        family            TEXT NOT NULL CHECK (family IN ('4wings', 'events', 'vessels', 'regions')),
        label             TEXT NOT NULL,
        doc_supported     INTEGER NOT NULL DEFAULT 1 CHECK (doc_supported IN (0, 1)),
        access_status     TEXT NOT NULL DEFAULT 'untested'
                          CHECK (access_status IN ('untested', 'ok', 'error', 'unsupported')),
        resolved_version  TEXT,
        last_checked_at   TEXT,
        last_success_at   TEXT,
        last_error_code   TEXT,
        -- Detail error tersanitasi (tanpa token), hanya ditampilkan ke Admin.
        last_error_detail TEXT,
        notes             TEXT
      );

      -- Budget request upstream harian (hari UTC) dan statistik cache.
      CREATE TABLE budget_counters (
        day               TEXT PRIMARY KEY,
        upstream_requests INTEGER NOT NULL DEFAULT 0,
        cache_hits        INTEGER NOT NULL DEFAULT 0
      );

      -- Cache respons upstream ternormalisasi. Key memuat family, dataset/versi, filter kanonik (PRD §11.5).
      CREATE TABLE cache_entries (
        key          TEXT PRIMARY KEY,
        family       TEXT NOT NULL,
        dataset      TEXT,
        body_json    TEXT NOT NULL,
        meta_json    TEXT,
        fetched_at   TEXT NOT NULL,
        expires_at   TEXT NOT NULL
      );
      CREATE INDEX cache_entries_expires_idx ON cache_entries(expires_at);
    `,
  },
  {
    version: 3,
    name: "regions",
    sql: `
      -- Katalog geometri cakupan (PRD §6.3, §13). Kode WPP tidak diasumsikan sebagai region ID GFW.
      CREATE TABLE regions (
        id                  TEXT PRIMARY KEY,
        code                TEXT NOT NULL,
        name                TEXT NOT NULL,
        type                TEXT NOT NULL CHECK (type IN ('eez', 'wpp', 'national')),
        gfw_region_dataset  TEXT,
        gfw_region_id       INTEGER,
        geojson             TEXT NOT NULL,
        geometry_hash       TEXT NOT NULL,
        bbox_json           TEXT NOT NULL,
        crs                 TEXT NOT NULL,
        source              TEXT NOT NULL,
        source_version      TEXT,
        source_fetched_at   TEXT,
        validated_at        TEXT NOT NULL,
        notes               TEXT
      );
    `,
  },
  {
    version: 4,
    name: "jobs_locks_snapshots",
    sql: `
      -- Antrean persisten dengan lease (PRD §11.1, §13): tahan restart, retry terbatas, dedup.
      CREATE TABLE jobs (
        id                    TEXT PRIMARY KEY,
        type                  TEXT NOT NULL,
        state                 TEXT NOT NULL CHECK (state IN ('queued', 'running', 'succeeded', 'failed')),
        dedup_key             TEXT NOT NULL,
        params_json           TEXT NOT NULL,
        attempts              INTEGER NOT NULL DEFAULT 0,
        max_attempts          INTEGER NOT NULL DEFAULT 4,
        run_after             TEXT NOT NULL,
        lease_owner           TEXT,
        lease_until           TEXT,
        -- Diisi saat report upstream dimulai; dipakai untuk pemulihan via last-report setelah crash/timeout.
        upstream_started_at   TEXT,
        upstream_request_hash TEXT,
        result_ref            TEXT,
        error_code            TEXT,
        error_message         TEXT,
        owner_id              TEXT REFERENCES users(id),
        created_at            TEXT NOT NULL,
        updated_at            TEXT NOT NULL,
        finished_at           TEXT
      );
      CREATE INDEX jobs_claim_idx ON jobs(state, run_after);
      CREATE INDEX jobs_dedup_idx ON jobs(dedup_key, state);

      -- Lock lintas proses (mis. satu report GFW per akun pada satu waktu).
      CREATE TABLE locks (
        name        TEXT PRIMARY KEY,
        owner       TEXT NOT NULL,
        lease_until TEXT NOT NULL,
        meta_json   TEXT,
        acquired_at TEXT NOT NULL
      );

      -- Provenance setiap pengambilan upstream (PRD §6.2, §12). Tanpa token/URL privat.
      CREATE TABLE source_fetches (
        id                          TEXT PRIMARY KEY,
        request_hash                TEXT NOT NULL,
        family                      TEXT NOT NULL,
        dataset_requested           TEXT NOT NULL,
        dataset_resolved            TEXT,
        region_id                   TEXT NOT NULL REFERENCES regions(id),
        geometry_hash               TEXT NOT NULL,
        requested_start             TEXT NOT NULL,
        requested_end               TEXT NOT NULL,
        fetched_at                  TEXT NOT NULL,
        latest_observation_at       TEXT,
        provider_available_through  TEXT,
        completeness                TEXT NOT NULL CHECK (completeness IN ('complete', 'partial', 'unknown')),
        row_count                   INTEGER NOT NULL,
        rejected_count              INTEGER NOT NULL,
        warnings_json               TEXT NOT NULL,
        aggregation                 TEXT NOT NULL,
        spatial_resolution          TEXT,
        recovered_via_last_report   INTEGER NOT NULL DEFAULT 0 CHECK (recovered_via_last_report IN (0, 1))
      );

      -- Hasil report teragregasi: immutable; dipakai ulang selama fresh_until (TTL analisis 6 jam).
      CREATE TABLE report_results (
        id              TEXT PRIMARY KEY,
        dedup_key       TEXT NOT NULL,
        job_id          TEXT NOT NULL REFERENCES jobs(id),
        dataset_key     TEXT NOT NULL,
        kind            TEXT NOT NULL CHECK (kind IN ('daily', 'cells', 'vessels')),
        region_id       TEXT NOT NULL REFERENCES regions(id),
        geometry_hash   TEXT NOT NULL,
        start_date      TEXT NOT NULL,
        end_date        TEXT NOT NULL,
        source_fetch_id TEXT NOT NULL REFERENCES source_fetches(id),
        payload_json    TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        fresh_until     TEXT NOT NULL
      );
      CREATE INDEX report_results_dedup_idx ON report_results(dedup_key, created_at);
    `,
  },
  {
    version: 5,
    name: "port_results",
    sql: `
      -- Agregasi kunjungan pelabuhan per pelabuhan GFW (FR-08), immutable dan fresh selama TTL.
      CREATE TABLE port_results (
        id              TEXT PRIMARY KEY,
        dedup_key       TEXT NOT NULL,
        job_id          TEXT NOT NULL REFERENCES jobs(id),
        region_id       TEXT NOT NULL REFERENCES regions(id),
        geometry_hash   TEXT NOT NULL,
        start_date      TEXT NOT NULL,
        end_date        TEXT NOT NULL,
        source_fetch_id TEXT NOT NULL REFERENCES source_fetches(id),
        payload_json    TEXT NOT NULL,
        stats_json      TEXT,
        created_at      TEXT NOT NULL,
        fresh_until     TEXT NOT NULL
      );
      CREATE INDEX port_results_dedup_idx ON port_results(dedup_key, created_at);
    `,
  },
  {
    version: 6,
    name: "findings",
    sql: `
      -- Temuan (FR-09). Snapshot sumber & filter disimpan saat dibuat dan tidak berubah (immutable).
      CREATE TABLE findings (
        id              TEXT PRIMARY KEY,
        title           TEXT NOT NULL,
        reason          TEXT NOT NULL,
        priority        TEXT NOT NULL CHECK (priority IN ('rendah', 'sedang', 'tinggi')),
        priority_reason TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'ditinjau', 'perlu_informasi', 'selesai')),
        source_type     TEXT NOT NULL CHECK (source_type IN ('cell', 'vessel', 'event', 'manual')),
        source_json     TEXT NOT NULL,
        filter_json     TEXT NOT NULL,
        region_id       TEXT REFERENCES regions(id),
        created_by      TEXT NOT NULL REFERENCES users(id),
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        updated_by      TEXT NOT NULL REFERENCES users(id),
        -- Optimistic concurrency: setiap perubahan menaikkan versi.
        version         INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX findings_status_idx ON findings(status, updated_at);

      -- Catatan append-only: tidak ada UPDATE/DELETE di aplikasi; koreksi = catatan baru.
      CREATE TABLE finding_notes (
        id          TEXT PRIMARY KEY,
        finding_id  TEXT NOT NULL REFERENCES findings(id),
        kind        TEXT NOT NULL CHECK (kind IN ('catatan', 'status', 'prioritas', 'dibuat')),
        body        TEXT NOT NULL,
        from_value  TEXT,
        to_value    TEXT,
        actor_id    TEXT NOT NULL REFERENCES users(id),
        created_at  TEXT NOT NULL
      );
      CREATE INDEX finding_notes_idx ON finding_notes(finding_id, created_at);

      -- Penjaga append-only di level database.
      CREATE TRIGGER finding_notes_no_update BEFORE UPDATE ON finding_notes
      BEGIN SELECT RAISE(ABORT, 'finding_notes bersifat append-only'); END;
      CREATE TRIGGER finding_notes_no_delete BEFORE DELETE ON finding_notes
      BEGIN SELECT RAISE(ABORT, 'finding_notes bersifat append-only'); END;
    `,
  },
  {
    version: 7,
    name: "reports",
    sql: `
      -- Laporan ekspor (FR-10). File disimpan di storage privat; metadata & referensi snapshot di sini.
      CREATE TABLE reports (
        id               TEXT PRIMARY KEY,
        type             TEXT NOT NULL CHECK (type IN ('ringkasan_harian', 'sel_grid', 'kunjungan_pelabuhan', 'kejadian_kapal')),
        params_json      TEXT NOT NULL,
        status           TEXT NOT NULL CHECK (status IN ('antre', 'diproses', 'siap', 'gagal')),
        job_id           TEXT REFERENCES jobs(id),
        idempotency_key  TEXT NOT NULL,
        file_name        TEXT,
        file_size        INTEGER,
        row_count        INTEGER,
        snapshot_refs    TEXT,
        completeness     TEXT,
        deferrals        INTEGER NOT NULL DEFAULT 0,
        error_code       TEXT,
        error_message    TEXT,
        created_by       TEXT NOT NULL REFERENCES users(id),
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL,
        finished_at      TEXT,
        expires_at       TEXT
      );
      CREATE UNIQUE INDEX reports_idem_idx ON reports(created_by, idempotency_key);
      CREATE INDEX reports_created_idx ON reports(created_at);
    `,
  },
  {
    version: 8,
    name: "app_settings",
    sql: `
      -- Pengaturan yang dapat diubah Admin (bukan secret; token tetap hanya di env server).
      CREATE TABLE app_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_by TEXT REFERENCES users(id),
        updated_at TEXT NOT NULL
      );
    `,
  },
];
