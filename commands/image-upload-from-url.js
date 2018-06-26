let we;

module.exports = function (program, helpers) {
  const uU = require('../lib/urlImageUploader.js');

  program
  .command('image-upload-from-url <url> <uid>')
  .alias('iufu')
  .description('Download and save one image from internet in user accont')
  .action( function run(url, uid) {
    we = helpers.getWe();

    we.log.verbose('url:', url);
    we.log.verbose('userId:', uid);

    we.bootstrap( (err)=> {
      if (err) return doneAll(err);

      uU.uploadFromUrl(url, we, (err, image)=> {
        if (err) return doneAll(err);
        image.setCreator(uid)
        .then( ()=> {
          we.log.verbose('new image:', image.get());
          doneAll();
          return null;
        });

      });
    });
  });
}

function doneAll(err) {
  if (err) {
    we.log.error('iufu:Done with error', err);
  } else {
    we.log.verbose('iufu:Done all');
  }

  we.exit(process.exit);
}