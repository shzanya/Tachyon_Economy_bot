import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageComponentInteraction } from "discord.js";
import type { BotCommand } from "@types";
import { pool } from "@db/index";
import { logger } from "@utils/logger";
import { Emoji } from "@assets/emoji/emoji.helper";

type TopCategory = 'balance' | 'online' | 'messages' | 'level';

interface TopUserData {
  user: string;
  value: number;
}

function formatSeconds(seconds: number): string {
  if (seconds <= 0) return '0 сек.';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours} ч. ${minutes} мин. ${secs} сек.`;
  }
  if (minutes > 0) {
    return `${minutes} мин. ${secs} сек.`;
  }
  return `${secs} сек.`;
}

async function getTopData(
  guildId: string, 
  category: TopCategory, 
  page: number = 1
): Promise<{ data: TopUserData[], totalPages: number }> {
  const ITEMS_PER_PAGE = 10;
  const offset = (page - 1) * ITEMS_PER_PAGE;
  
  const client = await pool.connect();
  
  try {
    let query = '';
    let countQuery = '';
    
    switch (category) {
      case 'balance':
        query = `
          SELECT u.id, COALESCE(u.coins, 0) as value
          FROM users u
          WHERE EXISTS (
            SELECT 1 FROM user_activity ua 
            WHERE ua.user_id = u.id AND ua.guild_id = $1
          )
          ORDER BY value DESC
          LIMIT $2 OFFSET $3
        `;
        countQuery = `
          SELECT COUNT(*) as total
          FROM users u
          WHERE EXISTS (
            SELECT 1 FROM user_activity ua 
            WHERE ua.user_id = u.id AND ua.guild_id = $1
          )
        `;
        break;
        
      case 'online':
        query = `
          SELECT user_id as id, COALESCE(total_voice, 0) as value
          FROM user_activity
          WHERE guild_id = $1
          ORDER BY value DESC
          LIMIT $2 OFFSET $3
        `;
        countQuery = `
          SELECT COUNT(*) as total
          FROM user_activity
          WHERE guild_id = $1
        `;
        break;
        
      case 'messages':
        query = `
          SELECT user_id as id, COALESCE(total_messages, 0) as value
          FROM user_activity
          WHERE guild_id = $1
          ORDER BY value DESC
          LIMIT $2 OFFSET $3
        `;
        countQuery = `
          SELECT COUNT(*) as total
          FROM user_activity
          WHERE guild_id = $1
        `;
        break;
        
      case 'level':
        query = `
          SELECT user_id as id, COALESCE(level, 1) as value
          FROM user_activity
          WHERE guild_id = $1
          ORDER BY value DESC, xp DESC
          LIMIT $2 OFFSET $3
        `;
        countQuery = `
          SELECT COUNT(*) as total
          FROM user_activity
          WHERE guild_id = $1
        `;
        break;
    }
    
    const { rows } = await client.query(query, [guildId, ITEMS_PER_PAGE, offset]);
    const { rows: countRows } = await client.query(countQuery, [guildId]);
    
    const totalPages = Math.ceil(parseInt(countRows[0].total) / ITEMS_PER_PAGE) || 1;
    
    const data: TopUserData[] = rows.map(row => ({
      user: `<@${row.id}>`,
      value: Number(row.value)
    }));
    
    return { data, totalPages };
  } finally {
    client.release();
  }
}

export const topCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("top")
    .setDescription("Серверный топ пользователей"),
    
  async execute(interaction) {
    await interaction.deferReply();
    
    try {
      const { data, totalPages } = await getTopData(
        interaction.guildId!,
        'balance',
        1
      );
      
      const embed = createTopEmbed('balance', data, 1, totalPages, interaction);
      const components = createTopComponents(1, totalPages, 'balance');
      
      const message = await interaction.editReply({ 
        embeds: [embed], 
        components 
      });
      
      
      setTimeout(async () => {
        try {
          const disabledComponents = components.map(row => {
            row.components.forEach((c: ButtonBuilder | StringSelectMenuBuilder) => c.setDisabled(true));
            return row;
          });
          await interaction.editReply({ components: disabledComponents });
        } catch (err: any) {
          if (err.code !== 10008) {
            logger.error('Ошибка при отключении кнопок топа:', err);
          }
        }
      }, 120_000);
      
      
      const collector = message.createMessageComponentCollector({
        time: 120_000
      });
      
      const processingInteractions = new Set<string>();
      
      collector.on('collect', async (i: MessageComponentInteraction) => {
        
        const isAuthor = i.user.id === interaction.user.id;
        if (!isAuthor) {
          return i.reply({ 
            content: 'Вы не можете управлять этим сообщением.', 
            ephemeral: true 
          });
        }
        
        
        if (processingInteractions.has(i.message.id)) {
          return i.deferUpdate();
        }
        
        processingInteractions.add(i.message.id);
        
        try {
          if (i.isButton()) {
            const [, action, pageStr, , category] = i.customId.split('/');
            
            if (action === 'delete') {
              return interaction.deleteReply();
            }
            
            let newPage = parseInt(pageStr, 10);
            const { data: newData, totalPages: newTotal } = await getTopData(
              interaction.guildId!,
              category as TopCategory,
              newPage
            );
            
            await i.update({
              embeds: [createTopEmbed(category as TopCategory, newData, newPage, newTotal, interaction)],
              components: createTopComponents(newPage, newTotal, category as TopCategory)
            });
          } 
          else if (i.isStringSelectMenu()) {
            const newCategory = i.values[0] as TopCategory;
            const { data: newData, totalPages: newTotal } = await getTopData(
              interaction.guildId!,
              newCategory,
              1
            );
            
            await i.update({
              embeds: [createTopEmbed(newCategory, newData, 1, newTotal, interaction)],
              components: createTopComponents(1, newTotal, newCategory)
            });
          }
        } finally {
          processingInteractions.delete(i.message.id);
        }
      });
      
    } catch (err) {
      logger.error("Ошибка при выполнении команды /top:", err);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2c2d31)
            .setDescription("❌ Произошла ошибка при загрузке топа.")
        ]
      });
    }
  },
};

function createTopEmbed(
  category: TopCategory,
  data: TopUserData[],
  page: number,
  totalPages: number,
  interaction: any
): EmbedBuilder {
  const titles = {
    balance: '—・Топ пользователей по балансу',
    online: '—・Топ пользователей по онлайну',
    messages: '—・Топ пользователей по сообщениям',
    level: '—・Топ пользователей по уровню',
  };
  
  const embed = new EmbedBuilder()
    .setTitle(titles[category])
    .setColor(0x2c2d31)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 4096 }))
    .setFooter({ text: `Страница: ${page}/${totalPages}` });
  
  const description = data
    .map((item, index) => {
      const rank = (page - 1) * 10 + index + 1;
      let displayValue: string;
      
      if (category === 'online') {
        displayValue = formatSeconds(item.value);
      } else if (category === 'balance') {
        displayValue = `${item.value.toLocaleString('ru-RU')} ${Emoji.coin.string}`;
      } else if (category === 'level') {
        displayValue = `${item.value} lvl`;
      } else {
        displayValue = item.value.toLocaleString('ru-RU');
      }
      
      return `**${rank})** ${item.user} — **${displayValue}**`;
    })
    .join('\n');
  
  embed.setDescription(description || 'Нет данных для отображения.');
  
  return embed;
}

function createTopComponents(
  currentPage: number,
  totalPages: number,
  currentCategory: TopCategory
) {
  const hasMultiplePages = totalPages > 1;
  
  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`top_filter/${currentPage}/${totalPages}/${currentCategory}`)
        .setPlaceholder('Выберите категорию топа')
        .addOptions(
          {
            label: 'Баланс',
            value: 'balance',
            default: currentCategory === 'balance',
            emoji: { id: Emoji.coin.id }
          },
          {
            label: 'Онлайн',
            value: 'online',
            default: currentCategory === 'online',
            emoji: '🎙️'
          },
          {
            label: 'Сообщения',
            value: 'messages',
            default: currentCategory === 'messages',
            emoji: '💬'
          },
          {
            label: 'Уровень',
            value: 'level',
            default: currentCategory === 'level',
            emoji: '⭐'
          }
        )
    );
  
  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`top/first/1/${totalPages}/${currentCategory}`)
        .setEmoji({ id: Emoji.nav_first.id })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasMultiplePages || currentPage === 1),
      
      new ButtonBuilder()
        .setCustomId(`top/prev/${Math.max(1, currentPage - 1)}/${totalPages}/${currentCategory}`)
        .setEmoji({ id: Emoji.nav_prev.id })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasMultiplePages || currentPage === 1),
      
      new ButtonBuilder()
        .setCustomId('top/delete/0/0/none')
        .setEmoji({ id: Emoji.nav_trash.id })
        .setStyle(ButtonStyle.Secondary),
      
      new ButtonBuilder()
        .setCustomId(`top/next/${Math.min(totalPages, currentPage + 1)}/${totalPages}/${currentCategory}`)
        .setEmoji({ id: Emoji.nav_next.id })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasMultiplePages || currentPage === totalPages),
      
      new ButtonBuilder()
        .setCustomId(`top/last/${totalPages}/${totalPages}/${currentCategory}`)
        .setEmoji({ id: Emoji.nav_last.id })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasMultiplePages || currentPage === totalPages)
    );
  
  return [row1, row2];
}
