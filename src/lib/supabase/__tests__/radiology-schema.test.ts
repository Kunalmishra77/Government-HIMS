import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

describe('radiology schema', () => {
  it('radiology_studies table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expectedCols = [
        'id', 'order_id', 'patient_id', 'patient_name', 'source', 'ward_bed',
        'doctor_name', 'payment_mode', 'clinical_question', 'code', 'name',
        'modality', 'body_part', 'priority', 'contrast_consented', 'status',
        'scheduled_for', 'arrived_at', 'acquiring_by', 'acquired_at',
        'attachments', 'reading_by', 'report_sections', 'ai_prelim',
        'reported_at', 'verified_by', 'verified_at', 'released_at', 'callback',
        'expected_tat_min', 'ordered_at', 'acknowledged_at', 'cancel_reason',
        'no_show_risk', 'predicted_duration_min', 'dose_record', 'ai_findings',
        'quality_flags', 'verification_level', 'resident_read_by', 'escalation',
        'distribution', 'comparison_prior_id', 'updated_at',
      ]
      const res = await client.query(
        `select column_name from information_schema.columns where table_name = $1`, ['radiology_studies']
      )
      const columns = res.rows.map((r) => r.column_name).sort()
      expect(columns).toEqual([...expectedCols].sort())
    } finally {
      await client.end()
    }
  })
})
