/**
 * We.js local storage plugin
 */

var gm = require('gm')
var uuid = require('uuid')
var path = require('path')
var mkdirp = require('mkdirp')
var fs = require('fs')

module.exports = function loadPlugin(projectPath, Plugin) {
  var plugin = new Plugin(__dirname);

  plugin.defaultFilename = function defaultFilename (req, file, cb) {
    file.name = Date.now() + '_' + uuid.v1() + '.' + file.originalname.split('.').pop()
    cb(null, file.name)
  }

  // set plugin configs
  plugin.setConfigs({
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
          getStorage: function getStorage () {
            return plugin.we.plugins['we-plugin-file'].multer
            .diskStorage({
              destination: this.getDestination('original'),
              filename: plugin.defaultFilename
            })
          },
          /**
           * Send one file to user
           *
           * @param  {Object} image
           * @param  {Object} req
           * @param  {Object} res
           * @param  {String} style
           */
          sendFile: function sendFile (image, req, res, style) {
            var we = plugin.we;

            var path = this.getPath(style, image.name)
            // check if file exists with fs.stat
            fs.stat(path, function afterCheckIfFileExists (err) {
              if (err) {
                return res.serverError(err)
              } else {
                var stream = fs.ReadStream(path)

                if (image.mime) {
                  res.contentType(image.mime)
                } else {
                  res.contentType('image/png')
                }
                // set http cache headers
                if (!res.getHeader('Cache-Control')) {
                  res.setHeader('Cache-Control', 'public, max-age=' + we.config.cache.maxage)
                }

                stream.pipe(res)

                stream.on('error', function (err) {
                  we.log.error('image:findOne: error in send file', err)
                })
              }
            })
          },
          destroyFile: function destroyFile (file, done) {
            var self = this

            plugin.we.utils.async.eachSeries(
              plugin.we.config.upload.image.avaibleStyles,
              function onEach (style, done) {
                self.destroyOneImage(file, style, done)
              },
              function afterEachStyle (err) {
                if (err) return done(err)
                // delete the original format
                self.destroyOneImage(file, 'original', done)
              }
            )
          },
          destroyOneImage: function destroyOneImage (file, style, done) {
            var path = this.getPath(style, file.name)

            fs.exists(path, function afterCheckIfFileExists(exists) {
              if (!exists) return done()

              fs.unlink(path, done)
            })
          },
          getUrlFromFile: function getUrlFromFile (format, file) {
            return plugin.we.config.hostname+'/api/v1/image/' + (format || 'original') + '/' + file.name
          },
          getDestination: function getDestination (style) {
            if (!style) style = 'original'
            return plugin.we.config.upload.image.uploadPath + '/' + style + '/'
          },
          getPath: function getPath (style, name) {
            return path.join(
              this.getDestination(style),
              name
            )
          },
          generateImageStyles: function generateImageStyles (file, done) {
            var we = plugin.we
            we.utils.async.eachSeries(
              we.config.upload.image.avaibleStyles,
              this.resizeEach.bind({ file: file, uploader: this }),
              done
            )
          },
          /**
           * Resize one image to fit image style size
           *
           * @param  {String}   imageStyle
           * @param  {Function} next         callback
           */
          resizeEach: function resizeEach (imageStyle, next) {
            var styles = plugin.we.config.upload.image.styles

            var originalFile = this.uploader.getPath('original', this.file.name)
            var newImagePath = this.uploader.getPath(imageStyle, this.file.name)
            // set new image style to save in DB
            this.file.urls[imageStyle] = this.uploader.getUrlFromFile (imageStyle, this.file)

            var width = styles[imageStyle].width
            var height = styles[imageStyle].heigth
            // resize, center and crop to fit size
            gm(originalFile)
            .resize(width, height, '^')
            .gravity('Center')
            .crop(width, height)
            .write(newImagePath, next)
          }
        },
        localFiles: {
          isLocalStorage: true,
          getStorage: function getStorage () {
            return plugin.we.plugins['we-plugin-file'].multer
            .diskStorage({
              destination: this.getDestination(),
              // projectPath + '/files/uploads/files',
              filename: plugin.defaultFilename
            })
          },
          /**
           * Send one file to user
           *
           * @param  {Object} file
           * @param  {Object} req
           * @param  {Object} res
           * @param  {String} style
           */
          sendFile: function sendFile (file, req, res) {
            var we = plugin.we;

            var path = this.getPath(null, file.name)
            // check if file exists with fs.stat
            fs.stat(path, function afterCheckIfFileExists (err) {
              if (err) {
                return res.notFound(err)
              }

              var stream = fs.ReadStream(path)

              if (file.mime) res.contentType(file.mime)
              // set http cache headers
              if (!res.getHeader('Cache-Control')) {
                res.setHeader('Cache-Control', 'public, max-age=' + we.config.cache.maxage)
              }

              stream.pipe(res)

              stream.on('error', function onError(err) {
                we.log.error('file:findOne: error in send file', err)
                res.serverError(err)
              })
            })
          },
          destroyFile: function destroyFile (file, done) {
            var path = this.getPath(null, file.name)

            fs.exists(path, function afterCheckIfFileExists(exists) {
              if (!exists) return done()

              fs.unlink(path, done)
            })
          },
          getUrlFromFile: function getUrlFromFile (format, file) {
            return plugin.we.config.hostname+'/api/v1/file-download/' + file.name
          },
          getDestination: function getDestination () {
            return plugin.we.config.upload.file.uploadPath + '/'
          },
          getPath: function getPath (style, name) {
            return path.join(
              this.getDestination(style),
              name
            )
          },
        }
      }
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
    mkdirp(we.config.upload.file.uploadPath, function (err) {
      if (err) we.log.error('Error on create file upload path', err)
    })

    // create image upload path
    var imageStyles = we.config.upload.image.avaibleStyles

    we.utils.async.each(imageStyles, function (style, next) {

      var imageDir = we.config.upload.image.uploadPath + '/' + style

      fs.lstat(imageDir, function (err) {
        if (err) {
          if (err.code === 'ENOENT') {
            we.log.info('Creating the image upload directory: ' + imageDir)
            return mkdirp(imageDir, function (err) {
              if (err) we.log.error('Error on create upload path', err)
              return next()
            })
          }
          we.log.error('Error on create image dir: ', imageDir)
          return next(err)
        } else {
          next()
        }
      })
    }, done)
  }

  plugin.hooks.on('we:create:default:folders', plugin.createFileFolder)

  return plugin;
};