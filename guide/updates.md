---
title: Updates
layout: guide
category: concepts
---

In Wasabi, updating refers to the process of synchronizing a client's version of an object with the server's version of the same object. Updates are sent for all objects in a client's scope during each call to `processConnections`.

To control which properties should be synchronized, and how, you must define a
`serialize` method for your classes.

Wasabi will look for this `serialize` method when it sends updates to clients,
and when receiving updates from servers. Wasabi is built so that you can (and
really should) use the same serialize method on both the server and client.

For example, if you have a `Player` class and would like to send position and
velocity updates to the clients each frame, your serialize method might look
like:

{% highlight javascript %}
Player.prototype.serialize = function (desc) {
    desc.uint('x', 16); // a 16 bit unsigned integer named x
    desc.uint('y', 16); // a 16 bit unsigned integer named y
    desc.sint('xvel', 8); // an 8 bit signed integer named xvel
    desc.sint('yvel', 8); // an 8 bit signed integer named yvel
}
{% endhighlight %}

The `serialize` method is passed a single argument, which is a `Description` object, typically referred to as `desc`. Calling methods on this object controls the name, type, and size in bits of the properties to send.