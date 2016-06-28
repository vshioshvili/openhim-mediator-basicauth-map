#!/usr/bin/env node
'use strict'

const bodyParser = require('body-parser')
const express = require('express')
const medUtils = require('openhim-mediator-utils')
const request = require('request')
const url = require('url')

const utils = require('./utils')

// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = require('../config/config')
const mediatorConfig = require('../config/mediator')

var port = mediatorConfig.endpoints[0].port

/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
function setupApp () {
  const app = express()
  app.use(bodyParser.raw({type: '*/*'}))

  app.all('*', (req, res) => {
    console.log(`Processing ${req.method} request on ${req.path}`)

    const clientId = req.get('x-openhim-clientid')
    let mapping = null
    if (config.mapping) {
      config.mapping.forEach((map) => {
        if (map.clientID === clientId) {
          mapping = map
        }
      })
    }

    const urlObj = url.parse(config.upstreamURL)
    urlObj.pathname = req.path
    const options = {
      url: url.format(urlObj),
      method: req.method,
      headers: req.headers,
      body: req.body
    }
    if (mapping) {
      options.headers.Authorization = 'Basic ' + new Buffer(`${mapping.username}:${mapping.password}`).toString('base64')
    }

    console.log('Sending upstream request')
    request(options, (err, upstreamRes, upstreamBody) => {
      console.log('Recieved upstream response')
      if (err) {
        console.log(err.stack)
        res.set('Content-Type', 'application/json+openhim')
        return res.send(utils.buildReturnObject(mediatorConfig.urn, 'Failed', 500, {}, err.message))
      }

      // capture orchestration data
      var orchestrationResponse = { statusCode: upstreamRes.statusCode, headers: upstreamRes.headers }
      let orchestrations = []
      orchestrations.push(utils.buildOrchestration('Upstream request', new Date().getTime(), options.method, options.url, options.headers, options.body.toString(), orchestrationResponse, upstreamBody))

      // set content type header so that OpenHIM knows how to handle the response
      res.set('Content-Type', 'application/json+openhim')

      // construct return object
      console.log('Responding to OpenHIM')
      console.log(orchestrations)
      res.send(utils.buildReturnObject(mediatorConfig.urn, 'Successful', 200, upstreamRes.headers, upstreamBody, orchestrations))
    })
  })
  return app
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  if (apiConf.api.trustSelfSigned) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' }

  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        console.log('Failed to register this mediator, check your config')
        console.log(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        console.log('Received initial config:')
        console.log(JSON.stringify(newConfig))
        config = newConfig
        if (err) {
          console.log('Failed to fetch initial config')
          console.log(err.stack)
          process.exit(1)
        } else {
          console.log('Successfully registered mediator!')
          let app = setupApp()
          const server = app.listen(port, () => {
            let configEmitter = medUtils.activateHeartbeat(apiConf.api)
            configEmitter.on('config', (newConfig) => {
              console.log('Received updated config:')
              console.log(JSON.stringify(newConfig))
              // set new config for mediator
              config = newConfig
            })
            callback(server)
          })
        }
      })
    })
  } else {
    // default to config from mediator registration
    config = mediatorConfig.config
    let app = setupApp()
    const server = app.listen(port, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => console.log(`Listening on ${port}...`))
}