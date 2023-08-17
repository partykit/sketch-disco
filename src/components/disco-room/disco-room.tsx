import { Component, Host, h, Element, Prop, State } from "@stencil/core";
import PartySocket from "partysocket";
import {
  type SubscribeMessage,
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
        <slot></slot>
      </Host>
    );
  }
}
