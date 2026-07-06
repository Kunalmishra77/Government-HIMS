import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

describe('vitals_readings schema', () => {
  it('exists with the expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const res = await client.query(
        `select column_name from information_schema.columns where table_name = 'vitals_readings' order by column_name`
      )
      const columns = res.rows.map((r) => r.column_name).sort()
      expect(columns).toEqual(['id', 'payload', 'recorded_at', 'recorded_by', 'visit_id'].sort())
    } finally {
      await client.end()
    }
  })
})
