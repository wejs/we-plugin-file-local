function resetImageURLs(file, we, uploader, cb) {

    const urls = file.urls || {};

    urls.original = uploader.getUrlFromFile ('original', file);

    for (let style in we.config.upload.image.styles) {
      urls[style] = uploader.getUrlFromFile (style, file);
    }

    file.urls = urls;

    file.save()
    .then( ()=> {
      cb();
      return null;
    })
    .catch(cb);
}

module.exports = resetImageURLs;