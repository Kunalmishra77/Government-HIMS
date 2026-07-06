import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

describe('laboratory schema', () => {
  it('lab_specimens, lab_tests, lab_reflex_suggestions tables exist with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      for (const [table, expectedCols] of [
        ['lab_specimens', ['id', 'order_id', 'type', 'container', 'collected_by', 'collected_at', 'volume', 'reject_reason']],
        ['lab_tests', ['id', 'order_id', 'specimen_id', 'code', 'name', 'bench', 'priority', 'status', 'assigned_to', 'entered_by', 'verified_by', 'released_at', 'reject_reason', 'recollect_reason', 'expected_tat_min', 'ordered_at', 'analytes', 'micro', 'callback', 'notes', 'acknowledged_at', 'updated_at']],
        ['lab_reflex_suggestions', ['id', 'based_on_test_id', 'patient_name', 'trigger_summary', 'code', 'reason', 'ordered_at', 'created_at']],
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
