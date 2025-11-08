

import { GuildMember, User } from 'discord.js';
import { permissions } from '@config/permissions';

export class PermissionsHelper {
  /**
   * Проверяет, является ли пользователь администратором экономики.
   * Админом считается либо владелец бота, либо участник с админ-ролью.
   * @param user - Объект User.
   * @param member - Объект GuildMember (необходим для проверки ролей).
   * @returns {boolean}
   */
  static isAdmin(user: User, member: GuildMember | null): boolean {
    
    if (permissions.ownerIds.includes(user.id)) {
      return true;
    }

    
    if (member) {
      const hasAdminRole = member.roles.cache.some(role => 
        permissions.adminRoleIds.includes(role.id)
      );
      if (hasAdminRole) {
        return true;
      }
    }
    
    
    return false;
  }
}
