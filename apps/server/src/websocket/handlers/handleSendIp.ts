import { ExtractWSRequestFrom } from "@beatsync/shared";
import { sendBroadcast } from "../../utils/responses";
import { requireRoom } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleSendIp: HandlerFunction<
  ExtractWSRequestFrom["SEND_IP"]
> = async ({ ws, message, server }) => {
  const { room } = requireRoom(ws);

  room.processIP({ ws, message });

  sendBroadcast({
    server,
    roomId: ws.data.roomId,
    message: {
      type: "ROOM_EVENT",
      event: {
        type: "CLIENT_CHANGE",
        clients: room.getClients(),
      },
    },
  });
};
