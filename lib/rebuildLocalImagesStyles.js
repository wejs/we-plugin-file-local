function rebuildLocalImagesStyles (we, doneAll) {
  const models = we.db.models;
  const async = we.utils.async;
  const LS = we.config.upload.storages.localImages;

  let count = 0;

  async.series([
    function (done) {
      models.image.count()
      .then((c)=> {
         count = c;
         we.log.info('rebuildLocalImagesStyles:images to process:', { count: c });
         done();
      })
      .catch(done);
    },
    function (done) {
      rebuildOneImageStyles(we, LS, 0, done);
    }
  ], (err)=> {
    doneAll(err);
  });
}

function rebuildOneImageStyles (we, LS, lastId, done) {
  const Op = we.Op;
  const models = we.db.models;

  models.image.findOne({
    where: {
      id: {
        [Op.gt]: lastId,
      },
    },
    order: [
      ['id', 'ASC'],
    ],
  })
  .then((file)=> {
    if (!file) {
      we.log.verbose('rebuildLocalImagesStyles: done all:', { file: file });
      return done();
    }

    we.log.info('rebuildLocalImagesStyles: will rebuild:', { file: file });

    rebuildImageStyle(file, file.name, LS, we, (err, recordUpdated)=> {
      if (err) return done(err);

      we.log.verbose('rebuildLocalImagesStyles: done one:', { recordUpdated: recordUpdated });

      rebuildOneImageStyles (we, LS, file.id, done);
    });
  })
  .catch(done);
}

function rebuildImageStyle(file, fileName, LS, we, cb) {
  file.name = fileName;
  file.path = LS.getPath('original', fileName);

  file.urls = {};

  // set temporary image styles
  let styles = we.config.upload.image.styles;
  for (let sName in styles) {
    file.urls[sName] = we.config.hostname+'/api/v1/image/' + sName + '/' + file.name;
  }

  LS.generateImageStyles(file, (err)=> {
    if (err) return cb(err);

    const urls = file.urls;
    // set the original url for file upploads
    urls.original = LS.getUrlFromFile('original', file);
    file.urls = urls;

    file.save()
    .then(()=> {
      cb(null, file);
    })
    .catch(cb)
  });
}

module.exports = rebuildLocalImagesStyles;
