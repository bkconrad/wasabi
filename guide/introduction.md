---
title: Introduction
category: overview
layout: guide
---

What Is This Thing?
---

Wasabi was designed as an easy to use, efficient network game library. More generally, Wasabi is an object replication library supporting object lifetime management, natural RPC invocation, and tight binary encoding of data.

"Replication" in this sense means giving two or more processes (typically a server and some clients) functionally identical copies of the same JavaScript object. A natural extension of this is to then allow RPC invocation using the natural method invocation style, e.g. `myObject.rpcFoo('Hello, world!')`. Combined with efficient synchronization of replicas via streams of updates, Wasabi is a full-solution game networking library that combines the efficiency of binary encoding, the power of intuitive object replication, and code sharing of Node.js combined with browser-side JavaScript. 

Although it was designed for games, Wasabi has applications in distributed simulation systems and peer-to-peer data sharing, and has been built to support a variety of network topologies.

Why Would I Use It?
---
If you have the lofty aspiration of making a real-time multiplayer game in JavaScript, or have had the misfortune to actually attempt such a feat, you have a pretty good idea.

Having tried to make a few such games using Node and socket.io, I kept hitting a wall of intractable bandwidth usage. It's easy to reach the order of 100kb/s on a single connection using naive JSON encoding of object data with just a handful of objects. You can pare that down quite a bit with binary encoding and orchestrated unpacking of objects, and build RPC invocation on top of that. Once you throw in object lifetime and visibility management, connection handling, and bit-level data encoding, you're writing a library instead of a game.

So, I wrote the library for you (and me).

Wasabi is an easy to implement system that manages:

 - Data encoding with bit level network usage control
 - Object lifetime and visibility
 - Object synchronization and property updates
 - RPC invocation and directionality
 - Event management

So, if you'd rather write a real-time network game than a real-time network game library, give Wasabi a try.