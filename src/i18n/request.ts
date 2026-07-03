import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import en from '../../messages/en'
import hi from '../../messages/hi'

const MESSAGES = { en, hi } as const

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value as 'en' | 'hi') ?? 'en'

  return {
    locale,
    messages: MESSAGES[locale],
  }
})
