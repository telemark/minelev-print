'use strict'

const Hapi = require('hapi')
const server = new Hapi.Server()
const config = require('./config')
const louieService = require('./index')
const validate = require('./lib/validateJWT')
const logger = require('./lib/logger')

const goodOptions = {
  ops: {
    interval: 900000
  },
  reporters: {
    console: [{
      module: 'good-squeeze',
      name: 'Squeeze',
      args: [{ log: '*', ops: '*', error: '*' }]
    }, {
      module: 'good-console'
    }, 'stdout']
  }
}

const yarOptions = {
  storeBlank: false,
  cookieOptions: {
    password: config.YAR_SECRET,
    isSecure: process.env.NODE_ENV !== 'development',
    isSameSite: 'Lax'
  }
}

const plugins = [
  {register: require('hapi-auth-cookie')},
  {register: require('vision')},
  {register: require('inert')},
  {register: require('good'), options: goodOptions},
  {register: require('yar'), options: yarOptions}
]

function endIfError (error) {
  if (error) {
    logger('error', ['server', 'endIfError', error])
    process.exit(1)
  }
}

server.connection({
  port: config.WEB_SERVER_PORT
})

server.register(plugins, (error) => {
  endIfError(error)

  server.auth.strategy('session', 'cookie', {
    password: config.COOKIE_SECRET,
    cookie: 'web-minelev-session',
    validateFunc: validate,
    redirectTo: `${config.AUTH_SERVICE_URL}/login?origin=${config.ORIGIN_URL}`,
    appendNext: 'nextPath',
    isSecure: process.env.NODE_ENV !== 'development',
    isSameSite: 'Lax'
  })

  server.auth.default('session')

  server.views({
    engines: {
      html: require('handlebars')
    },
    relativeTo: __dirname,
    path: 'views',
    helpersPath: 'views/helpers',
    partialsPath: 'views/partials',
    layoutPath: 'views/layouts',
    layout: true,
    compileMode: 'sync'
  })

  server.route({
    method: 'GET',
    path: '/public/{param*}',
    handler: {
      directory: {
        path: 'public'
      }
    },
    config: {
      auth: false
    }
  })

  registerRoutes()
})

function registerRoutes () {
  server.register([
    {
      register: louieService,
      options: {}
    }
  ], function (err) {
    if (err) {
      logger('error', ['server', 'registerRoutes', err])
    }
  })
}

module.exports.start = () => {
  server.start(() => {
    logger('info', ['server', 'start', server.info.uri])
  })
}

module.exports.stop = () => {
  server.stop(() => {
    logger('info', ['server', 'stop', 'success'])
  })
}
