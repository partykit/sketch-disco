import { PartyKitServer } from "partykit/server";

export default {
  onConnect(websocket, room) {
    console.log("no-op");
  },
} satisfies PartyKitServer;
