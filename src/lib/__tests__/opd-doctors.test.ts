import { describe, it, expect } from 'vitest'
import { belongsToDoctorQueue } from '@/lib/opd-doctors'

// Regression: a patient registered via voice/appointment always carries
// doctor='Dr. Priya Nair'. A real logged-in doctor's name is their
// profiles.full_name (e.g. 'Demo Doctor'). The old strict `p.doctor === name`
// filter dropped such a patient from the doctor's board even after vitals —
// the reported vitals→doctor break.
describe('belongsToDoctorQueue', () => {
  const active = ['Demo Doctor'] // the only currently-active real doctor

  it('REGRESSION: shows a registration-default patient to a real logged-in doctor', () => {
    // patient assigned the seed/self-check-in default, doctor is a real profile
    expect(belongsToDoctorQueue('Dr. Priya Nair', 'Demo Doctor', active)).toBe(true)
  })

  it('shows a patient explicitly assigned to this doctor by name', () => {
    expect(belongsToDoctorQueue('Demo Doctor', 'Demo Doctor', active)).toBe(true)
  })

  it('hides a patient claimed by ANOTHER currently-active real doctor', () => {
    const twoDocs = ['Demo Doctor', 'Dr. Asha Rao']
    expect(belongsToDoctorQueue('Dr. Asha Rao', 'Demo Doctor', twoDocs)).toBe(false)
  })

  it('still works in demo (mock) login where the doctor IS Dr. Priya Nair', () => {
    // demo login: currentUser.name = 'Dr. Priya Nair', real roster = ['Demo Doctor']
    expect(belongsToDoctorQueue('Dr. Priya Nair', 'Dr. Priya Nair', active)).toBe(true)
  })

  it('shows seed patients assigned to other mock doctors (not real/active)', () => {
    expect(belongsToDoctorQueue('Dr. Rohan Mehta', 'Demo Doctor', active)).toBe(true)
  })
})
