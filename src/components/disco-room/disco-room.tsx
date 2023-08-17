import { Component, Host, h } from '@stencil/core';

@Component({
  tag: 'disco-room',
  styleUrl: 'disco-room.css',
  shadow: true,
})
export class DiscoRoom {

  render() {
    return (
      <Host>
        <slot></slot>
      </Host>
    );
  }

}
