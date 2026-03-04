# Normalized Endpoint Protection Schema

This schema normalizes data from Kaspersky (KSC + KEDR Optimum), CrowdStrike Falcon, and Microsoft Defender for Endpoint.

## Core entities
- `endpoints`
  - `endpoint_id` (string, stable)
  - `hostname`
  - `os`
  - `owner`
  - `provider`
  - `last_seen` (ISO date)
  - `agent_status` (online/offline/outdated)
  - `health_status` (ok/warn/critical)

- `incidents`
  - `incident_id`
  - `severity` (critical/high/medium/low)
  - `status` (open/in_progress/contained/resolved)
  - `provider`
  - `endpoint_id`
  - `opened_at`
  - `closed_at`

- `detections`
  - `detection_id`
  - `type` (malware/ransomware/exploit/pua/phishing)
  - `blocked` (boolean)
  - `provider`
  - `endpoint_id`
  - `timestamp`

- `coverage`
  - `provider`
  - `total_devices`
  - `protected_devices`
  - `unprotected_devices`
  - `last_sync`

## Derived metrics
- `devices_protected_pct`
- `agent_health_ok_pct`
- `mtta_hours`
- `mttr_hours`
- `policy_compliance_pct`
- `risk_score_avg`
- `threats_detected`
- `threats_blocked`
- `virus_blocks`
- `attack_attempts_blocked`

## Reporting periods
- `weekly_summary`
  - `period` (weekly)
  - `range` (YYYY-MM-DD to YYYY-MM-DD)
  - `kpis` (see derived metrics + totals)
  - `provider_summary` (per vendor totals)
- `monthly_summary`
  - same structure as weekly_summary
