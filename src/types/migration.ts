
export interface Migration {
    id: number;
    name: string;
    applied_at: Date;
    checksum: string;
  }
  
  export interface MigrationFile {
    id: number;
    name: string;
    filename: string;
    sql: string;
    checksum: string;
  }
