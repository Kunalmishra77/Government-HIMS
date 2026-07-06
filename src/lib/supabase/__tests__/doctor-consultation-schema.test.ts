import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

describe('doctor consultation schema', () => {
  it('encounters, prescriptions, orders tables exist with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      for (const [table, expectedCols] of [
        ['encounters', ['id', 'visit_id', 'patient_id', 'doctor_id', 'doctor_name', 'started_at', 'ended_at', 'kind', 'subjective', 'objective', 'assessment', 'plan', 'note_markdown', 'ai_pre_brief_accepted', 'signed_at']],
        ['prescriptions', ['id', 'encounter_id', 'visit_id', 'patient_id', 'doctor_id', 'doctor_name', 'signed_at', 'status', 'lines', 'safety', 'created_at', 'updated_at']],
        ['orders', ['id', 'visit_id', 'encounter_id', 'patient_id', 'doctor_id', 'doctor_name', 'kind', 'urgency', 'status', 'indication', 'items', 'modality', 'bench', 'sent_at', 'completed_at', 'created_at', 'updated_at']],
      ] as const) {
        const res = await client.query(
          `select column_name from information_schema.columns where table_name = $1`, [table]
        )
        const columns = res.rows.map((r) => r.column_name).sort()
        expect(columns, `table ${table}`).toEqual([...expectedCols].sort())
      }
    } finally {
      await client.end()
    }
  })
})
