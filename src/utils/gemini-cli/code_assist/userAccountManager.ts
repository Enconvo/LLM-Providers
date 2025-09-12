/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path'
import { promises as fsp, readFileSync } from 'node:fs'
import { Storage } from './storage.ts'

// Define interface for user information
// Interface for user information based on Google OAuth response
interface UserInfo {
  email: string // User's email address
  name?: string // User's full name
  picture?: string // User's profile picture URL
  id?: string // User's unique identifier
  verified_email?: boolean // Whether the email is verified
  given_name?: string // User's first name
  family_name?: string // User's last name
}

interface UserAccounts {
  active: UserInfo | null
  old: UserInfo[]
}

export class UserAccountManager {
  private getGoogleAccountsCachePath(): string {
    return Storage.getGoogleAccountsPath()
  }

  /**
   * Parses and validates the string content of an accounts file.
   * @param content The raw string content from the file.
   * @returns A valid UserAccounts object.
   */
  private parseAndValidateAccounts(content: string): UserAccounts {
    const defaultState = { active: null, old: [] }
    if (!content.trim()) {
      return defaultState
    }

    const parsed = JSON.parse(content)

    // Inlined validation logic for new UserInfo structure
    if (typeof parsed !== 'object' || parsed === null) {
      console.log('Invalid accounts file schema, starting fresh.')
      return defaultState
    }
    const { active, old } = parsed as Partial<UserAccounts>
    
    // Validate active user info
    const isActiveValid = active === undefined || active === null || 
      (typeof active === 'object' && typeof active.email === 'string')
    
    // Validate old users array
    const isOldValid = old === undefined ||
      (Array.isArray(old) && old.every((user) => 
        typeof user === 'object' && typeof user.email === 'string'))

    if (!isActiveValid || !isOldValid) {
      console.log('Invalid accounts file schema, starting fresh.')
      return defaultState
    }

    return {
      active: parsed.active ?? null,
      old: parsed.old ?? [],
    }
  }

  private readAccountsSync(filePath: string): UserAccounts {
    const defaultState = { active: null, old: [] }
    try {
      const content = readFileSync(filePath, 'utf-8')
      return this.parseAndValidateAccounts(content)
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return defaultState
      }
      console.log('Error during sync read of accounts, starting fresh.', error)
      return defaultState
    }
  }

  private async readAccounts(filePath: string): Promise<UserAccounts> {
    const defaultState = { active: null, old: [] }
    try {
      const content = await fsp.readFile(filePath, 'utf-8')
      return this.parseAndValidateAccounts(content)
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return defaultState
      }
      console.log('Could not parse accounts file, starting fresh.', error)
      return defaultState
    }
  }

  // Cache entire user info object instead of just email
  async cacheGoogleAccount(userInfo: UserInfo): Promise<void> {
    const filePath = this.getGoogleAccountsCachePath()
    await fsp.mkdir(path.dirname(filePath), { recursive: true })

    const accounts = await this.readAccounts(filePath)

    // If there's an active account and it's different from the new one, move it to old
    if (accounts.active && accounts.active.email !== userInfo.email) {
      if (!accounts.old.some(user => user.email === accounts.active!.email)) {
        accounts.old.push(accounts.active)
      }
    }

    // Remove the new user from old list if it exists there
    accounts.old = accounts.old.filter((oldUser) => oldUser.email !== userInfo.email)

    // Set new active user
    accounts.active = userInfo
    await fsp.writeFile(filePath, JSON.stringify(accounts, null, 2), 'utf-8')
  }

  // Return email for backward compatibility
  getCachedGoogleAccount(): string | null {
    const filePath = this.getGoogleAccountsCachePath()
    const accounts = this.readAccountsSync(filePath)
    return accounts.active?.email ?? null
  }

  // Get complete user info
  getCachedGoogleUserInfo(): UserInfo | null {
    const filePath = this.getGoogleAccountsCachePath()
    const accounts = this.readAccountsSync(filePath)
    return accounts.active
  }

  getLifetimeGoogleAccounts(): number {
    const filePath = this.getGoogleAccountsCachePath()
    const accounts = this.readAccountsSync(filePath)
    const allEmails = new Set(accounts.old.map(user => user.email))
    if (accounts.active) {
      allEmails.add(accounts.active.email)
    }
    return allEmails.size
  }

  async clearCachedGoogleAccount(): Promise<void> {
    const filePath = this.getGoogleAccountsCachePath()
    const accounts = await this.readAccounts(filePath)

    // Move active account to old list before clearing
    if (accounts.active) {
      if (!accounts.old.some(user => user.email === accounts.active!.email)) {
        accounts.old.push(accounts.active)
      }
      accounts.active = null
    }

    await fsp.writeFile(filePath, JSON.stringify(accounts, null, 2), 'utf-8')
  }
}
