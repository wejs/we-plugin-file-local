function recreateAllImageSizes(we, style, cb) {
  let ctx = { index: 0, count: 0 };

  let uploader = we.config.upload.storages.localImages;
  let resizeEach = uploader.resizeEach;

  if (!style) return cb(null, ctx);

  we.log.verbose('we-plugin-file-local:recreateAllImageSizes:start');

  importOne(we, ctx, resizeEach, uploader, style, (err, r)=> {
    if (err) {
      we.log.verbose('we-plugin-file-local:recreateAllImageSizes:doneWithError:', err);
    } else {
      we.log.verbose('we-plugin-file-local:recreateAllImageSizes:done', r);
    }

    cb(err, r);
  });
}

function importOne(we, ctx, resizeEach, uploader, style, cb) {
  getOneImageFromDB(we, ctx, (err, file)=> {
    if (err) return cb(err, ctx);
    if (!file || !file.id) return cb(null, ctx); // done All
    ctx.index = file.id;
    ctx.count++;
    resizeEach.bind({ file: file, uploader: uploader })(style, (err)=> {
      if (err) return cb(err, ctx);

      file.save()
      .then(()=> {
        importOne(we, ctx, resizeEach, uploader, style, cb);
        return null;
      })
      .catch(cb);
    });
  });
}

function getOneImageFromDB(we, ctx, cb) {
  we.db.models.image
  .findOne({
    where: {
      id: { $gt: ctx.index }
    },
    order: [['id', 'ASC']]
  })
  .then( (img)=> {
    cb(null, img);
    return null;
  })
  .catch(cb);
}

module.exports = recreateAllImageSizes;