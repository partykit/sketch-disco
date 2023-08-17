import { Component, Host, h, Element, Prop, State } from "@stencil/core";
import PartySocket from "partysocket";
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
  }

  render() {
    return (
      <Host>
        <slot></slot>
      </Host>
    );
  }
}
