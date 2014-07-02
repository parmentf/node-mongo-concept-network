# mongo-concept-network [![Build Status](https://secure.travis-ci.org/parmentf/node-mongo-concept-network.png)](http://travis-ci.org/parmentf/node-mongo-concept-network) [![NPM version](https://badge.fury.io/js/mongo-concept-network.png)](http://badge.fury.io/js/mongo-concept-network)

Mongo Concept Network is weighted directed graph, in which activation values are propagated. Written in [Node.js](http://nodejs.org) and MongoDb.

## Getting Started

You must ensure that `mongodb` is installed and running (tested with version 2.2.4).

Install the module with: `npm install mongo-concept-network`

```javascript
var ConceptNetwork = require('mongo-concept-network').ConceptNetwork;
var ConceptNetworkState = require('mongo-concept-network').ConceptNetworkState;
var cn = new ConceptNetwork();
var cns = new ConceptNetworkState(cn);
cn.addNode("ECTOR", function (node1) {
  cn.addNode("knows", function (node2) {
    cn.addNode("Achille", function (node3) {
      cn.addLink(node1._id, node2._id, function(link1_2) {
        cn.addLink(node2._id, node3._id, function(link2_3) {
          cns.activate(node1._id, function(nodeState) {
            cns.propagate(function() {
              console.log('End');
            });
          }
        }
      }
    }
  }
}```

## Documentation

This version of Concept Network, on the contrary to the original [concept-network](https://github.com/parmentf/node-concept-network), uses directly MongoDb.
As MongoDb is asynchronous, I can't keep the API of [concept-network](https://github.com/parmentf/node-concept-network).
Much refactoring foreseen.

_(Coming soon)_

## Examples
_(Coming soon)_

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint, and test your code using [mocha](http://visionmedia.github.com/mocha/).

To lint:

```bash
$ npm run jshint
```

To test:

```bash
$ npm test
```

## Release History

2014/?/?: version 0.1.0: First version.

Warning: this is a work in progress.

## License
Copyright (c) 2014 François Parmentier  
Licensed under the MIT license.
