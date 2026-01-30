/**
 * Vault entry types and field schemas (1Password-style).
 * Plan: entry.type, predefined fields per type, custom_fields array.
 */
export type EntryType =
  | "login"
  | "secure_note"
  | "credit_card"
  | "identity"
  | "api_credential"
  | "custom";

export type CustomFieldKind = "text" | "password" | "hidden";

export interface CustomField {
  id: string;
  name: string;
  value: string;
  kind?: CustomFieldKind;
}

/** Attachment (image or file) reference stored on an entry */
export interface EntryAttachment {
  id: string;
  mxc_url?: string;
  filename?: string;
  content_type?: string;
}

/** Login: username, password, url, TOTP/HOTP, recovery codes */
export interface LoginFields {
  username?: string;
  password?: string;
  url?: string;
  totp_secret?: string;
  totp_issuer?: string;
  totp_account?: string;
  hotp_secret?: string;
  hotp_counter?: number;
  recovery_codes?: string[];
}

/** Secure note: body */
export interface SecureNoteFields {
  body?: string;
}

/** Credit card */
export interface CreditCardFields {
  cardholder?: string;
  number?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;
  billing_address?: string;
}

/** Identity */
export interface IdentityFields {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  dob?: string;
}

/** API credential */
export interface ApiCredentialFields {
  client_id?: string;
  client_secret?: string;
  api_key?: string;
  url?: string;
  notes?: string;
}

export type TypeSpecificFields =
  | LoginFields
  | SecureNoteFields
  | CreditCardFields
  | IdentityFields
  | ApiCredentialFields;

export interface VaultEntry {
  id: string;
  type: EntryType;
  folder_id?: string;
  title: string;
  /** Type-specific predefined fields */
  username?: string;
  password?: string;
  url?: string;
  totp_secret?: string;
  totp_issuer?: string;
  totp_account?: string;
  hotp_secret?: string;
  hotp_counter?: number;
  recovery_codes?: string[];
  body?: string;
  cardholder?: string;
  number?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;
  billing_address?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  dob?: string;
  client_id?: string;
  client_secret?: string;
  api_key?: string;
  notes?: string;
  custom_fields: CustomField[];
  attachments?: EntryAttachment[];
  created_at: number;
  updated_at: number;
}

export interface VaultOpPayload {
  schema_version: number;
  entry: VaultEntry;
}

export type VaultOpType = "create" | "update" | "delete";

export interface VaultOpEventContent {
  op_id: string;
  device_id: string;
  ts: number;
  op: VaultOpType;
  entry_id: string;
  prev?: string;
  epoch: number;
  ciphertext: string;
}
