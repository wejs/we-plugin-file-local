module.exports = function Command (program, helpers) {
  program
  .command('rebuild-local-images-styles')
  .description('Command to rebuild all local image styles')
  .action( function run() {
    const we = helpers.getWe();

    we.bootstrap( (err)=> {
      if (err) {
        return doneAll(err);
      }

      we.plugins['we-plugin-file-local']
      .rebuildLocalImagesStyles (we, (err)=> {
        doneAll(err, we)
      });
    });
  });
};

function doneAll(err, we) {
  if (err) {
    we.log.error('rebuild-local-images-styles:Done with error', { error: err });
  } else {
    we.log.verbose('rebuild-local-images-styles:Done all');
  }

  we.exit(process.exit);
}
