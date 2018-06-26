const request = require('request'),
  uuid = require('uuid'),
  fs = require('fs');

const urlUploader = {
  uploadFromUrl(url, we, cb) {
    const LS = we.config.upload.storages.localFiles;

    we.log.verbose('--> URL to download: ', url);

    let fileName = Date.now() + '_' + uuid.v1();
    let dest = LS.getPath('original', fileName);

    we.log.verbose('--> Will save in: ', dest);

    let file = fs.createWriteStream(dest);

    const stream = request({ url: url }, (err, response)=> {
      if (err) {
        we.log.error('-x> Error on download file:', err);
        return cb(err);
      }

      if (response.statusCode != 200) {
        we.log.warn('-x> Not 200 response on download file:', response.statusCode, fileName);
        return cb();
      }

      let mime = response.headers['content-type'];
      let ext = we.utils.mime.getExtension(mime);

      if (!ext) {
        return fs.unlink(dest, ()=> {
          return cb('invalid file name', response.headers['content-type']);
        });
      }

      let nFileName = fileName +'.'+ ext;

      fs.rename(dest, dest +'.'+ ext, (err)=> {
        if (err) return cb(err);

        const d = {
          name: nFileName,
          storageName: 'localFiles',
          isLocalStorage: true,
          mime: mime
        };

        urlUploader.saveFile(d, nFileName, we, cb);
      });
    })
    .pipe(file);

    stream.on('finish', ()=> {
      file.end();
    });
  },
  saveFile(file, fileName, we, cb) {
    const LS = we.config.upload.storages.localFiles;
    const models = we.db.models;

    file.name = fileName;
    file.path = LS.getPath('original', fileName);

    file.urls = {};
    // set the original url for file upploads
    file.urls.original = LS.getUrlFromFile('original', file);

    models.file.create(file)
    .then( (record, created)=> {
      if (created) {
        we.log.debug('--> New file record created:', record.id);
      } else {
        we.log.debug('--> File record exists:', record.id);
      }

      cb(null, record);
      return null;
    })
    .catch(cb);
  }
};

module.exports = urlUploader;