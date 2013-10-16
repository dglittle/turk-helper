
function onError(msg) {
    alert((msg || 'Oops. Not sure what happened.') + '\n\n' +
        'Please try refreshing the page.')
}

g_rpc_version = $.cookie('rpc_version')
g_rpc_token = $.cookie('rpc_token')
g_rpc_timer = null
g_rpc = []

function rpc(func, arg, cb) {
    if (typeof(arg) == 'function') return rpc(func, null, arg)
    g_rpc.push({
        payload : { func : func, arg : arg },
        cb : cb
    })
    if (g_rpc_timer) clearTimeout(g_rpc_timer)
    g_rpc_timer = setTimeout(function () {
        g_rpc_timer = null
        var save_rpc = g_rpc
        g_rpc = []
        $.ajax({
            url : '/rpc/' + g_rpc_version + '/' + g_rpc_token,
            type : 'post',
            data : _.json(_.map(save_rpc, function (e) { return e.payload })),
            success : function (r) {
                _.each(r, function (r, i) {
                    if (save_rpc[i].cb)
                        save_rpc[i].cb(r)
                })
            },
            error : function (s) {
                onError(s.responseText)
            }
        })
    }, 0)
}

function createThrobber() {
    var d = $("<div />");
    for (var i = 0; i < 10; i++) {
        $("<span />").text(".")
                     .appendTo(d)
                     .css({ color: i === 0 ? "#000" : "#ccc" });
    }
    var timer = setInterval(function () {
        if ($.contains(document.documentElement, d[0])) {
            d.find("span:last").prependTo(d);
        } else {
            clearInterval(timer);
        }
    }, 300);
    return d;
}

///

function mturkSubmit() {
    var params = _.getUrlParams()
    var f = $('<form action="' + params.turkSubmitTo + '/mturk/externalSubmit" method="GET"><input type="hidden" name="assignmentId" value="' + params.assignmentId + '"></input><input type="hidden" name="unused" value="unused"></input></form>')
    $('body').append(f)
    f.submit()
}

function mturkCheckPreview() {
    var params = _.getUrlParams()
    if (params.assignmentId == "ASSIGNMENT_ID_NOT_AVAILABLE") {
        _.dialog($('<div style="background-color: rgba(0,0,0,0.5);color:white;font-size:xx-large;padding:10px"/>').text('preview'), false)
        $('body').click(function () {
            alert('This is a preview. Please accept the HIT to work on it.')
        })
        return true
    }
}

function isHIT() {
    var params = _.getUrlParams()
    return !!params.assignmentId
}

///

function createSaveHelper(floatOver, onSave) {
    var b = $('<button/>').text('save')
    $('body').append(b)

    b.css('visibility', 'hidden')
    function updatePosition() {
        var o = floatOver.offset()
        var w = $(document).width()
        b.css({
            'visibility' : 'visible',
            'position' : 'absolute',
            'right' : (w - (o.left + floatOver.outerWidth())) + 'px',
            'top' : o.top + 'px',
            'z-index' : 1
        })
    }
    setTimeout(updatePosition, 0)
    $(window).resize(updatePosition)

    b.setState = function (state) {
        b.off('click')
        b.removeAttr('disabled')
        b.empty()
        if (state == true) {
            b.text('save').click(function () {
                b.setState(null)
                onSave(b)
            })
        } else if (state == false) {
            b.text('save').attr('disabled', 'disabled')
        } else {
            b.append(createThrobber())
        }
    }

    return b
}

function createSave(textarea, getSavedText, onSave) {
    var s = createSaveHelper(textarea, onSave)

    var saveTimeout = null
    s.update = function () {
        var dirty = textarea.val() != getSavedText()
        s.setState(dirty)
        clearTimeout(saveTimeout)
        if (dirty) {
            saveTimeout = setTimeout(function () {
                s.click()
            }, 1000)
        }
    }
    s.update()

    textarea.keydown(s.update).keyup(s.update).change(s.update)

    return s
}
