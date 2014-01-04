---
title: Ghosts
layout: guide
category: concepts
---

A Ghost is a replicated instance of an object. The "real" object lives on a server, and is "ghosted" to clients. Ghosting occurs when an object is visible to a client, as determined by the client's visibility groups.

When a ghost is received by a client, an instance of the appropriate class is created. No arguments are passed to the object's constructor, so classes you intend to ghost with Wasabi must be "default instantiable". The `wsbIsGhost` property of the new instance is set to `true`, providing a way to determine whether a particular instance of an object is real or a ghost.

Wasabi also has some [events]({{site.baseurl}}/doc/classes/Wasabi.html#events) related to ghost creation and destruction.