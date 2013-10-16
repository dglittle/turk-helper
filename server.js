
function defaultEnv(key, val) {
    if (!process.env[key])
        process.env[key] = val
}
defaultEnv("PORT", 5000)
defaultEnv("HOST", "http://localhost:" + process.env.PORT)
defaultEnv("NODE_ENV", "production")
defaultEnv("MONGOHQ_URL", "mongodb://localhost:27017/turk-helper")
defaultEnv("SESSION_SECRET", "super_secret")

///

process.on('uncaughtException', function (err) {
    try {
		console.log(err)
        console.log(err.stack)
	} catch (e) {}
})

///

var _ = require('gl519')
_.run(function () {

    var db = require('mongojs').connect(process.env.MONGOHQ_URL)

    var express = require('express')
    var app = express()
    
    _.serveOnExpress(express, app)

    app.use(express.cookieParser())
    app.use(function (req, res, next) {
        _.run(function () {
            req.body = _.consume(req)
            next()
        })
    })

    var MongoStore = require('connect-mongo')(express)
    app.use(express.session({
        secret : process.env.SESSION_SECRET,
        cookie : { maxAge : 10 * 365 * 24 * 60 * 60 * 1000 },
        store : new MongoStore({
            url : process.env.MONGOHQ_URL,
            auto_reconnect : true,
            clear_interval : 3600
        })
    }))

    app.use(function (req, res, next) {
        if (req.query.workerId)
            req.session.user = 'mturk:' + req.query.workerId
        if (!req.session.user)
            req.session.user = _.randomString(1, /[A-Z]/) + _.randomString(9, /[a-z]/)
        req.user = req.session.user
        next()
    })

    var g_rpc_version = 1

    app.get('/', function (req, res) {
        res.cookie('rpc_version', g_rpc_version, { httpOnly: false})
        res.cookie('rpc_token', _.randomString(10), { httpOnly: false})
        res.sendfile('./index.html')
    })
    app.get('/utils.js', function (req, res) {
        res.sendfile('./utils.js')
    })

    var rpc = {}
    app.all(/\/rpc\/([^\/]+)\/([^\/]+)/, function (req, res, next) {
        _.run(function () {
            try {
                if (g_rpc_version != req.params[0])
                    throw new Error('version mismatch')
                if (!req.cookies.rpc_token || req.cookies.rpc_token != req.params[1])
                    throw new Error('token mismatch')
                var input = _.unJson(req.method.match(/post/i) ? req.body : _.unescapeUrl(req.url.match(/\?(.*)/)[1]))
                function runFunc(input) {
                    return rpc[input.func].apply(null, [input.arg, req, res])
                }
                if (input instanceof Array)
                    var output = _.map(input, runFunc)
                else
                    var output = runFunc(input)
                var body = _.json(output) || "null"
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body)
                })
                res.end(body)
            } catch (e) {
                next(e)
            }
        })
    })

    rpc.voteGet = function (arg, req) {
        if (arg.write) {
            db.collection('votes').ensureIndex({ read : 1 }, { background : true })
            try {
                _.p(db.collection('votes').insert({
                    _id : arg.write,
                    read : _.randomString(10)
                }, _.p()))
            } catch (e) {
                if (e.name == 'MongoError') {
                    // I guess there already is one, fine
                } else throw e
            }
            return _.p(db.collection('votes').findOne({
                _id : arg.write
            }, _.p()))
        } else {
            var o = _.p(db.collection('votes').findOne({
                read : arg.read
            }, _.p()))
            o.user = req.user
            return o
        }
    }

    rpc.voteSave = function (arg, req) {
        _.p(db.collection('votes').update({
            _id : arg.write,
            $or : [
                { model : { $exists : false } },
                { 'model.time' : { $lt : arg.model.time } }
            ]
        }, {
            $set : {
                model : arg.model
            }
        }, _.p()))
        return _.p(db.collection('votes').findOne({
            _id : arg.write
        }, _.p()))
    }

    rpc.voteVote = function (arg, req) {
        var optionHash = _.md5(arg.option)
        _.p(db.collection('voteVotes').insert({
            _id : arg.read + ':' + req.user,
            optionHash : optionHash
        }, _.p()))
        _.p(db.collection('votes').update({
            read : arg.read
        }, {
            $set : _.object([['votes.' + optionHash + '.option', arg.option]]),
            $inc : _.object([['votes.' + optionHash + '.count', 1]])
        }, _.p()))
    }

    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }))

    app.listen(process.env.PORT, function() {
        console.log("go to " + process.env.HOST)
    })

})
