'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { User, Mail, Phone, Building2, Award, Shield } from 'lucide-react'
import { useSecretarySessionStore } from '@/store/useSecretarySessionStore'

export default function SecretaryProfilePage() {
  const t = useTranslations('secretary')
  const { session } = useSecretarySessionStore()
  const [editing, setEditing] = useState(false)

  const profile = {
    name: session?.name || 'Dr. Rajesh Kumar Srivastava, IAS',
    designation: session?.designation || 'Principal Secretary, Health & Family Welfare',
    cadre: 'IAS (MP:1992)',
    service: '32 years',
    email: 'ps.health@mpgov.in',
    phone: '0755-2441200',
    office: 'Room 412, Mantralaya, Bhopal — 462004',
    prevPosts: [
      'Secretary, Department of Finance (2020-2022)',
      'DG, Women & Child Development (2018-2020)',
      'Commissioner, Bhopal Municipal Corporation (2016-2018)',
    ],
    educations: ['IIT Kharagpur — Civil Engineering', 'LBSNAA Training 1992-93'],
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-lg">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('profile.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('profile.subtitle')}</p>
      </div>

      {/* Profile card */}
      <div className="bg-gradient-to-r from-primary to-primary text-white rounded-2xl p-6">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-black">
            {profile.name.split(' ').slice(1, 3).map(n => n[0]).join('')}
          </div>
          <div>
            <p className="text-lg font-bold">{profile.name}</p>
            <p className="text-sm opacity-80">{profile.designation}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{profile.cadre}</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{t('profile.service', { years: profile.service })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-semibold text-[var(--color-foreground)] mb-4">{t('profile.contactInfo')}</p>
        <div className="space-y-3">
          {[
            { icon: Mail, label: t('profile.email'), value: profile.email },
            { icon: Phone, label: t('profile.directLine'), value: profile.phone },
            { icon: Building2, label: t('profile.office'), value: profile.office },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-3">
              <c.icon className="h-4 w-4 text-[var(--color-foreground-muted)] flex-shrink-0" />
              <div>
                <p className="text-[10px] text-[var(--color-foreground-lighter)]">{c.label}</p>
                <p className="text-sm text-[var(--color-foreground)]">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Previous postings */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-semibold text-[var(--color-foreground)] mb-3">{t('profile.previousPostings')}</p>
        <div className="space-y-2">
          {profile.prevPosts.map((p, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-accent-soft text-[var(--color-accent)] text-[10px] flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
              <p className="text-sm text-[var(--color-foreground)]">{p}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
