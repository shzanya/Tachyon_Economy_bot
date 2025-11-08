export interface UserBalance {
    id: string;
    coins: number;
    diamonds: number;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface BalanceTransaction {
    id: number;
    user_id: string;
    coins_change: number;
    diamonds_change: number;
    coins_before: number;
    diamonds_before: number;
    coins_after: number;
    diamonds_after: number;
    reason: string;
    metadata: Record<string, any>;
    created_at: Date;
  }
  
  export interface BalanceOptions {
    logTransaction?: boolean;
    reason?: string;
    metadata?: Record<string, any>;
  }
  
  export interface BalanceStats {
    totalUsers: number;
    totalCoins: number;
    totalDiamonds: number;
    avgCoins: number;
    avgDiamonds: number;
  }
