# mongo-concept-network [![Build Status](https://secure.travis-ci.org/parmentf/node-mongo-concept-network.png)](http://travis-ci.org/parmentf/node-mongo-concept-network) [![NPM version](https://badge.fury.io/js/mongo-concept-network.png)](http://badge.fury.io/js/mongo-concept-network)

Mongo Concept Network is weighted directed graph, in which activation values are propagated. Written in [Node.js](http://nodejs.org) and MongoDb.

## Getting Started
Install the module with: `npm install mongo-concept-network`

```javascript
var ConceptNetwork = require('mongo-concept-network').ConceptNetwork;
var ConceptNetworkState = require('mongo-concept-network').ConceptNetworkState;
var cn = new ConceptNetwork();
var cns = new ConceptNetworkState(cn);
var node1 = cn.addNode("ECTOR");
var node2 = cn.addNode("knows");
var node3 = cn.addNode("Achille");
cn.addLink(node1.id, node2.id);
cn.addLink(node2.id, node3.id);
cns.activate(node1.id);
cns.propagate();
```

## Documentation

This version of Concept Network, on the contrary to the original [concept-network](https://github.com/parmentf/node-concept-network), uses directly MongoDb.

_(Coming soon)_

## Examples
_(Coming soon)_

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint, and test your code using [mocha](http://visionmedia.github.com/mocha/).

## Release History

2014/?/?: version 0.1.0: First version.

Warning: this is a work in progress.

## License
Copyright (c) 2014 François Parmentier  
Licensed under the MIT license.
