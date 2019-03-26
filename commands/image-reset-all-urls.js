let we;

module.exports = function (program, helpers) {
  const resetAllImageURLs = require('../lib/resetAllImageURLs.js');

  program
  .command('image-reset-all-urls')
  .alias('irau')
  .description('Reset all images urls, use to fix image urls')
  .action( function run() {
    we = helpers.getWe();

    we.bootstrap( (err)=> {
      if (err) return doneAll(err);

      resetAllImageURLs(we, (err)=> {
        if (err) return doneAll(err);
        doneAll();
      });
    });
  });
}

function doneAll(err) {
  if (err) {
    we.log.error('irau:Done with error', err);
  } else {
    we.log.verbose('irau:Done all');
  }

  we.exit(process.exit);
}