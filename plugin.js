/**
 * We.js local storage plugin
 */

const gm = require('gm'),
  uuid = require('uuid'),
  path = require('path'),
  mkdirp = require('mkdirp'),
  fs = require('fs'),
  recreateAllImageSizes = require('./lib/recreateAllImageSizes.js'),
  resetAllImageURLs = require('./lib/resetAllImageURLs.js'),
  convertHeicToJPG = require('./lib/convertHeicToJPG.js');

module.exports = function loadPlugin(projectPath, Plugin) {
  const plugin = new Plugin(__dirname);

  plugin.urlImageUploader = require('./lib/urlImageUploader.js');
  plugin.urlUploader = plugin.urlImageUploader

  plugin.urlFileUploader = require('./lib/urlFileUploader.js');
  plugin.rebuildLocalImagesStyles = require('./lib/rebuildLocalImagesStyles.js');
  plugin.defaultFilename = function defaultFilename (req, file, cb) {
    file.name = Date.now() + '_' + uuid.v1() + '.' + (file.originalname.split('.').pop().toLowerCase());
    cb(null, file.name);
  }

  plugin.getMulter = function() {
    if (plugin.we.plugins['we-plugin-file']) {
      return  plugin.we.plugins['we-plugin-file'].multer;
    } else if (plugin.we.plugins.project.multer) {
      return plugin.we.plugins.project.multer;
    } else {
      plugin.we.log.warn('Multer not found');
    }
  }

  // set plugin configs
  plugin.setConfigs({
    fileHostname: null, // config to set generic file hostname, if you dont want set an hostname set this to ""
    fileImageHostname: null, // config to set image hostname, if you dont want set an hostname set this to ""

    imageMaxSize: {
      width: '1920',
      height: '1440'
    },
    imageResizeStrategy: 'cut',
    imageFillBG: '#ffffff',

    upload: {
      defaultImageStorage: 'localImages',
      defaultFileStorage: 'localFiles',

      file: {
        uploadPath: projectPath + '/files/uploads/files'
      },

      image: {
        uploadPath: projectPath + '/files/uploads/images'
      },

      storages: {
        localImages: {
          isLocalStorage: true,
          getStorage() {
            const multer = plugin.getMulter();
            if (!multer) return;

            return multer
            .diskStorage({
              destination: this.getDestination('original'),
              filename: plugin.defaultFilename
            });
          },
          /**
           * Send one file to user
           *
           * @param  {Object} image
           * @param  {Object} req
           * @param  {Object} res
           * @param  {String} style
           */
          sendFile(image, req, res, style) {
            const we = plugin.we;

            const path = this.getPath(style, image.name);
            // check if file exists with fs.stat
            fs.stat(path, function afterCheckIfFileExists (err) {
              if (err) {
                return res.serverError(err);
              } else {
                const stream = fs.ReadStream(path);

                if (image.mime) {
                  res.contentType(image.mime);
                } else {
                  res.contentType('image/png');
                }
                // set http cache headers
                if (!res.getHeader('Cache-Control')) {
                  res.setHeader('Cache-Control', 'public, max-age=' + we.config.cache.maxage);
                }

                stream.pipe(res);

                stream.on('error', (err)=> {
                  we.log.error('image:findOne: error in send file', { error: err });
                });
              }
            });
          },
          destroyFile(file, done) {
            const self = this

            plugin.we.utils.async.eachSeries(
              plugin.we.config.upload.image.avaibleStyles,
              function onEach (style, done) {
                self.destroyOneImage(file, style, done);
              },
              function afterEachStyle (err) {
                if (err) return done(err);
                // delete the original format
                self.destroyOneImage(file, 'original', done);
              }
            );
          },
          destroyOneImage(file, style, done) {
            const path = this.getPath(style, file.name);
            fs.exists(path, function afterCheckIfFileExists(exists) {
              if (!exists) return done();
              fs.unlink(path, done);
            })
          },
          getUrlFromFile(format, file) {
            if (typeof plugin.we.config.fileImageHostname == 'string') {
              return plugin.we.config.fileImageHostname+'/api/v1/image/' + (format || 'original') + '/' + file.name;
            }

            return '/api/v1/image/' + (format || 'original') + '/' + file.name;
          },
          getDestination(style) {
            if (!style) style = 'original';
            return plugin.we.config.upload.image.uploadPath + '/' + style + '/';
          },
          getPath(style, name) {
            return path.join(
              this.getDestination(style),
              name
            );
          },
          generateImageStyles(file, done) {
            const we = plugin.we;

            this.convertFileIfIsNeed(file, (err)=> {
              if (err) return done(err);

              we.utils.async.eachSeries(
                we.config.upload.image.avaibleStyles,
                this.resizeEach.bind({ file: file, uploader: this }),
                (err)=> {
                  if (err) return done(err);
                  this.resizeOriginalIfNeed(file, done);
                }
              );
            });
          },

          resizeOriginalIfNeed(file, done) {
            // max sizes
            const ms = plugin.we.config.imageMaxSize;

            gm(file.path)
            .identify( (err, data)=> {
              if (err) return done(err);

              const ed = file.extraData || {};
              ed.size = data.size;
              file.extraData = ed;

              if (
                data.size.width > ms.width ||
                data.size.height > ms.height
              ) {
                gm(file.path)
                .autoOrient()
                .resize(ms.width, ms.height)
                .gravity('Center')
                .crop(ms.width, ms.height)
                .write(file.path, done);
              } else {
                // dont need resize:
                done();
              }
            });
          },

          /**
           * Resize one image to fit image style size
           *
           * @param  {String}   imageStyle
           * @param  {Function} next         callback
           */
          resizeEach(imageStyle, next) {
            const styles = plugin.we.config.upload.image.styles;

            const originalFile = this.uploader.getPath('original', this.file.name);
            const newImagePath = this.uploader.getPath(imageStyle, this.file.name);
            // set new image style to save in DB

            const urls = this.file.urls || {};
            urls[imageStyle] = this.uploader.getUrlFromFile (imageStyle, this.file);
            this.file.urls = urls;

            const width = styles[imageStyle].width;
            const height = (styles[imageStyle].height || styles[imageStyle].heigth);
            // resize, center and crop to fit size
            this.uploader.resizeImage(
              originalFile, width, height, newImagePath, next
            );
          },
          resizeImage(orig, width, height, dest, cb) {
            if (
              plugin.we.config.imageResizeStrategy == 'fill') {
              this.resizeWithFill(
                orig, width, height, dest, cb
              );
            } else {
              // resize, center and crop to fit size
              gm(orig)
              .autoOrient()
              .resize(width, height, '^')
              .gravity('Center')
              .crop(width, height)
              .write(dest, cb);
            }
          },
          resizeWithFill(orig, width, height, dest, cb) {
            gm(orig)
            .autoOrient()
            .resize(width, height)
            .gravity('Center')
            .background(plugin.we.config.imageFillBG)
            .extent(width, height)
            .write(dest, cb);
          },

          convertFileIfIsNeed(file, cb) {
            if (
              file.mime === 'image/heif' ||
              file.mime === 'image/heic'
            ) {
              return this.convertHeifToJPG(file, cb);
            }

            return cb();
          },

          convertHeifToJPG(file, cb) {
            const log = plugin.we.log;

            log.verbose('convertHeifToJPG will convert file', { file: file });

            const oldPath = file.path;
            let dest = file.path.replace('heic', 'jpg').replace('heif', 'jpg');

            log.verbose('convertHeifToJPG starting conversor', { file: file });

            convertHeicToJPG(file.path, dest, plugin.we, (err)=> {
              if (err) {
                log.error('convertHeicToJPG error on convert image', {
                  file,
                  dest,
                  error: err
                });
                return cb(err);
              }

              file.path = dest;
              file.name = file.name.replace('heic', 'jpg').replace('heif', 'jpg');
              file.filename = file.name;
              file.mimetype = 'image/jpeg';
              file.mime = file.mimetype;

              for(let name in file.urls) {
                file.urls[name] = file.urls[name].replace('heic', 'jpg').replace('heif', 'jpg');
              }

              const stats = fs.statSync(dest);
              file.size = stats.size;

              fs.unlinkSync(oldPath);

              cb();
            });
          }
        },
        localFiles: {
          isLocalStorage: true,
          getStorage() {
            const multer = plugin.getMulter()
            if (!multer) return;

            return multer
            .diskStorage({
              destination: this.getDestination(),
              // projectPath + '/files/uploads/files',
              filename: plugin.defaultFilename
            });
          },
          /**
           * Send one file to user
           *
           * @param  {Object} file
           * @param  {Object} req
           * @param  {Object} res
           * @param  {String} style
           */
          sendFile(file, req, res) {
            const we = plugin.we;
            const path = this.getPath(null, file.name);

            // check if file exists with fs.stat
            fs.stat(path, function afterCheckIfFileExists (err) {
              if (err) {
                return res.notFound(err)
              }

              const stream = fs.ReadStream(path);

              if (file.mime) res.contentType(file.mime);
              // set http cache headers
              if (!res.getHeader('Cache-Control')) {
                res.setHeader('Cache-Control', 'public, max-age=' + we.config.cache.maxage)
              }

              stream.pipe(res);

              stream.on('error', function onError(err) {
                we.log.error('file:findOne: error in send file', { error: err })
                res.serverError(err);
              });
            })
          },
          destroyFile(file, done) {
            const path = this.getPath(null, file.name);

            fs.exists(path, function afterCheckIfFileExists(exists) {
              if (!exists) return done();
              fs.unlink(path, done);
            });
          },
          getUrlFromFile(format, file) {
            if (typeof plugin.we.config.fileHostname == 'string') {
              return plugin.we.config.fileHostname+'/api/v1/file-download/' + file.name;
            }

            return '/api/v1/file-download/' + file.name;
          },
          getDestination() {
            return plugin.we.config.upload.file.uploadPath + '/';
          },
          getPath(style, name) {
            return path.join(
              this.getDestination(style),
              name
            );
          }
        }
      }
    }
  });

  /**
   * Plugin fast loader for speed up We.js project bootstrap
   *
   * @param  {Object}   we
   * @param {Function} done    callback
   */
  plugin.fastLoader = function fastLoader(we, done) {
    // - Controllers:
    we.controllers.imageLocal = new we.class.Controller({
      recreateAllForOneStyle(req, res) {
        recreateAllImageSizes(req.we, req.params.style, (err, result)=> {
          if (err) return res.queryError(err);
          res.send({ totalResized: result.count });
        });
      },
      resetAllUrls(req, res) {
        resetAllImageURLs(req.we, (err, result)=> {
          if (err) return res.queryError(err);
          res.send({ totalResized: result.count });
        });
      }
    });

    done();
  }

  plugin.setRoutes({
    'get /image-local/resize-all/:style': {
      'controller': 'imageLocal',
      'action': 'recreateAllForOneStyle',
      'permission': 'image_resizeAll',
      'responseType': 'json'
    },
    'get /image-local/reset-all-urls': {
      'controller': 'imageLocal',
      'action': 'resetAllUrls',
      'permission': 'image_resetAllUrls',
      'responseType': 'json'
    }
  });

  /**
   * Create file and image upload Folders
   * For local storage
   *
   * @param  {Object}   we
   * @param  {Function} done
   */
  plugin.createFileFolder = function createFileFolder (we, done) {
    // create file upload path
    mkdirp(we.config.upload.file.uploadPath)
      .catch((err)=> {
        if (err) we.log.error('Error on create file upload path', { error: err });
      });

    // create image upload path
    const imageStyles = we.config.upload.image.avaibleStyles

    we.utils.async.each(imageStyles, (style, next)=> {
      const imageDir = we.config.upload.image.uploadPath + '/' + style

      fs.lstat(imageDir, (err)=> {
        if (err) {
          if (err.code === 'ENOENT') {
            we.log.info('Creating the image upload directory: ' + imageDir)
            return mkdirp(imageDir)
              .then(()=> {
                return next();
              })
              .catch(()=> {
                if (err) we.log.error('Error on create upload path', { error: err });
                return next();
              });
          }

          we.log.error('Error on create image dir: ', { imageDir });
          return next(err);
        } else {
          next();
        }
      });
    }, done);
  }

  plugin.hooks.on('we:create:default:folders', plugin.createFileFolder);

  return plugin;
};
