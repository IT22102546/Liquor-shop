/** Seed utilities: registration numbers, password hashing, and seeding helpers. */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

// ============================================================================
// CONSTANTS
// ============================================================================

export const SEED_CONSTANTS = {
  /** Default password for all seeded users */
  DEFAULT_PASSWORD: process.env.SEED_PASSWORD || "LearnUp@2025",
  /** Number of bcrypt salt rounds */
  SALT_ROUNDS: 10,
  /** Default institution code */
  DEFAULT_INSTITUTION_CODE: "PV",
  /** Current academic year */
  ACADEMIC_YEAR: new Date().getFullYear().toString(),
  /** Default timezone */
  TIMEZONE: "Asia/Colombo",
} as const;

// ============================================================================
// PASSWORD UTILITIES
// ============================================================================

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SEED_CONSTANTS.SALT_ROUNDS);
}

/**
 * Get pre-hashed default password
 * Cache the hashed password to avoid re-hashing for each user
 */
let cachedPasswordHash: string | null = null;
export async function getDefaultPasswordHash(): Promise<string> {
  if (!cachedPasswordHash) {
    cachedPasswordHash = await hashPassword(SEED_CONSTANTS.DEFAULT_PASSWORD);
  }
  return cachedPasswordHash;
}

// ============================================================================
// REGISTRATION NUMBER GENERATION
// ============================================================================

/**
 * Registration number format: INSTITUTION_CODE/STUDENT_TYPE/AL_BATCH_YEAR/SEQUENCE
 * Example: PV/IN/2029/001
 *
 * Where:
 * - INSTITUTION_CODE: "PV" (Pivithuru) or custom institution code
 * - STUDENT_TYPE: "IN" (internal) or "EX" (external)
 * - AL_BATCH_YEAR: Calculated A/L exam year based on current grade
 * - SEQUENCE: 3-digit unique sequence within the batch
 */

/**
 * Get student type code based on role
 */
export function getStudentTypeCode(role: UserRole): "IN" | "EX" {
  return role === UserRole.INTERNAL_STUDENT ? "IN" : "EX";
}

/**
 * Calculate A/L batch year based on grade level
 *
 * A/L is taken in Grade 13, exam is in the following year:
 * - Grade 6  → A/L in (currentYear + 8)
 * - Grade 10 → A/L in (currentYear + 4)
 * - Grade 11 → A/L in (currentYear + 3)
 * - Grade 12 → A/L in (currentYear + 2)
 * - Grade 13 → A/L in (currentYear + 1)
 *
 * Formula: A/L Batch Year = Current Year + (13 - Grade Level) + 1
 */
export function calculateALBatchYear(
  gradeLevel: number,
  currentYear?: number
): number {
  const year = currentYear || new Date().getFullYear();
  return year + (13 - gradeLevel) + 1;
}

/**
 * Parse grade level from grade name (e.g., "Grade 10" → 10)
 */
export function parseGradeLevel(gradeName: string): number | null {
  const match = gradeName.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Format sequence number with leading zeros
 */
export function formatSequenceNumber(
  sequence: number,
  digits: number = 3
): string {
  return sequence.toString().padStart(digits, "0");
}

/**
 * Generate a registration number for a student
 *
 * @param params - Registration number parameters
 * @returns Formatted registration number (e.g., "PV/IN/2029/001")
 */
export interface RegistrationNumberParams {
  role: UserRole;
  gradeLevel?: number;
  sequence: number;
  institutionCode?: string;
  currentYear?: number;
}

export function generateRegistrationNumber(
  params: RegistrationNumberParams
): string {
  const {
    role,
    gradeLevel = 10, // Default to Grade 10 if not specified
    sequence,
    institutionCode = SEED_CONSTANTS.DEFAULT_INSTITUTION_CODE,
    currentYear,
  } = params;

  const studentType = getStudentTypeCode(role);
  const alBatchYear = calculateALBatchYear(gradeLevel, currentYear);
  const formattedSequence = formatSequenceNumber(sequence);

  return `${institutionCode}/${studentType}/${alBatchYear}/${formattedSequence}`;
}

// ============================================================================
// SEQUENCE MANAGEMENT
// ============================================================================

/**
 * Track sequence numbers for registration number generation during seeding
 */
export class SequenceTracker {
  private sequences: Map<string, number> = new Map();

  /**
   * Get next sequence number for a given batch
   * @param prefix - The prefix (e.g., "PV/IN/2029")
   * @returns The next sequence number
   */
  getNextSequence(prefix: string): number {
    const current = this.sequences.get(prefix) || 0;
    const next = current + 1;
    this.sequences.set(prefix, next);
    return next;
  }

  /**
   * Get next registration number
   */
  getNextRegistrationNumber(
    role: UserRole,
    gradeLevel: number = 10,
    institutionCode: string = SEED_CONSTANTS.DEFAULT_INSTITUTION_CODE,
    currentYear?: number
  ): string {
    const studentType = getStudentTypeCode(role);
    const alBatchYear = calculateALBatchYear(gradeLevel, currentYear);
    const prefix = `${institutionCode}/${studentType}/${alBatchYear}`;
    const sequence = this.getNextSequence(prefix);

    return `${prefix}/${formatSequenceNumber(sequence)}`;
  }

  /**
   * Reset all sequences (useful for full reseed)
   */
  reset(): void {
    this.sequences.clear();
  }

  /**
   * Get current count for a prefix
   */
  getCurrentCount(prefix: string): number {
    return this.sequences.get(prefix) || 0;
  }
}

// Global sequence tracker for consistent numbering across seed operations
export const sequenceTracker = new SequenceTracker();

// ============================================================================
// CONSOLE LOGGING UTILITIES
// ============================================================================

export const log = {
  info: (message: string) => console.log(`ℹ️  ${message}`),
  success: (message: string) => console.log(`✅ ${message}`),
  warning: (message: string) => console.log(`⚠️  ${message}`),
  error: (message: string) => console.error(`❌ ${message}`),
  step: (step: number, total: number, message: string) =>
    console.log(`[${step}/${total}] ${message}`),
  section: (title: string) =>
    console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`),
  subsection: (title: string) => console.log(`\n--- ${title} ---`),
};

export default {
  SEED_CONSTANTS,
  hashPassword,
  getDefaultPasswordHash,
  generateRegistrationNumber,
  sequenceTracker,
  log,
};
