import { EmbedBuilder, User } from 'discord.js';


const COIN_EMOJI = ':coin:';

/**
 * ✅ Создает embed для успешного получения награды.
 */
export const createTimelySuccessEmbed = (
  user: User,
  amount: number,
  nextTimelyTimestamp: number
): EmbedBuilder => {
  return new EmbedBuilder()
    .setTitle('Временная награда')
    .setDescription(
      `${user}, Вы **забрали** свои **${amount}** ${COIN_EMOJI} Возвращайтесь <t:${nextTimelyTimestamp}:R>`
    )
    .setColor(0x2c2d31) 
    .setThumbnail(user.displayAvatarURL());
};

/**
 * ⏳ Создает embed для случая, когда награда уже на кулдауне.
 */
export const createTimelyCooldownEmbed = (
  user: User,
  nextTimelyTimestamp: number
): EmbedBuilder => {
  return new EmbedBuilder()
    .setTitle('Временная награда')
    .setDescription(
      `${user}, Вы **уже** забрали **временную** награду! Вы сможете получить следующую <t:${nextTimelyTimestamp}:R>`
    )
    .setColor(0x2c2d31) 
    .setThumbnail(user.displayAvatarURL());
};

/**
 * ❌ Создает embed для отображения ошибки.
 */
export const createTimelyErrorEmbed = (message: string): EmbedBuilder => {
    return new EmbedBuilder()
      .setColor(0x2c2d31) 
      .setTitle('❌ Ошибка')
      .setDescription(message)
      .setTimestamp();
};
