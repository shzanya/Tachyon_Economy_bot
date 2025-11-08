export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionCategory =
  
  | 'daily_bonus'
  | 'work'
  | 'salary'
  | 'casino_win'
  | 'quest_reward'
  | 'reward'
  | 'gift'
  | 'investment_return'
  
  | 'shopping'
  | 'gambling'
  | 'food'
  | 'entertainment'
  | 'fees'
  | 'services'
  | 'rent'
  | 'subscription'
  | 'donation'
  
  | 'p2p'
  | 'bank'
  | 'investment'
  | 'loan'
  
  | 'admin_award'   
  | 'admin_take'    
  
  | 'other';

export type CurrencyType = 'coins' | 'diamonds';


export interface Transaction {
  id: string;
  user_id: string;
  guild_id: string;
  type: string;
  category: string;
  amount: number;
  balance_after: number;
  reason: string | null;
  merchant: string | null;
  related_user_id: string | null;
  metadata: string | null;
  created_at: Date;
}


export interface CreateTransactionInput {
  userId: string;
  guildId: string;
  amount: number;
  reason: string;
  currencyType?: CurrencyType;
  merchant?: string;
  relatedUserId?: string;
  metadata?: Record<string, any>;
}

export interface TransactionFilter {
  type?: TransactionType;
  category?: TransactionCategory;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface TransactionAnalytics {
  type: TransactionType;
  category: TransactionCategory;
  total: number;
  count: number;
  average: number;
}

export interface CategoryRules {
  [key: string]: [TransactionType, TransactionCategory];
}
