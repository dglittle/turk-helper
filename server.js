
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

    app.use('/static', express.static('./static'))
    app.get('/', function (req, res) {
        res.cookie('rpc_version', g_rpc_version, { httpOnly: false})
        res.cookie('rpc_token', _.randomString(10), { httpOnly: false})
        res.sendfile('./index.html')
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
                    return rpc[input.func](input.arg, req, res)
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

    rpc.vote = function (arg, req) {
        if (arg.ballot) {
            var v = {
                _id : _.randomString(10),
                ballot : arg.ballot
            }
            _.p(db.collection('votes').insert(v, _.p()))
            return v._id
        } else if (_.has(arg, 'vote')) {
            _.p(db.collection('votes').update(_.object([
                ['_id', arg._id],
                ['votes.' + req.user, { $exists : false }]
            ]), {
                $set : _.object([
                    ['votes.' + req.user, arg.vote]
                ]),
                $inc : _.object([
                    ['voteCounts.' + arg.vote, 1]
                ])
            }, _.p()))
        } else if (arg._id) {
            var v = _.p(db.collection('votes').findOne(_.object([
                ['_id', arg._id],
                ['votes.' + req.user, { $exists : false }]
            ]), { votes : 0, voteCounts : 0 }, _.p()))
            if (v) {
                v.randomSeed = req.user
                return v
            }

            return _.p(db.collection('votes').findOne({ _id : arg._id }, { votes : 0 }, _.p()))
        } else {
            throw "not sure what to do.."
        }
    }

    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }))

    app.listen(process.env.PORT, function() {
        console.log("go to " + process.env.HOST)
    })

})
