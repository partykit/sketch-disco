import { Component, Host, h } from '@stencil/core';

@Component({
  tag: 'disco-hyperlink',
  styleUrl: 'disco-hyperlink.css',
  shadow: true,
})
export class DiscoHyperlink {

  render() {
    return (
      <Host>
        <slot></slot>
      </Host>
    );
  }

}
