import feathers from 'feathers';
import rest from 'feathers-rest';
import socketio from 'feathers-socketio';
import errorHandler from 'feathers-errors/handler';
import bodyParser from 'body-parser';
import { Connection } from 'cradle';
import service from '../lib';

// Create a feathers instance.
const app = feathers()
  // Enable Socket.io
  .configure(socketio())
  // Enable REST services
  .configure(rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({extended: true}));

export default new Promise(function(resolve) {
    const conn = new(Connection)();

    const opts = {
      connection: conn,
      Model: 'tests',
      paginate: {
        default: 2,
        max: 4
      }
    };

    app.use(`/${opts.Model}`, service(opts));

    // A basic error handler, just like Express
    app.use(errorHandler());

    // Start the server
    var server = app.listen(3000);
    server.on('listening', function() {
      console.log('Feathers Message CouchDB service running on 127.0.0.1:3000');
      resolve(server);
    });
});
