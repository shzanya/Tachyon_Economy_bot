
declare module 'discord-sync-commands' {
    import type { Client } from 'discord.js';
  
    export interface SyncResult {
      newCommandCount: number;
      updatedCommandCount: number;
      deletedCommandCount: number;
    }
  
    export default function syncCommands(
      client: Client,
      commands: any[],
      options?: {
        debug?: boolean;
        guildId?: string;
      }
    ): Promise<SyncResult>;
  }
