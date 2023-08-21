# [WIP] sketch-disco

_WORK IN PROGRESS -- Not yet ready for sharing!_

Implements web components under the 'disco-party' project name.

These components are intended to add a sense of translucency and presence to static webpages.

Right now there is:

- disco-room -- links internal to the site are badged with how many people are connected at the other end, and when another user follows a hypoerlink then it bounces for everyone else.

![image](/assets/peep.png)

## Experimental!

This component was created during [Matt](https://interconnected.org)'s summer 2023 residency. The purpose is to experiment with multiplayer interactions, and simultaneously see what PartyKit can do. It's called a sketch because it's lightweight and quick, and because we learn something in making it.

## Bugs

- [ ] When disco-room receives an 'update' message, it zeros the number of peep-connections for all container disco-hyperlinks. It should not, because update is used as a batch sync at the beginning, but also incremental updates.

## To do

- [ ] Publish the web component to npmjs so anyone can use it
- [ ] Deploy the PartyKit server so that there's a public host to use
- [ ] Remove debug logging
- [ ] Add documentation
- [ ] Add disco-presence to show how many people are on the page (this is hardcoded at the moment)
- [ ] Add disco-cursors with frosted glass cursors
