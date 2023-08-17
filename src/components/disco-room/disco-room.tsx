import { Component, Host, h, Element } from "@stencil/core";

@Component({
  tag: "disco-room",
  styleUrl: "disco-room.css",
  shadow: true,
})
export class DiscoRoom {
  @Element() hostEl: HTMLDivElement;

  componentWillLoad() {
    // Walk the DOM contained by this.hostEl and wrap all 'a' tags in a disco-hyperlink
    // The result looks like <disco-hyperlink><a ...>...</a></disco-hyperlink>
    const links = this.hostEl.querySelectorAll("a");
    links.forEach((link) => {
      const discoLink = document.createElement("disco-hyperlink");
      link.parentNode.insertBefore(discoLink, link);
      discoLink.appendChild(link);
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
