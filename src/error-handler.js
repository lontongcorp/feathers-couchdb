import errors from 'feathers-errors';

export default function errorHandler(error) {
  let feathersError = error;
  if (error.name === 'CouchError') {
    let myError = (error.code === 404 || error.headers.status === 404) ? errors.NotFound : errors.GeneralError;
    feathersError = new myError(error, {
      ok: error.ok,
      code: error.code
    });
  }

  throw feathersError;
}
