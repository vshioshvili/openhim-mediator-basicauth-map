[![OpenHIM Core](https://img.shields.io/badge/openhim--core-1.4%2B-brightgreen.svg)](http://openhim.readthedocs.org/en/latest/user-guide/versioning.html) [![Build Status](https://travis-ci.org/jembi/openhim-mediator-basicauth-map.svg?branch=master)](https://travis-ci.org/jembi/openhim-mediator-basicauth-map)
# openhim-mediator-basicauth-map
Adds basic auth details that are looked up from a map of OpenHIM client IDs. The mediator will look for the `X-OpenHIM-ClienID` request header that the OpenHIM sets and will attempt to lookup a basic auth username and password to apply for for that client ID. If some are found they are added, otherwise, the request continues as normal.

Run with: `npm start`

Edit the basic auth details map with the mediator config in the OpenHIM console.

