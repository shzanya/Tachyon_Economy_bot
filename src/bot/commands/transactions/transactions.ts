import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    Message,
    ButtonInteraction,
    StringSelectMenuInteraction
} from 'discord.js';
import { TransactionManager } from '@services/transaction-manager';
import type { Transaction, TransactionType, BotCommand, TransactionCategory } from '@types';
import { TransactionsEmbeds } from './components/transactions.embeds';
import { TransactionsComponents } from './components/transactions.components';

const ITEMS_PER_PAGE = 6;
const COLLECTOR_TIMEOUT = 120_000; 

const data = new SlashCommandBuilder()
  .setName('transactions')
  .setDescription('посмотреть транзакции')
  .addUserOption(option =>
    option.setName('пользователь').setDescription('пользователь чьи транзакции нужно проверить')
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('пользователь') || interaction.user;
  await interaction.deferReply();

  let currentPage = 1;
  let currentTypeFilter: TransactionType | 'all' = 'all';
  let currentCategoryFilter: TransactionCategory | 'all' = 'all';

  let cachedTransactions: Transaction[] = [];
  let totalPages = 1;

  const fetchData = async () => {
    cachedTransactions = await TransactionManager.getTransactions(
      targetUser.id,
      interaction.guildId!,
      {
        type: currentTypeFilter === 'all' ? undefined : currentTypeFilter,
        category: currentCategoryFilter === 'all' ? undefined : currentCategoryFilter,
        limit: 1000
      }
    );
    totalPages = Math.ceil(cachedTransactions.length / ITEMS_PER_PAGE) || 1;
  };

  const renderMessage = (disabled = false) => {
    currentPage = Math.max(1, Math.min(currentPage, totalPages));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const transactionsForPage = cachedTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const embed = TransactionsEmbeds.create(
      targetUser,
      transactionsForPage,
      currentPage,
      totalPages,
    );
    const components = TransactionsComponents.create({
      currentPage: currentPage,
      totalPages,
      typeFilter: currentTypeFilter,
      categoryFilter: currentCategoryFilter,
      disabled 
    });

    return { embeds: [embed], components };
  };

  await fetchData();
  const message = await interaction.editReply(renderMessage()) as Message;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: COLLECTOR_TIMEOUT,
  });

  collector.on('collect', async (i: ButtonInteraction | StringSelectMenuInteraction) => {
    await i.deferUpdate().catch(() => {});
    let needsDataRefetch = false;

    if (i.isButton()) {
      switch (i.customId) {
        case 'transactions_first': currentPage = 1; break;
        case 'transactions_prev': if (currentPage > 1) currentPage--; break;
        case 'transactions_next': if (currentPage < totalPages) currentPage++; break;
        case 'transactions_last': currentPage = totalPages; break;
        case 'transactions_delete': collector.stop('deleted'); return;
      }
    }

    if (i.isStringSelectMenu()) {
      currentPage = 1;
      needsDataRefetch = true;
      if (i.customId === 'transactions_type_filter') {
        currentTypeFilter = i.values[0] as TransactionType | 'all';
      }
      if (i.customId === 'transactions_category_filter') {
        currentCategoryFilter = i.values[0] as TransactionCategory | 'all';
      }
    }

    if (needsDataRefetch) {
      await fetchData();
    }
    await interaction.editReply(renderMessage()).catch(console.error);
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'deleted') {
      await interaction.deleteReply().catch(() => {});
    } else {
      
      await interaction.editReply(renderMessage(true)).catch(() => {});
    }
  });
}

export const transactionsCommand: BotCommand = { data, execute };
