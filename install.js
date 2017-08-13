const exec = require('child_process').exec

module.exports = {
  /**
   * Install function run in we.js install.
   *
   * @param  {Object}   we    we.js object
   * @param  {Function} done  callback
   */
  install(we, done) {
    exec('gm version', (error)=> {
      if (error) {
        return done('we-plugin-file-local:'+
          'Requirement GraphicsMagick not found or not instaled, see: https://github.com/aheckmann/gm');
      }
      return done();
    });
  }
}
