import { Component, Host, h, Element, State } from "@stencil/core";
import hash from "object-hash";

function getDomPath(el) {
  const parts = [];
  while (el && el.tagName) {
    let selector = el.tagName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
      parts.unshift(selector);
      break; // ID is unique, no need to go further
    } else {
      let sib = el,
        nth = 1;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName.toLowerCase() === selector) nth++;
      }
      if (nth !== 1) selector += `:nth-of-type(${nth})`;
    }
    parts.unshift(selector);
    el = el.parentNode;
  }
  return parts.join(" > ");
}

@Component({
  tag: "disco-hyperlink",
  styleUrl: "disco-hyperlink.css",
  shadow: true,
})
export class DiscoHyperlink {
  @Element() hostEl: HTMLDivElement;
  @State() domPath: string;
  @State() hashedUrl: string | null = null;

  componentWillLoad() {
    // Populate domPath (used to listen for exits through self) and hashedUrl (used to peep through hyperlinks)
    const getHashedUrl = (
      href: string,
      base: string = window.location.href
    ) => {
      const url = new URL(href, base);
      return hash(url.toString());
    };

    const href = this.hostEl.querySelector("a").href;
    this.hashedUrl = getHashedUrl(href);

    this.domPath = getDomPath(this.hostEl);

    console.log(
      "disco-hyperlink:componentWillLoad",
      href,
      this.domPath,
      this.hashedUrl
    );
  }

  render() {
    return (
      <Host>
        <slot></slot>
      </Host>
    );
  }
}
