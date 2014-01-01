---
layout: guide
title: Wasabi
---
Welcome to Wasabi, the simple then powerful game/simulation networking library for Node.js and browsers.

You might be interested in the [API Docs]({{ site.baseurl }}/doc/), the [introduction]({{ site.baseurl }}/guide/introduction.html), or [getting started]({{ site.baseurl }}/guide/getting-started.html).

If you're the skeptical type, here are some <del>self-serving benchmarks for a toy problem</del> informative metrics run on a 2.8Ghz laptop:

    One connection, 1000 objects x 148 ops/sec ±0.83% (86 runs sampled)
    Ten connections, 100 objects x 144 ops/sec ±0.93% (84 runs sampled)
    100 connections, ten objects x 109 ops/sec ±1.06% (82 runs sampled)
    Ten connections, ten objects x 1,165 ops/sec ±0.82% (98 runs sampled)

    1 client with 100 objects for 1000 iterations
    client -> server: 9.15kB (61.42kB with transport)
    0.92kB/s at 15hz
    server -> client: 820.59kB (872.85kB with transport)
    13.09kB/s at 15hz

The metrics above are for objects with the following data attributes (quoting from the object's `serialize` method:

{% highlight javascript %}
desc.uint('uintfoo', 16);  // a 16 bit unsigned integer
desc.sint('sintfoo', 16);  // a 16 bit signed integer
desc.float('floatfoo', 8); // an 8 bit normalized float
desc.string('stringfoo');  // a string populated with the value 'test'
{% endhighlight %}
