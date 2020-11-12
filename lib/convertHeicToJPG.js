const { exec } = require('child_process');

function convertHeicToJPG(originPath, destPath, we, cb) {
  const log = we.log;

  let command = `heif-convert -q 80 ${originPath} ${destPath}`;
  log.verbose('convertHeicToJPG command', { command });

  // should install heic-examples to use heif-convert:
  // TODO add support for more SO options:
  exec(`heif-convert ${originPath} ${destPath}`, (error, stdout, stderr) => {
    if (error) {
      log.verbose('convertHeicToJPG error on run command', {
        error, stdout, stderr
      });
      return cb(null, error);
    }

    cb(null, stdout);
  });
}

module.exports = convertHeicToJPG;
