const feathers = require('feathers');
const rest = require('feathers-rest');
const socketio = require('feathers-socketio');
const handler = require('feathers-errors/handler');
const bodyParser = require('body-parser');
const cradle = require('cradle');
const service = require('../lib');

// Create a feathers instance.
const app = feathers()
  .configure(socketio())
  .configure(rest())
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({extended: true}));

const promise = new Promise(function(resolve) {
  const conn = new(cradle.Connection)();

  const opts = {
    connection: conn,
    Model: 'messages',
    paginate: {
      default: 5,
      max: 15
    }
  };

  app.use(`/${opts.Model}`, service(opts));

  // A basic error handler, just like Express
  app.use(handler());

  // Start the server
  var server = app.listen(3000);
  server.on('listening', function() {
    console.log('Feathers Message CouchDB service started');
    resolve(server);
  });
}).catch(function(error){
    console.error(error);
});

module.exports = promise;
