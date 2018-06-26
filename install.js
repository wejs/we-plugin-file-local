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
  },
  updates: function() {
    return [{
      version: '2.1.1',
      update(we, done) {
        we.log.info('Start we-plugin-file-local update v2.1.1');

        const sql = 'ALTER TABLE `files` CHANGE COLUMN `mime` `mime` VARCHAR(255) NULL DEFAULT NULL ;';
        we.db.defaultConnection
        .query(sql)
        .then( ()=> {
          we.log.info('Done we-plugin-file-local update v2.1.1');
          done();
          return null;
        })
        .catch(done);
      }
    }];
  }
}


