/**
 * Vault room discovery, creation, and metadata.
 * One private encrypted room per vault; room type com.vaultrix.vault.v1.
 */
import type { MatrixClient } from "matrix-js-sdk";
import { Visibility, Preset, EventType } from "matrix-js-sdk";
import {
  VAULT_ROOM_TYPE,
  VAULT_NAMESPACE,
  VAULT_META_ACCOUNT_DATA_KEY,
  SCHEMA_VERSION,
} from "../constants.js";

export interface VaultMeta {
  version: number;
  vault_room_id: string;
  latest_snapshot_event_id?: string;
  vault_epoch: number;
}

/**
 * Create a new vault room: private, invite-only, encrypted.
 * Only the current user is a member. Room type set in m.room.create for discovery.
 */
export async function createVaultRoom(
  client: MatrixClient
): Promise<{ roomId: string }> {
  const userId = client.getUserId();
  if (!userId) throw new Error("Not logged in");

  const { room_id: roomId } = await client.createRoom({
    visibility: Visibility.Private,
    preset: Preset.PrivateChat,
    name: `${VAULT_NAMESPACE} vault`,
    invite: [],
    // Only set m.room.encryption in initial_state; the homeserver
    // creates m.room.create itself. We add our custom room type via
    // creation_content so we don't try to resend m.room.create and
    // trigger a 400 "Cannot resend m.room.create" error.
    initial_state: [
      {
        type: "m.room.encryption",
        state_key: "",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      },
    ],
    creation_content: {
      type: VAULT_ROOM_TYPE,
    },
    power_level_content_override: {
      users_default: 0,
      events_default: 0,
      users: { [userId]: 100 },
      state_default: 50,
      invite: 0,
    },
  });

  return { roomId };
}

/**
 * Find the vault room for this user by scanning account data or rooms.
 * Returns roomId if found, null otherwise.
 */
export async function discoverVaultRoom(
  client: MatrixClient
): Promise<string | null> {
  const meta = await getVaultMetaFromClient(client);
  if (meta?.vault_room_id) return meta.vault_room_id;

  const rooms = client.getRooms();
  for (const room of rooms) {
    const createEvent = room.currentState.getStateEvents(EventType.RoomCreate, "");
    const content = createEvent?.getContent() as { type?: string } | undefined;
    if (content?.type === VAULT_ROOM_TYPE) return room.roomId ?? "";
  }
  return null;
}

/**
 * Get vault metadata from client account data. Helper used by vaultRoom and client.
 */
export async function getVaultMetaFromClient(
  client: MatrixClient
): Promise<VaultMeta | null> {
  const data = client.getAccountData(VAULT_META_ACCOUNT_DATA_KEY as keyof import("matrix-js-sdk").AccountDataEvents);
  const content = data?.getContent();
  if (!content || typeof content !== "object") return null;
  return content as unknown as VaultMeta;
}

/**
 * Create initial vault metadata (version, room id, epoch).
 */
export function createInitialVaultMeta(roomId: string): VaultMeta {
  return {
    version: SCHEMA_VERSION,
    vault_room_id: roomId,
    vault_epoch: 1,
  };
}
