import { Message } from "discord.js";
import { MessageTrackerManager } from "@managers/message-tracker.manager";

export default {
  name: "messageCreate",
  once: false,
  async execute(message: Message) {
    
    if (message.author.bot) return;

    
    if (!message.guild) return;

    
    await MessageTrackerManager.handleMessage(message);
  },
};
