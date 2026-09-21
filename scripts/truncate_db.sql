-- ============================================================
-- WorksiteID - Clean / Reset Database Script
-- Truncates all tables while preserving the schema and constraints.
-- ============================================================

USE worksiteid;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE private_sanctions;
TRUNCATE TABLE private_licenses;
TRUNCATE TABLE webauthn_credentials;
TRUNCATE TABLE inspectors;
TRUNCATE TABLE workers;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- Verification
SELECT 'users' AS table_name, COUNT(*) AS count FROM users
UNION ALL
SELECT 'workers', COUNT(*) FROM workers
UNION ALL
SELECT 'inspectors', COUNT(*) FROM inspectors
UNION ALL
SELECT 'webauthn_credentials', COUNT(*) FROM webauthn_credentials
UNION ALL
SELECT 'private_licenses', COUNT(*) FROM private_licenses
UNION ALL
SELECT 'private_sanctions', COUNT(*) FROM private_sanctions;
