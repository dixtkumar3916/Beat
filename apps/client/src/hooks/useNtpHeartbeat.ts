import { useCallback, useEffect, useRef } from "react";
import { useGlobalStore, MAX_NTP_MEASUREMENTS } from "@/store/global";
import { NTP_CONSTANTS } from "@beatsync/shared";

interface UseNtpHeartbeatProps {
  onConnectionStale?: () => void;
}

export const useNtpHeartbeat = ({
  onConnectionStale,
}: UseNtpHeartbeatProps) => {
  const ntpTimerRef = useRef<number | null>(null);
  const lastNtpRequestTime = useRef<number | null>(null);
  const consecutiveMissedResponses = useRef(0);
  const sendNTPRequest = useGlobalStore((state) => state.sendNTPRequest);

  // Schedule next NTP request
  const scheduleNextNtpRequest = useCallback(() => {
    // Cancel any existing timeout
    if (ntpTimerRef.current) {
      clearTimeout(ntpTimerRef.current);
    }

    // Determine interval based on whether we have initial measurements
    const currentMeasurements = useGlobalStore.getState().ntpMeasurements;
    const isInitialPhase = currentMeasurements.length < MAX_NTP_MEASUREMENTS;
    const interval = isInitialPhase
      ? NTP_CONSTANTS.INITIAL_INTERVAL_MS
      : NTP_CONSTANTS.STEADY_STATE_INTERVAL_MS;

    ntpTimerRef.current = window.setTimeout(() => {
      // Skip stale check during initial rapid-fire phase — timers fire every 30ms
      // so a false positive is essentially impossible, and mobile throttling
      // does not affect sub-100ms timers meaningfully.
      if (!isInitialPhase && lastNtpRequestTime.current) {
        const elapsed = Date.now() - lastNtpRequestTime.current;

        if (elapsed > NTP_CONSTANTS.RESPONSE_TIMEOUT_MS) {
          consecutiveMissedResponses.current++;
          console.warn(
            `NTP response missed (${consecutiveMissedResponses.current}/${NTP_CONSTANTS.MAX_MISSED_RESPONSES}) — elapsed: ${elapsed}ms`
          );

          if (
            consecutiveMissedResponses.current >=
            NTP_CONSTANTS.MAX_MISSED_RESPONSES
          ) {
            console.error(
              "NTP connection declared stale after multiple missed responses"
            );
            onConnectionStale?.();
            return; // Stop the heartbeat — parent will close and reconnect
          }

          // Not yet stale — schedule next check without sending a new request
          // (the previous request is still outstanding)
          scheduleNextNtpRequest();
          return;
        }
      }

      // Send the next NTP request and schedule the following one
      lastNtpRequestTime.current = Date.now();
      sendNTPRequest();
      scheduleNextNtpRequest();
    }, interval);
  }, [sendNTPRequest, onConnectionStale]);

  // Start the heartbeat when socket opens
  const startHeartbeat = useCallback(() => {
    consecutiveMissedResponses.current = 0;
    scheduleNextNtpRequest();
  }, [scheduleNextNtpRequest]);

  // Stop the heartbeat
  const stopHeartbeat = useCallback(() => {
    if (ntpTimerRef.current) {
      clearTimeout(ntpTimerRef.current);
      ntpTimerRef.current = null;
    }
    lastNtpRequestTime.current = null;
    consecutiveMissedResponses.current = 0;
  }, []);

  // Mark that we received an NTP response — resets the missed counter
  const markNTPResponseReceived = useCallback(() => {
    lastNtpRequestTime.current = null;
    consecutiveMissedResponses.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  return {
    startHeartbeat,
    stopHeartbeat,
    markNTPResponseReceived,
  };
};
