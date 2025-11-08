export * from './transaction';
export * from './balance';
export * from './migration';
export * from './activity';


export interface BotCommand {
  data: any;
  execute: (interaction: any) => Promise<void>;
}
