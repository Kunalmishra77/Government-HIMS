export type TriageLevel = 'Critical' | 'High' | 'Medium' | 'Low'

export type TriageSeverity = 'Red' | 'Yellow' | 'Green'

export function getTriageColor(level: TriageLevel): string {
  switch (level) {
    case 'Critical': return 'bg-red-50 text-red-600 border-red-200'
    case 'High':     return 'bg-primary-soft text-accent border-primary/20'
    case 'Medium':   return 'bg-yellow-50 text-yellow-600 border-yellow-200'
    case 'Low':      return 'bg-green-50 text-green-600 border-green-200'
  }
}

export function getSeverityColor(severity: TriageSeverity): string {
  switch (severity) {
    case 'Red':    return 'bg-red-50 text-red-600 border-red-200'
    case 'Yellow': return 'bg-amber-50 text-amber-600 border-amber-200'
    case 'Green':  return 'bg-green-50 text-green-600 border-green-200'
  }
}

export function getSeverityVariant(severity: TriageSeverity): 'danger' | 'warning' | 'success' {
  switch (severity) {
    case 'Red':    return 'danger'
    case 'Yellow': return 'warning'
    case 'Green':  return 'success'
  }
}

export function getTriageVariant(level: TriageLevel): 'danger' | 'warning' | 'muted' | 'success' {
  switch (level) {
    case 'Critical': return 'danger'
    case 'High':     return 'warning'
    case 'Medium':   return 'muted'
    case 'Low':      return 'success'
  }
}

export const SEVERITY_LABEL: Record<TriageSeverity, string> = {
  Red:    'Immediate',
  Yellow: 'Urgent',
  Green:  'Minor',
}
