import {
  Component,
  Host,
  h,
  Element,
  State,
  Event,
  EventEmitter,
  Prop,
} from "@stencil/core";
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
  @Prop() inUse: boolean = false;
  @State() domPath: string;
  @State() hashedUrl: string | null = null;

  @Event({
    eventName: "discoHyperlinkClick",
    composed: true,
    cancelable: true,
    bubbles: true,
  })
  discoHyperlinkClick: EventEmitter<string>; // domPath

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

    // make these visible
    this.hostEl.setAttribute("data-hashedUrl", this.hashedUrl);
    this.hostEl.setAttribute("data-domPath", this.domPath);

    console.log(
      "disco-hyperlink:componentWillLoad",
      href,
      this.domPath,
      this.hashedUrl
    );

    // Listen for clicks on the <a> tag inside self, and emit discoHyperlinkExit
    this.hostEl.querySelector("a").addEventListener("click", (e) => {
      console.log("disco-hyperlink:click", e);
      this.discoHyperlinkClick.emit(this.domPath);
    });
  }

  render() {
    const styles = {
      backgroundColor: this.inUse ? "red" : "blue",
    };

    return (
      <Host style={styles}>
        <slot></slot>
      </Host>
    );
  }
}
