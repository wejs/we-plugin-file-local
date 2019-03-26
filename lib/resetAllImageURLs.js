const resetImageUrls = require('./resetImageURLs.js');

function resetAllImageURLs(we, cb) {
  let ctx = { index: 0, count: 0 };

  let uploader = we.config.upload.storages.localImages;

  we.log.verbose('we-plugin-file-local:resetAllImageURLs:start');

  updateOne(we, ctx, uploader, (err, r)=> {
    if (err) {
      we.log.verbose('we-plugin-file-local:resetAllImageURLs:doneWithError:', err);
    } else {
      we.log.verbose('we-plugin-file-local:resetAllImageURLs:done', r);
    }

    cb(err, r);
  });
}

function updateOne(we, ctx, uploader, cb) {
  getOneImageFromDB(we, ctx, (err, file)=> {
    if (err) return cb(err, ctx);
    if (!file || !file.id) return cb(null, ctx); // done All

    we.log.verbose('we-plugin-file-local:resetAllImageURLs:fileId to update:', file.id);

    ctx.index = file.id;
    ctx.count++;

    if (file.storageName != 'localImages') {
      // only works with local files, go to next if are a diferent storage
      return updateOne(we, ctx, uploader, cb);
    }

    resetImageUrls(file, we, uploader, (err)=> {
      if (err) return cb(err);

      updateOne(we, ctx, uploader, cb);
    });
  });
}

function getOneImageFromDB(we, ctx, cb) {
  we.db.models.image
  .findOne({
    where: {
      id: { [we.Op.gt]: ctx.index },
      storageName: 'localImages'
    },
    order: [['id', 'ASC']]
  })
  .then( (img)=> {
    cb(null, img);
    return null;
  })
  .catch(cb);
}

module.exports = resetAllImageURLs;