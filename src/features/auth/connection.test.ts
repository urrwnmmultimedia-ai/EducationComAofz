import { describe, expect, it } from 'vitest'
import { classifyError, retryDelayMs } from './connection'

describe('classifyError', () => {
  it('rate limits are "busy"', () => {
    expect(classifyError({ status: 429, message: 'Request rate limit reached' })).toBe('busy')
    expect(classifyError({ message: 'over_request_rate_limit' })).toBe('busy')
  })

  it('broken sessions are "auth"', () => {
    expect(classifyError({ status: 401 })).toBe('auth')
    expect(classifyError({ code: 'PGRST301', message: 'JWT expired' })).toBe('auth')
    expect(classifyError({ message: 'Invalid Refresh Token: Refresh Token Not Found' })).toBe('auth')
  })

  it('anything else is "network"', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('network')
    expect(classifyError(null)).toBe('network')
  })
})

describe('retryDelayMs', () => {
  const mid = () => 0.5
  it('backs off and caps', () => {
    expect(retryDelayMs('network', 0, mid)).toBe(1000)
    expect(retryDelayMs('network', 2, mid)).toBe(4000)
    expect(retryDelayMs('network', 10, mid)).toBe(8000)
    expect(retryDelayMs('busy', 0, mid)).toBe(8000)
    expect(retryDelayMs('busy', 10, mid)).toBe(60000)
  })

  it('adds jitter so devices do not retry together', () => {
    expect(retryDelayMs('busy', 0, () => 0)).toBe(6000)
    expect(retryDelayMs('busy', 0, () => 1)).toBe(10000)
  })
})
