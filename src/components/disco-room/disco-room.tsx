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
  type ExitMessage,
  type RoomConnections,
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
  @State() socket: PartySocket;
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
    this.socket.send(JSON.stringify(msg));
  }

  // The messageHandler is used by socket
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
        // remove the inUse attribute after 0.5 seconds
        setTimeout(() => {
          discoHyperlink.removeAttribute("in-use");
        }, 500);
      }
    } else if (msg.type === "here") {
      this.connectionsCount = msg.connections;
      // @TODO emit an event to another component to display this
    } else if (msg.type === "connections") {
      // This is a message about another hashedUrl on this page
      const { hashedUrl, connections } = msg;
      // Find the disco-hyperlink element with the matching data-hashedUrl attribute, and set the peep-connections prop to the number of connections
      const discoHyperlink = this.hostEl.querySelector(
        `disco-hyperlink[data-hashedUrl="${hashedUrl}"]`
      );
      if (discoHyperlink) {
        discoHyperlink.setAttribute("peep-connections", connections.toString());
      }
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
        }
      });
    }
  };

  componentWillLoad() {
    // Walk the DOM contained by this.hostEl and wrap all 'a' tags in a disco-hyperlink
    // The result looks like <disco-hyperlink><a ...>...</a></disco-hyperlink>
    // However, if there are disco-include elements present, only wrap the 'a' tags that
    // are inside a disco-include.
    const includes = this.hostEl.querySelectorAll("disco-include");
    //console.log("disco-room:componentWillLoad includes", includes);
    const selector = includes.length > 0 ? "disco-include a" : "a";

    const links = this.hostEl.querySelectorAll(selector);
    links.forEach((link) => {
      const discoLink = document.createElement("disco-hyperlink");
      link.parentNode.insertBefore(discoLink, link);
      discoLink.appendChild(link);
    });

    // Connect to the partyserver for this specific room
    this.socket = new PartySocket({
      host: this.host,
      party: "hyperspace",
      room: this.roomId,
    });
    this.socket.addEventListener("message", this.messageHandler);
  }

  componentDidLoad() {
    // All the disco-hyperlink elements will have been created by now. From all the disco-hyperlink elements,
    // collect data-hashedUrl attributes and send them to the partyserver in a SubscribeMessage
    const hashedUrls =
      Array.from(this.hostEl.querySelectorAll("disco-hyperlink")).map((link) =>
        link.getAttribute("data-hashedUrl")
      ) || [];

    const msg = {
      type: "init",
      hashedUrls: hashedUrls,
    };
    console.log("disco-room:componentDidLoad sending init", msg);
    this.socket.send(JSON.stringify(msg));
  }

  render() {
    return (
      <Host>
        {this.connectionsCount > 0 && (
          <div class="fixed right-2 bottom-2 rounded-full outline outline-1 outline-stone-400 text-xs text-stone-400 px-2 py-1 font-sans">
            Here: {this.connectionsCount}
          </div>
        )}
        <slot></slot>
      </Host>
    );
  }
}
