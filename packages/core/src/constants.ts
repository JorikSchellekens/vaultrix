/**
 * App namespace for Matrix vault (room type, account data, secret storage).
 * Plan: com.yourapp.vault.v1 → we use com.vaultrix.vault.v1
 */
export const VAULT_NAMESPACE = "com.vaultrix.vault.v1";

export const VAULT_ROOM_TYPE = `${VAULT_NAMESPACE}`;
export const VAULT_META_ACCOUNT_DATA_KEY = `${VAULT_NAMESPACE}.meta`;
export const VAULT_MASTER_KEY_SECRET_NAME = `${VAULT_NAMESPACE}.master_key`;

export const EVENT_TYPE_VAULT_OP = `${VAULT_NAMESPACE}.op`;
export const EVENT_TYPE_VAULT_SNAPSHOT = `${VAULT_NAMESPACE}.snapshot`;
export const EVENT_TYPE_VAULT_META = `${VAULT_NAMESPACE}.meta`;

export const SCHEMA_VERSION = 1;
