export const R2_AUDIO_FILE_NAME_DELIMITER = "___";

const STEADY_STATE_INTERVAL_MS = 2500;

// NTP Heartbeat Constants
export const NTP_CONSTANTS = {
  // Initial interval for rapid measurement collection
  INITIAL_INTERVAL_MS: 30,
  // Steady state interval after initial measurements
  STEADY_STATE_INTERVAL_MS: STEADY_STATE_INTERVAL_MS,
  // Timeout before considering a single NTP response missed
  // Set generously (6x steady state) to tolerate mobile browser timer throttling
  // when the screen dims or the tab is briefly backgrounded
  RESPONSE_TIMEOUT_MS: 6 * STEADY_STATE_INTERVAL_MS,
  // Maximum number of NTP measurements to collect initially
  MAX_MEASUREMENTS: 40,
  // How many consecutive missed responses before declaring connection stale
  MAX_MISSED_RESPONSES: 3,
} as const;

export const CHAT_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 20_000,
} as const;
