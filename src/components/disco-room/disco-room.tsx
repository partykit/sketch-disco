import {
  Component,
  Host,
  h,
  Element,
  Prop,
  State,
  Listen,
} from "@stencil/core";
import PartySocket from "partysocket";
import {
  type SubscribeMessage,
  type ExitMessage,
  type RoomConnections,
  SINGLETON_ROOM_ID,
} from "../../../partykit/room-types";
import hash from "object-hash";

@Component({
  tag: "disco-room",
  styleUrl: "disco-room.css",
  shadow: true,
})
export class DiscoRoom {
  @Element() hostEl: HTMLDivElement;

  @Prop() host: string;
  @State() roomId: string = hash(window.location.href);
  @State() roomSocket: PartySocket;
  @State() announcerSocket: PartySocket;
  @State() connectionsCount: number = 0;

  @Listen("discoHyperlinkClick")
  handleDiscoHyperlinkClick(event: CustomEvent<string>) {
    // When a disco-hyperlink is exited, send a message to the room to announce it
    console.log("disco-room:handleDiscoHyperlinkClick", event.detail);
    event.stopPropagation();
    const msg: ExitMessage = {
      type: "exit",
      domPath: event.detail,
    };
    this.roomSocket.send(JSON.stringify(msg));
  }

  // The messageHandler is used by both roomSocket and announcerSocket
  private messageHandler = async (e: MessageEvent) => {
    const msg = await JSON.parse(e.data);
    console.log("disco-room:messageHandler", msg);
    if (msg.type === "exit") {
      // When a disco-hyperlink is exited, send a message to the room to announce it
      // Find the disco-hyperlink element with the matching data-domPath attribute, and set the inUse prop to true
      const discoHyperlink = this.hostEl.querySelector(
        `disco-hyperlink[data-domPath="${msg.domPath}"]`
      );
      if (discoHyperlink) {
        console.log(
          "disco-room:messageHandler found disco-hyperlink",
          discoHyperlink
        );
        // set the inUse attribute to true
        discoHyperlink.setAttribute("in-use", "true");
      }
    } else if (msg.type === "here") {
      this.connectionsCount = msg.connections;
      // @TODO emit an event to another component to display this
    } else if (msg.type === "update") {
      const roomConnections = msg.updates as RoomConnections;
      // roomConnections is disco-hyperlink.hashedUrl => number of connections.
      // Iterate over all disco-hyperlink elements and set peep-connections to the number of connections,
      // or 0 if the room's hashedUrl is not in roomConnections
      const discoHyperlinks = this.hostEl.querySelectorAll(
        "disco-hyperlink"
      ) as NodeListOf<HTMLDiscoHyperlinkElement>;
      discoHyperlinks.forEach((discoHyperlink) => {
        const hashedUrl = discoHyperlink.getAttribute("data-hashedUrl");
        if (hashedUrl && roomConnections[hashedUrl]) {
          discoHyperlink.setAttribute(
            "peep-connections",
            roomConnections[hashedUrl].toString()
          );
        } else {
          discoHyperlink.setAttribute("peep-connections", "0");
        }
      });
    }
  };

  componentWillLoad() {
    // Walk the DOM contained by this.hostEl and wrap all 'a' tags in a disco-hyperlink
    // The result looks like <disco-hyperlink><a ...>...</a></disco-hyperlink>
    const links = this.hostEl.querySelectorAll("a");
    links.forEach((link) => {
      const discoLink = document.createElement("disco-hyperlink");
      link.parentNode.insertBefore(discoLink, link);
      discoLink.appendChild(link);
    });

    // Connect to the partyserver for this specific room
    this.roomSocket = new PartySocket({
      host: this.host,
      party: "room",
      room: this.roomId,
    });
    this.roomSocket.addEventListener("message", this.messageHandler);

    // Also connect to the partyserver for the announcer for the whole host
    this.announcerSocket = new PartySocket({
      host: this.host,
      party: "rooms",
      room: SINGLETON_ROOM_ID,
    });
  }

  componentDidLoad() {
    // All the disco-hyperlink elements will have been created by now. From all the disco-hyperlink elements,
    // collect data-hashedUrl attributes and send them to the partyserver in a SubscribeMessage
    const hashedUrls =
      Array.from(this.hostEl.querySelectorAll("disco-hyperlink")).map((link) =>
        link.getAttribute("data-hashedUrl")
      ) || [];

    const msg: SubscribeMessage = {
      type: "subscribe",
      roomIds: hashedUrls,
    };

    console.log("disco-room:componentDidLoad sending subscribe", msg);

    this.announcerSocket.send(JSON.stringify(msg));
  }

  render() {
    return (
      <Host>
        <div class="fixed right-2 bottom-2 rounded-full outline outline-1 outline-stone-400 text-xs text-stone-400 px-2 py-1 font-sans">
          Here: {this.connectionsCount}
        </div>
        <slot></slot>
      </Host>
    );
  }
}
