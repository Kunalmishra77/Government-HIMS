import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

async function columnsOf(client: Client, table: string): Promise<string[]> {
  const res = await client.query(
    `select column_name from information_schema.columns where table_name = $1`, [table]
  )
  return res.rows.map((r) => r.column_name).sort()
}

describe('IPD schema', () => {
  it('ipd_stays table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'admission_request_id', 'patient_id', 'patient_name', 'age', 'gender',
        'bed', 'ward', 'admitting_doctor', 'diagnosis', 'admitted_at', 'expected_discharge',
        'stage', 'condition', 'rounds', 'meds', 'tests', 'diet', 'surgery', 'progress_notes',
        'discharge', 'events', 'referrals', 'icu_transfer', 'ot_booking', 'code_status',
        'allergies', 'comorbidities', 'latest_hb_a1c', 'latest_bp', 'iv_lines', 'latest_vitals',
        'dismissed_insight', 'mar', 'nurse_ack', 'io', 'updated_at',
      ]
      expect(await columnsOf(client, 'ipd_stays')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('ipd_vitals table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'ipd_stay_id', 'patient_id', 'recorded_at', 'recorded_by', 'recorded_by_name',
        'hr', 'systolic_bp', 'diastolic_bp', 'rr', 'spo2', 'o2_delivery', 'o2_flow', 'temp',
        'pain', 'blood_glucose', 'consciousness', 'gcs', 'weight', 'height', 'capillary_refill',
        'urine_output', 'note',
      ]
      expect(await columnsOf(client, 'ipd_vitals')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('beds table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'bed_number', 'ward', 'floor', 'status', 'occupant_id', 'occupant_name',
        'cleaning_assigned_to', 'last_cleaned', 'gender', 'expected_free_at',
      ]
      expect(await columnsOf(client, 'beds')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('nurse_shift_assignments table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = ['id', 'nurse_id', 'nurse_name', 'ward', 'shift', 'responsibilities']
      expect(await columnsOf(client, 'nurse_shift_assignments')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('shift_handovers table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'ward', 'date', 'from_shift', 'to_shift', 'from_nurse_id', 'from_nurse_name',
        'to_nurse_id', 'to_nurse_name', 'sbar', 'addendum', 'patient_count', 'signed_at',
        'received_at', 'received_by_id', 'received_by_name', 'status',
      ]
      expect(await columnsOf(client, 'shift_handovers')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('nurse_tasks table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'key', 'patient_id', 'patient_name', 'title', 'category', 'priority',
        'source', 'done', 'created_at', 'done_at',
      ]
      expect(await columnsOf(client, 'nurse_tasks')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })
})
