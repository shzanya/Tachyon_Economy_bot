import { VoiceState } from "discord.js";
import { VoiceTrackerManager } from "@managers/voice-tracker.manager";
import { logger } from "@utils/logger";

export default {
  name: "voiceStateUpdate",
  once: false,
  async execute(oldState: VoiceState, newState: VoiceState) {
    if (newState.member?.user.bot) return;

    const wasActive = oldState.channel && !oldState.selfDeaf && !oldState.serverDeaf;
    const isActive = newState.channel && !newState.selfDeaf && !newState.serverDeaf;

    
    if (oldState.channel && !newState.channel) {
      if (wasActive) {
        await VoiceTrackerManager.handleSessionEnd(oldState);
      }
      return;
    }

    
    if (!oldState.channel && newState.channel) {
      if (isActive) {
        await VoiceTrackerManager.handleSessionStart(newState);
      }
      return;
    }

    
    if (oldState.channelId !== newState.channelId) {
      if (wasActive) {
        await VoiceTrackerManager.handleSessionEnd(oldState);
      }
      if (isActive) {
        await VoiceTrackerManager.handleSessionStart(newState);
      }
      return;
    }

    
    if (wasActive !== isActive) {
      if (isActive) {
        
        await VoiceTrackerManager.handleSessionStart(newState);
      } else {
        
        await VoiceTrackerManager.handleSessionEnd(oldState);
      }
    }
  },
};
