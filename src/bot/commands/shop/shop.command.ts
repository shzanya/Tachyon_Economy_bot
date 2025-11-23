import {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ChatInputCommandInteraction,
    CacheType,
    ComponentType,
    StringSelectMenuOptionBuilder,
  } from 'discord.js';
  import type { BotCommand } from '@types';
  import { ShopService, ShopRole } from '@bot/services/shop.service'; 
  import { BalanceService } from '@bot/services/balance.service';
  import { Emoji } from '@assets/emoji/emoji.helper'; 
  
  
  interface ShopState {
    page: number;
    filter: string;
    category: 'roles' | 'other';
  }
  
  export const shopCommand: BotCommand = {
    data: new SlashCommandBuilder()
      .setName('shop')
      .setDescription('Магазин сервера с ролями и другими предметами'),
  
    async execute(interaction: ChatInputCommandInteraction<CacheType>) {
      await interaction.deferReply();
  
      const state: ShopState = {
        page: 0,
        filter: 'new', 
        category: 'roles', 
      };
  
      
      const allRoles = await ShopService.getShopRoles();
      
      
  
      const { embeds, components } = await buildShopUI(interaction, state, allRoles);
  
      const message = await interaction.editReply({
        embeds,
        components,
      });
  
      const collector = message.createMessageComponentCollector({
        
        filter: (i) => i.user.id === interaction.user.id,
        time: 600_000, 
      });
  
      collector.on('collect', async (i) => {
        try {
          await i.deferUpdate();
  
          
          if (i.isButton()) {
            const [action, value] = i.customId.split(':');
            
            if (action === 'shop_nav') {
              const totalPages = Math.ceil(allRoles.length / 5);
              switch(value) {
                  case 'first': state.page = 0; break;
                  case 'prev': if (state.page > 0) state.page--; break;
                  case 'trash': return await interaction.deleteReply().catch(() => {});
                  case 'next': if (state.page < totalPages - 1) state.page++; break;
                  case 'last': state.page = totalPages - 1; break;
              }
            }
            else if (action === 'shop_buy') {
              
              await handleBuyRole(i, value);
              return; 
            }
          }
          
          else if (i.isStringSelectMenu()) {
            state.page = 0; 
            if (i.customId === 'shop_filter') {
              state.filter = i.values[0];
            } else if (i.customId === 'shop_category') {
              state.category = i.values[0] as 'roles' | 'other';
            }
          }
  
          
          const sortedRoles = ShopService.filterRoles(allRoles, state.filter);
          const { embeds, components } = await buildShopUI(interaction, state, sortedRoles);
          await interaction.editReply({ embeds, components });
  
        } catch (error) {
          console.error('Ошибка в коллекторе магазина:', error);
        }
      });
  
      collector.on('end', () => {
        interaction.editReply({ content: 'Время взаимодействия вышло.', components: [] }).catch(() => {});
      });
    },
  };
  
  /**
   * Главная функция для построения всего интерфейса магазина
   */
  async function buildShopUI(interaction: ChatInputCommandInteraction<CacheType>, state: ShopState, data: ShopRole[]) {
      const itemsPerPage = 5;
      const totalPages = Math.ceil(data.length / itemsPerPage);
      
      state.page = Math.max(0, Math.min(state.page, totalPages - 1));
  
      const startIndex = state.page * itemsPerPage;
      const pageItems = data.slice(startIndex, startIndex + itemsPerPage);
  
      
      const embed = new EmbedBuilder()
        .setTitle('—・Магазин личных ролей')
        .setColor('#2b2d31')
        .setFooter({ text: `Страница ${state.page + 1} из ${totalPages || 1}` });
  
      if (pageItems.length === 0) {
          embed.setDescription('✨ В этой категории пока нет товаров. Загляните позже!');
      } else {
          const description = pageItems.map((role, index) => {
              const itemNumber = startIndex + index + 1;
              return `**${itemNumber})** <@&${role.roleId}>\n> **Продавец:** <@${role.userId}>\n> **Цена:** ${role.price} ${Emoji.str('coin')}\n> **Куплена раз:** ${role.purchased}`;
          }).join('\n\n');
          embed.setDescription(description);
      }
      
      
      const components: ActionRowBuilder<any>[] = [];
  
      
      const itemButtons = new ActionRowBuilder<ButtonBuilder>();
      for (let i = 0; i < itemsPerPage; i++) {
          const item = pageItems[i];
          const itemNumber = startIndex + i + 1;
          if (item) {
              itemButtons.addComponents(
                  new ButtonBuilder()
                      .setCustomId(`shop_buy:${item.roleId}`)
                      .setLabel(`${itemNumber}`)
                      .setStyle(ButtonStyle.Primary)
              );
          } else {
              
              itemButtons.addComponents(
                  new ButtonBuilder()
                      .setCustomId(`shop_placeholder:${i}`)
                      .setLabel('⠀') 
                      .setStyle(ButtonStyle.Secondary)
                      .setDisabled(true)
              );
          }
      }
      components.push(itemButtons);
  
      
      const filterMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
              .setCustomId('shop_filter')
              .setPlaceholder('Сортировать по...')
              .addOptions(
                  new StringSelectMenuOptionBuilder({ label: 'Сначала новые', value: 'new', default: state.filter === 'new' }),
                  new StringSelectMenuOptionBuilder({ label: 'Сначала старые', value: 'old', default: state.filter === 'old' }),
                  new StringSelectMenuOptionBuilder({ label: 'Сначала дешевые', value: 'price_asc', default: state.filter === 'price_asc' }),
                  new StringSelectMenuOptionBuilder({ label: 'Сначала дорогие', value: 'price_desc', default: state.filter === 'price_desc' }),
                  new StringSelectMenuOptionBuilder({ label: 'Сначала популярные', value: 'popular', default: state.filter === 'popular' }),
                  new StringSelectMenuOptionBuilder({ label: 'Сначала непопулярные', value: 'unpopular', default: state.filter === 'unpopular' })
              )
      );
      components.push(filterMenu);
  
      
      const categoryMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
              .setCustomId('shop_category')
              .setPlaceholder('Выберите категорию')
              .addOptions(
                  new StringSelectMenuOptionBuilder({ label: 'Магазин ролей', value: 'roles', default: state.category === 'roles', emoji: '🎭' }),
                  new StringSelectMenuOptionBuilder({ label: 'Магазин прочего', value: 'other', default: state.category === 'other', emoji: '📦' })
              )
      );
      components.push(categoryMenu);
  
      
      const navigationButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('shop_nav:first').setEmoji(Emoji.nav_first.string).setStyle(ButtonStyle.Secondary).setDisabled(state.page === 0),
          new ButtonBuilder().setCustomId('shop_nav:prev').setEmoji(Emoji.nav_prev.string).setStyle(ButtonStyle.Secondary).setDisabled(state.page === 0),
          new ButtonBuilder().setCustomId('shop_nav:trash').setEmoji(Emoji.nav_trash.string).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('shop_nav:next').setEmoji(Emoji.nav_next.string).setStyle(ButtonStyle.Secondary).setDisabled(state.page >= totalPages - 1),
          new ButtonBuilder().setCustomId('shop_nav:last').setEmoji(Emoji.nav_last.string).setStyle(ButtonStyle.Secondary).setDisabled(state.page >= totalPages - 1)
      );
      components.push(navigationButtons);
  
      return { embeds: [embed], components };
  }
  
  /**
   * Обработчик нажатия на кнопку покупки роли
   */
  async function handleBuyRole(i: any, roleId: string) {
      
      
      const roleData = await ShopService.getRoleData(roleId);
      if (!roleData) {
          return i.followUp({ content: '❌ Эта роль больше не продается.', ephemeral: true });
      }
  
      const embed = new EmbedBuilder()
          .setTitle('Подтверждение покупки')
          .setDescription(`Вы уверены, что хотите приобрести роль <@&${roleId}> за **${roleData.price} ${Emoji.str('coin')}**?\n\n*Роль выдается на 30 дней.*`)
          .setColor('#f0a02d');
  
      const confirmButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
              .setCustomId(`shop_confirm_buy:${roleId}`)
              .setLabel('Купить')
              .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
              .setCustomId('shop_cancel_buy')
              .setLabel('Отмена')
              .setStyle(ButtonStyle.Danger)
      );
      
      await i.followUp({
          embeds: [embed],
          components: [confirmButtons],
          ephemeral: true, 
      });
  }
