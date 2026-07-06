import { describe, expect, it } from 'vitest'
import { Client } from 'pg'

async function tableExists(client: Client, table: string): Promise<boolean> {
  const res = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = $1`,
    [table]
  )
  return (res.rowCount ?? 0) > 0
}

describe('core schema', () => {
  it('creates profiles, patients, visits, and appointments tables', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try {
      expect(await tableExists(client, 'profiles')).toBe(true)
      expect(await tableExists(client, 'patients')).toBe(true)
      expect(await tableExists(client, 'visits')).toBe(true)
      expect(await tableExists(client, 'appointments')).toBe(true)
    } finally {
      await client.end()
    }
  })
})
